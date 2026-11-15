import { describe, expect, it } from "vitest";

import { SLOT_ICON } from "@/components/ui/slotIcons";
import { SLOT_ORDER } from "@/lib/slots";

import { SF_SYMBOL_FOR_IONICON } from "./sfSymbols";

describe("SF_SYMBOL_FOR_IONICON", () => {
  it("maps every entry to a symbol name", () => {
    for (const [ionicon, symbol] of Object.entries(SF_SYMBOL_FOR_IONICON)) {
      expect(typeof symbol, ionicon).toBe("string");
      expect(symbol!.length, ionicon).toBeGreaterThan(0);
    }
  });

  it("maps every slot's icon, so task thumbnails draw SF Symbols on iOS", () => {
    for (const slot of SLOT_ORDER) {
      expect(SF_SYMBOL_FOR_IONICON[SLOT_ICON[slot]], slot).toBeTruthy();
    }
  });
});
