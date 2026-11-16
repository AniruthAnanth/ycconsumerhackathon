/**
 * The owner's rule: no em-dash or en-dash used as a dash anywhere a player reads. The app's own
 * copy is held to it by tests/no-em-dash.test.ts. Model output can't be checked ahead of time,
 * so everything a model writes passes through withoutDashes before it is stored or shown.
 */

/** Rewrites dashes as a person would: a range becomes "to", any other dash becomes a comma. */
export function withoutDashes(text: string): string {
  return text
    .replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, "$1 to $2")
    .replace(/\s*[\u2013\u2014]+\s*/g, ", ")
    .replace(/^, |, $/g, "")
    .replace(/,\s*([,.!?;:])/g, "$1");
}

/** withoutDashes applied to every string in a parsed JSON value. */
export function withoutDashesDeep<T>(value: T): T {
  if (typeof value === "string") return withoutDashes(value) as T;
  if (Array.isArray(value)) return value.map(withoutDashesDeep) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, withoutDashesDeep(inner)])) as T;
  }
  return value;
}
