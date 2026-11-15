import { StyleSheet } from "react-native";

// The look is the ESPN Fantasy app: white pages, near-black text, hairline
// grey dividers, one accent blue, and a green underline on the active tab.
export const colors = {
  background: "#FFFFFF",
  text: "#121213",
  textMuted: "#6C6E73",
  divider: "#D9DBDE",
  accent: "#0B69FF",
  tabActive: "#00A651",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const hairline = StyleSheet.hairlineWidth;

export const tabUnderlineHeight = 3;
