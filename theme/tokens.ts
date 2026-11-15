import { StyleSheet } from "react-native";

// The Sunny visual refresh (Figma "Weekly League", revision wellness-2026-11-15,
// handoffs/figma/tokens.json): a warm paper canvas, deep green ink and accent,
// lime highlights, bucket tints, Nunito, 24-point cards and 16-point controls.
// Every colour and size a component needs lives here, so no screen hard-codes
// one and the whole app can be retuned in one place.
export const palette = {
  canvas: "#FAF8F2",
  surface: "#FFFFFF",
  ink: "#172B23",
  muted: "#5B6E63",
  faint: "#829087",
  line: "#DDE4DA",
  green: "#155C40",
  lime: "#D8F29A",
  greenSoft: "#E5EEDB",
  care: "#DCECEE",
  learn: "#E8E5F2",
  play: "#F4E4D6",
  yellow: "#F1D16D",
  warning: "#805719",
  danger: "#A13D38",
  dark: "#102F24",
  white: "#FFFFFF",
  lightInk: "#E9F0E6",
} as const;

// The role names every component already reads, mapped onto the palette.
export const colors = {
  ...palette,
  /** The page behind everything: warm paper rather than white. */
  background: palette.canvas,
  /** Section label rows. Sections are open, so the strip is the canvas itself and a divider separates it. */
  strip: palette.canvas,
  text: palette.ink,
  textMuted: palette.muted,
  /** Unscored dashes, placeholders and disabled chevrons. */
  textFaint: palette.faint,
  divider: palette.line,
  /** The one accent: links, outlined buttons and the primary button. */
  accent: palette.green,
  /** Behind the Up Next row and quiet banners. */
  accentTint: palette.greenSoft,
  /** The active tab's underline, and "paid" or "verified" marks. */
  tabActive: palette.green,
  /** Ink on a green or dark surface. */
  onAccent: palette.white,
  /** Dims the page behind the league switcher. */
  scrim: "rgba(23, 43, 35, 0.4)",
} as const;

/** The 4-point grid. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Left and right page margin on every screen. */
export const SCREEN_MARGIN = 20;
/** The smallest tappable area, in points. */
export const MIN_TARGET = 44;

export const radius = {
  sm: 8,
  md: 12,
  /** Buttons and fields. */
  control: 16,
  /** Task, bucket, award and hero cards. */
  card: 24,
  pill: 999,
} as const;

/**
 * Nunito's real weights, loaded in app/_layout.tsx. A custom font is one file per
 * weight, so styles pick the family rather than setting fontWeight (which would
 * make the platform synthesize bold from Regular).
 */
export const fontFamily = {
  regular: "Nunito_400Regular",
  semiBold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  extraBold: "Nunito_800ExtraBold",
} as const;

/** The type ramp from tokens.json: ExtraBold scores and headings, Bold buttons and subheads, SemiBold captions, Regular body. */
export const type = {
  display: { fontFamily: fontFamily.extraBold, fontSize: 52, lineHeight: 56 },
  title: { fontFamily: fontFamily.extraBold, fontSize: 30, lineHeight: 34 },
  heading: { fontFamily: fontFamily.extraBold, fontSize: 22, lineHeight: 28 },
  subheading: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20 },
  small: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFamily.semiBold, fontSize: 11, lineHeight: 16 },
} as const;

/** Sizes the existing rows use, nudged onto the new ramp (Nunito runs slightly narrower than the system face). */
export const font = {
  /** Uppercase section labels and pill text. */
  label: 11,
  meta: 13,
  body: 15,
  title: 16,
  score: 18,
  header: 18,
  total: 30,
  /** The pot on the League tab: the one figure larger than a total, because it is what the league plays for. */
  pot: 52,
} as const;

/** The progress bar: 12 points, fully rounded; pending points never fill it. */
export const progress = { height: 12, track: palette.greenSoft, fill: palette.green } as const;

/** Every row that lists a task uses it. */
export const ROW_HEIGHT = 72;
/** A row with two lines of text rather than three: a standing, a person. */
export const ROW_HEIGHT_COMPACT = 60;

export const hairline = StyleSheet.hairlineWidth;

export const tabUnderlineHeight = 3;
