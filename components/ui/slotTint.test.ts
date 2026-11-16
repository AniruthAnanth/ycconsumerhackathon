import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ StyleSheet: { hairlineWidth: 1 } }));

import { SLOT_ORDER } from "@/lib/slots";
import { accentSet, money, palette, slotTint, status } from "@/theme/tokens";

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("accent colours", () => {
  it.each(SLOT_ORDER)("%s pill text passes WCAG AA (4.5:1) on its tint", (slot) => {
    expect(contrast(slotTint[slot].fg, slotTint[slot].bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("streak figure passes AA on its chip and on paper", () => {
    expect(contrast(accentSet.streak.text, accentSet.streak.chip)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(accentSet.streak.text, palette.canvas)).toBeGreaterThanOrEqual(4.5);
  });

  it("money and pending text pass AA on paper and white", () => {
    for (const ink of [money.text, status.pendingText, status.danger, status.verified]) {
      expect(contrast(ink, palette.canvas)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(ink, palette.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
