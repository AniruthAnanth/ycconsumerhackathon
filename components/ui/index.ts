/**
 * The shared ESPN-style primitives. Screens import from "@/components/ui" and
 * compose these; they do not restyle text, rows or buttons themselves.
 */
export { PROOF_LABEL, SLOT_LABEL, SLOT_NAME, SLOT_ORDER, type ProofType, type Slot } from "@/lib/slots";
export { formatClock, formatScore, taskPlaceLine, taskStatusLine, type TaskRowData } from "@/lib/taskText";

export { Avatar } from "./Avatar";
export { Banner } from "./Banner";
export { Button } from "./Button";
export { LARGE_TITLE_HEIGHT, LargeTitle, useCollapsingHeader } from "./CollapsingHeader";
export { Divider, RowDivider } from "./Divider";
export { EmptyState } from "./EmptyState";
export { GlassTabBar, useTabBarInset } from "./GlassTabBar";
export { Header } from "./Header";
export { Icon, type IconName } from "./Icon";
export { OutlinedPillButton } from "./OutlinedPillButton";
export { PositionPill } from "./PositionPill";
export { Score } from "./Score";
export { Screen } from "./Screen";
export { SectionLabel } from "./SectionLabel";
export { SheetGrabber, sheetOptions, sheetSurface } from "./Sheet";
export { TaskRow } from "./TaskRow";
export { TextField } from "./TextField";
export { TopTabs } from "./TopTabs";
export { WeekSelector } from "./WeekSelector";
