/** Past this many characters a name no longer fits two lines of the standings' player column. */
export const NAME_FIT = 18;

/**
 * The name the standings show: the full name when it fits, else the first name cut to an initial
 * ("Aniruth Ananthanarayanan" becomes "A. Ananthanarayanan"), so the surname survives instead of an ellipsis.
 */
export function standingName(name: string, fit = NAME_FIT): string {
  const trimmed = name.trim();
  if (trimmed.length <= fit) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return trimmed;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}
