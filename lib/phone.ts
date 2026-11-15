const MIN_DIGITS = 8;
const MAX_DIGITS = 15;
/** National numbers in the countries we default to (NANP) are ten digits long. */
const NATIONAL_DIGITS = 10;

export const MAX_CONTACT_PHONES = 500;
export const MAX_INVITEES = 50;

/**
 * Normalises a typed or address-book number to E.164, or null when it cannot be
 * a phone number. The server matches contacts by this exact string, so the app
 * and the backend must agree on it: a leading + is kept as typed, a bare
 * national number gets the default country code, and anything else with 8 to 15
 * digits is assumed to already carry its country code.
 */
export function toE164(raw: string, defaultCountryCode = "1"): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === NATIONAL_DIGITS) return `+${defaultCountryCode}${digits}`;
  return `+${digits}`;
}

/**
 * The line to show under the phone field, or null. It stays quiet while the
 * field is empty (or holds no digit yet) so a new player isn't scolded before
 * they've typed anything, and speaks once there are digits that toE164 rejects.
 */
export function phoneHint(raw: string): string | null {
  if (!/\d/.test(raw) || toE164(raw)) return null;
  return "Enter a 10-digit phone number";
}

/** The slice of an address-book entry the contacts step reads. */
export type DeviceContact = {
  fullName?: string | null;
  phones?: { number?: string }[];
};

/**
 * Turns the address book into the numbers to send to the server, normalised on
 * the device so raw contact data never leaves it, de-duplicated and capped. The
 * names stay on the device too: they label the people we invite by text.
 */
export function collectContactPhones(
  contacts: DeviceContact[],
  defaultCountryCode = "1",
): { phones: string[]; nameByPhone: Record<string, string> } {
  const nameByPhone: Record<string, string> = {};
  for (const contact of contacts) {
    for (const { number } of contact.phones ?? []) {
      const phone = number ? toE164(number, defaultCountryCode) : null;
      if (!phone || phone in nameByPhone) continue;
      nameByPhone[phone] = contact.fullName?.trim() || phone;
    }
  }
  return { phones: Object.keys(nameByPhone).slice(0, MAX_CONTACT_PHONES), nameByPhone };
}

export type Invitee = { phone: string; name: string };

/** The people to text: the server's not-on-Lineup numbers, named from the device and ordered by name. */
export function inviteesFrom(notOnLineup: string[], nameByPhone: Record<string, string>): Invitee[] {
  return notOnLineup
    .map((phone) => ({ phone, name: nameByPhone[phone] ?? phone }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_INVITEES);
}
