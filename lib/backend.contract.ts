/**
 * Fails `npm run typecheck` when lib/backend.ts stops matching the backend.
 *
 * backend.ts gives each function reference hand-written argument and result
 * types, and nothing else ties them to the Convex functions they name: a field
 * the backend renames, drops or makes optional still typechecks and then
 * breaks on the phone. This file compares every binding with the function of
 * the same name in the generated `api`, so a new binding is covered without
 * being listed here.
 *
 * A failure is reported on the last line and names the binding and the field,
 * for example "The types of 'leagues.get.call(...).week.status' are
 * incompatible". Fix the type in backend.ts and the screens that read it, or
 * the function in convex/.
 *
 * Types only, and nothing imports this file, so it adds nothing to the bundle.
 */
import type { FunctionReference } from "convex/server";

import type { api } from "@/convex/_generated/api";

import type { backend } from "./backend";

type Api = typeof api;
type Backend = typeof backend;

/**
 * Every field name in T as a dotted path, through arrays and optional fields.
 * Assignability alone lets a declared optional field outlive its rename on the
 * backend, and lets the app send an argument the validator then rejects.
 */
type Fields<T, Prefix extends string> = T extends readonly (infer Item)[]
  ? Fields<Item, Prefix>
  : T extends string | Record<string, never>
    ? never // Nothing to walk into: an Id is a branded string, and NoArgs has no fields.
    : T extends object
      ? { [K in keyof T & string]: `${Prefix}${K}` | Fields<T[K], `${Prefix}${K}.`> }[keyof T & string]
      : never;

/**
 * A reference in the shape that makes "assignable" mean "the real function can
 * stand in for the declared one". As a function, `call` takes the declared
 * arguments into the real ones and the real result into the declared one;
 * `fields` holds the declared names to the ones the real function has.
 */
type Signature<Ref> =
  Ref extends FunctionReference<infer Kind, "public", infer Args, infer Result>
    ? 0 extends 1 & Result
      ? "returns any, which would match every declared result: give the function a returns validator"
      : {
          kind: Kind;
          call: (args: Args) => Result;
          fields: (name: Fields<Args, "args."> | Fields<Result, "result.">) => void;
        }
    : "not a public function in convex/_generated/api";

type Declared = {
  [Module in keyof Backend]: { [Name in keyof Backend[Module]]: Signature<Backend[Module][Name]> };
};

type Real = {
  [Module in keyof Backend]: {
    [Name in keyof Backend[Module]]: Signature<
      Module extends keyof Api ? (Name extends keyof Api[Module] ? Api[Module][Name] : undefined) : undefined
    >;
  };
};

type Assert<Expected, Actual extends Expected> = Actual;

export type BackendMatchesApi = Assert<Declared, Real>;
