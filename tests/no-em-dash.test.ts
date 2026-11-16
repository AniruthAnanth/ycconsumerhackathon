/**
 * The owner's rule: no em-dash, and no en-dash used as a dash, in anything a player reads. This
 * reads every string literal, template piece and JSX text in the app and the backend and fails on
 * one. Comments and tests are not shown to anyone, so they are not checked. Model output is
 * cleaned at runtime instead (convex/lib/dashes.ts).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";

const ROOT = join(__dirname, "..");
const SCANNED = ["app", "components", "lib", "convex"];
const DASH = /\u2014|\s\u2013\s/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "_generated" || entry.name === "node_modules" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function dashedStrings(path: string): string[] {
  const source = readFileSync(path, "utf8");
  if (!/[\u2013\u2014]/.test(source)) return [];
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node) || ts.isJsxText(node)) {
      if (DASH.test(node.text)) {
        const { line } = file.getLineAndCharacterOfPosition(node.getStart());
        found.push(`${relative(ROOT, path)}:${line + 1}: ${JSON.stringify(node.text)}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

test("no player-facing string uses an em-dash or an en-dash as a dash", () => {
  const files = SCANNED.flatMap((dir) => sourceFiles(join(ROOT, dir)));
  expect(files.length).toBeGreaterThan(100);
  expect(files.flatMap(dashedStrings)).toEqual([]);
});
