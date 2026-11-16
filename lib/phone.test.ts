import { describe, expect, it } from "vitest";

import {
  collectContactPhones,
  formatPhoneInput,
  inviteesFrom,
  MAX_CONTACT_PHONES,
  MAX_INVITEES,
  phoneHint,
  toE164,
} from "./phone";

describe("formatPhoneInput", () => {
  it("draws the number as it is typed", () => {
    expect(formatPhoneInput("")).toBe("");
    expect(formatPhoneInput("6")).toBe("(6");
    expect(formatPhoneInput("650")).toBe("(650");
    expect(formatPhoneInput("6505")).toBe("(650) 5");
    expect(formatPhoneInput("6505557")).toBe("(650) 555-7");
    expect(formatPhoneInput("6505557733")).toBe("(650) 555-7733");
  });

  it("drops the country code from an autofilled or pasted number and caps at ten digits", () => {
    expect(formatPhoneInput("+1 (650) 555-7733")).toBe("(650) 555-7733");
    expect(formatPhoneInput("650555773399")).toBe("(650) 555-7733");
  });

  it("deletes the digit before a bracket, space or dash the player backspaced over", () => {
    expect(formatPhoneInput("(650) 555", "(650) 555-")).toBe("(650) 55");
    expect(formatPhoneInput("(650 555", "(650) 555")).toBe("(650) 55");
    expect(formatPhoneInput("(650) 55", "(650) 555")).toBe("(650) 55");
  });

  it("formats to a number toE164 accepts", () => {
    expect(toE164(formatPhoneInput("6505557733"))).toBe("+16505557733");
  });
});

describe("toE164", () => {
  it("adds the default country code to a ten-digit number", () => {
    expect(toE164("(415) 555-0100")).toBe("+14155550100");
    expect(toE164("415.555.0100")).toBe("+14155550100");
    expect(toE164("4155550100")).toBe("+14155550100");
  });

  it("keeps a leading plus and the digits after it", () => {
    expect(toE164("+44 20 7946 0958")).toBe("+442079460958");
    expect(toE164("+1 (415) 555-0100")).toBe("+14155550100");
  });

  it("adds a plus to an eleven-digit number that starts with the country code", () => {
    expect(toE164("1 415 555 0100")).toBe("+14155550100");
    expect(toE164("14155550100")).toBe("+14155550100");
  });

  it("honours another default country code", () => {
    expect(toE164("7911 123456", "44")).toBe("+447911123456");
  });

  it("rejects anything that is not 8 to 15 digits", () => {
    expect(toE164("")).toBeNull();
    expect(toE164("   ")).toBeNull();
    expect(toE164("call me")).toBeNull();
    expect(toE164("555-0100")).toBeNull();
    expect(toE164("+1234567890123456")).toBeNull();
  });
});

describe("phoneHint", () => {
  it("says nothing while the field has no digit", () => {
    expect(phoneHint("")).toBeNull();
    expect(phoneHint("   ")).toBeNull();
    expect(phoneHint("+")).toBeNull();
  });

  it("asks for ten digits once a malformed number has been started", () => {
    expect(phoneHint("4")).toBe("Enter a 10-digit phone number");
    expect(phoneHint("12345")).toBe("Enter a 10-digit phone number");
    expect(phoneHint("415 555")).toBe("Enter a 10-digit phone number");
  });

  it("says nothing about a number toE164 accepts", () => {
    expect(phoneHint("(415) 555-0100")).toBeNull();
    expect(phoneHint("+44 20 7946 0958")).toBeNull();
  });
});

describe("collectContactPhones", () => {
  it("normalises and de-duplicates the numbers, one person per contact, mobile first", () => {
    const { phones, people } = collectContactPhones([
      { fullName: "Ada Lovelace", phones: [{ number: "(415) 555-0100", label: "home" }, { number: "junk" }, { number: "415 555 0102", label: "mobile" }] },
      { fullName: "Ada Again", phones: [{ number: "+1 415 555 0100" }] },
      { fullName: null, phones: [{ number: "415 555 0101" }, {}] },
      { fullName: "No Number" },
    ]);
    expect(phones).toEqual(["+14155550102", "+14155550100", "+14155550101"]);
    expect(people).toEqual([
      { name: "Ada Lovelace", phones: ["+14155550102", "+14155550100"] },
      { name: "+14155550101", phones: ["+14155550101"] },
    ]);
  });

  it("caps the numbers sent", () => {
    const contacts = Array.from({ length: MAX_CONTACT_PHONES + 20 }, (_, index) => ({
      fullName: `Contact ${index}`,
      phones: [{ number: `+1415${String(5550000 + index)}` }],
    }));
    expect(collectContactPhones(contacts).phones).toHaveLength(MAX_CONTACT_PHONES);
  });
});

describe("inviteesFrom", () => {
  it("gives one row per person, texting their first number, sorted by name", () => {
    const people = [
      { name: "Zed", phones: ["+1", "+4"] },
      { name: "Amy", phones: ["+2"] },
      { name: "On Lineup", phones: ["+3", "+5"] },
    ];
    expect(inviteesFrom(["+1", "+2", "+4", "+5"], people)).toEqual([
      { phone: "+2", name: "Amy", otherPhones: [] },
      { phone: "+1", name: "Zed", otherPhones: ["+4"] },
    ]);
    const many = Array.from({ length: MAX_INVITEES + 5 }, (_, index) => ({ name: `P${index}`, phones: [`+${index}`] }));
    expect(inviteesFrom(many.map((person) => person.phones[0]), many)).toHaveLength(MAX_INVITEES);
  });
});
