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
  /** The light paper tint laid over the floating tab bar's liquid glass. */
  glassTint: "rgba(250, 248, 242, 0.55)",
  /** The blurred bar's fill where liquid glass is missing (older iOS, Android, web): paper, mostly opaque so labels stay legible. */
  glassFill: "rgba(250, 248, 242, 0.78)",
  /** The glass bar's hairline edge. */
  glassEdge: "rgba(23, 43, 35, 0.08)",
  /** The selected tab's pill: a faint wash of the green accent. */
  glassPill: "rgba(21, 92, 64, 0.12)",
} as const;

/** The 4-point grid. Every padding, margin and gap comes from here or from layout below. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  /** The screen margin's step on the scale. */
  xlm: 20,
  xl: 24,
  xxl: 32,
} as const;

/** Left and right page margin on every screen: content, dividers and full-width buttons all start here. */
export const SCREEN_MARGIN = 20;
/** The smallest tappable area, in points (HIG: 44 x 44). */
export const MIN_TARGET = 44;

/**
 * The one layout grid. Rows are built from fixed leading columns and a right-aligned numeric
 * column, so the same kind of value lines up on one edge on every screen.
 */
export const layout = {
  margin: SCREEN_MARGIN,
  /** Every row is at least this tall. */
  rowMin: MIN_TARGET,
  /** Every button and text field. */
  control: 48,
  /** The position pill column at the start of a task row. */
  pillColumn: 64,
  avatar: 40,
  avatarCompact: 32,
  /** Trailing score and points columns: right-aligned, tabular figures. */
  numericColumn: 56,
  /** The gap between a row's columns. */
  columnGap: 12,
  /** A nav bar, tab strip or week selector: the HIG's 44-pt bar. */
  bar: 44,
  /** Each side of a nav bar, wide enough for one 44-pt action, so the title stays centred. */
  barSide: 56,
  /** The position pill's height. */
  pillHeight: 24,
  /** The floating glass tab bar at the bottom of the tabs. */
  tabBar: 60,
  /** The iOS system tab bar's height above the home indicator (UITabBar, 49 pt), plus a little air for the last row. */
  systemTabBar: 49 + 8,
} as const;

/** Where a task row's text starts; its inset divider starts here too, as in an iOS list. */
export const TASK_TEXT_INSET = SCREEN_MARGIN + layout.pillColumn + layout.columnGap + layout.avatar + layout.columnGap;
/** Where a person row's text starts (compact avatar). */
export const PERSON_TEXT_INSET = SCREEN_MARGIN + layout.avatarCompact + layout.columnGap;

/** Figures that line up in a column. */
export const tabular = { fontVariant: ["tabular-nums" as const] };

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

/** The one outline weight for cards, fields and outlined controls (colour: colors.divider, or the accent when selected). Lists use hairline dividers instead. */
export const BORDER = 1;

export const tabUnderlineHeight = 3;

/**
 * Accent colours beyond the green. Each one means something and only ever paints a small
 * element (an icon, a figure, a pill, a dot), never a large fill, so green stays the one
 * primary and call-to-action colour. Yellow, warning, danger and the care/learn/play tints
 * come from tokens.json; the streak orange, money gold, warm, sand and pink are additions.
 */
const accent = {
  orange: "#E8792B",
  orangeInk: "#A8481A",
  orangeSoft: "#FCE7D6",
  gold: "#C9971F",
  goldInk: "#7F5C0E",
  warm: "#FBE1D2",
  warmInk: "#8F3B12",
  lavenderInk: "#4A3D8F",
  blueInk: "#1C5566",
  pink: "#F8E0E8",
  pinkInk: "#922E52",
  redOrange: "#E0482B",
} as const;

/** Hot streaks, three weeks or more, sit on a soft orange chip. */
export const HOT_STREAK = 3;

export const accentSet = {
  /** The flame and its count: the icon in streak orange, the figure in a deeper orange that passes AA as small text. */
  streak: { icon: accent.orange, text: accent.orangeInk, chip: accent.orangeSoft },
} as const;

/** Buy-ins, pots, payouts, escrow coins and trophies. `text` passes AA on paper; `coin` is for icons and coins only. */
export const money = { text: accent.goldInk, coin: accent.gold, tint: palette.yellow } as const;

/** Each slot's own tint and the ink that sits on it (AA-checked in components/ui/slotTint.test.ts). */
export const slotTint = {
  body: { bg: accent.warm, fg: accent.warmInk },
  mind: { bg: palette.learn, fg: accent.lavenderInk },
  recharge: { bg: palette.care, fg: accent.blueInk },
  chores: { bg: palette.play, fg: palette.warning },
  people: { bg: accent.pink, fg: accent.pinkInk },
  flex: { bg: palette.greenSoft, fg: palette.green },
} as const;

/** Small status marks. `pendingText` is the readable ink for pending; the yellow is for icons and dots. */
export const status = {
  verified: palette.green,
  pending: palette.yellow,
  pendingText: palette.warning,
  danger: palette.danger,
  live: accent.redOrange,
} as const;

