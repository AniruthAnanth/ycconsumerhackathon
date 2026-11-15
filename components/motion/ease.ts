import { Easing } from "react-native-reanimated";

import { easingCurve } from "@/theme";

/** The two easings of theme/motion.ts as reanimated easing functions, for withTiming and layout animations. */
export const ease = {
  standard: Easing.bezier(...easingCurve.standard),
  emphasized: Easing.bezier(...easingCurve.emphasized),
};
