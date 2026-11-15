/** A US or Canada E.164 number as "(779) 625-1378"; any other number is shown as it was given. */
export function formatLineNumber(e164: string): string {
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (!match) return e164;
  return `(${match[1]}) ${match[2]}-${match[3]}`;
}
