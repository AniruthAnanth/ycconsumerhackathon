import { StyleSheet } from "react-native";

// The look is the ESPN Fantasy team screen: white pages, near-black text,
// hairline grey dividers, one accent blue, and a green underline on the active
// tab. Every colour and size a component needs lives here, so no screen
// hard-codes one and the whole app can be retuned in one place.
export const colors = {
  background: "#FFFFFF",
  /** Section label rows, the only non-white surface in a list. */
  strip: "#F4F5F6",
  text: "#121213",
  textMuted: "#6C6E73",
  /** Unscored dashes, placeholders and disabled chevrons. */
  textFaint: "#A9ABAF",
  divider: "#D9DBDE",
  /** The one accent: pills, links, outlined buttons and the primary button. */
  accent: "#0B69FF",
  /** Behind the Up Next row and quiet banners. */
  accentTint: "#EEF4FF",
  /** The active tab's underline, and "paid" or "verified" marks. */
  tabActive: "#00A651",
  danger: "#C8102E",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const font = {
  /** Uppercase section labels and pill text. */
  label: 11,
  meta: 12,
  body: 14,
  title: 15,
  score: 16,
  header: 17,
  total: 24,
} as const;

/** ESPN's player row height; every list row in the app uses it. */
export const ROW_HEIGHT = 72;

export const hairline = StyleSheet.hairlineWidth;

export const tabUnderlineHeight = 3;
