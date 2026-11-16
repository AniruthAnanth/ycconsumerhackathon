/**
 * The motion system: every animation in Lineup picks from these three durations, two easings and
 * two springs, so the app moves one way. Motion is for meaning only (a score changing, a rank
 * moving, a verdict, money arriving, progress filling, a sheet opening), never decoration.
 * Pure numbers, so the theme stays free of animation libraries; components/motion turns the curves
 * into reanimated easing functions.
 */

/** fast: a press or a toggle answering. base: a fade, a tab change, a toast. slow: a sheet, a count-up, a reorder. */
export const duration = { fast: 120, base: 200, slow: 320 } as const;

/**
 * Cubic-bezier control points. standard is an ease-out for things arriving on screen; emphasized
 * starts quick and lands long, for the moments that matter (a sheet rising, a verdict).
 */
export const easingCurve = {
  standard: [0.215, 0.61, 0.355, 1],
  emphasized: [0.2, 0, 0, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/**
 * Both springs are close to critically damped, so nothing wobbles. snappy is for a press or a
 * toggle following the finger; gentle is for layout: bars filling, rows reordering, panels sliding.
 */
export const spring = {
  snappy: { damping: 36, stiffness: 400, mass: 1 },
  gentle: { damping: 24, stiffness: 170, mass: 1 },
} as const;

/**
 * A task turning done while it is on screen: one sequence of about 900 ms, in beats. The check
 * lands, the strike draws, the row mutes, the points pop with a burst, a ghost of the points
 * floats off and the week score rolls up. Every value is ms from the moment the task verified,
 * except the counts and sizes.
 */
export const doneMoment = {
  /** Beat 1: the check springs past full size, then settles. */
  checkPeak: 1.15,
  /** Beat 2: the strike draws left to right, then the row eases to its muted state. */
  strikeDelayMs: 120,
  strikeMs: 250,
  muteMs: duration.base,
  /** Done rows sit at this opacity for the slot pill and the line under the title. */
  mutedOpacity: 0.5,
  /** Beat 3: the points pill pops and its sparkles fly out. */
  pillDelayMs: 420,
  pillPeak: 1.2,
  burstMs: 420,
  sparkles: 8,
  sparkleSize: 5,
  sparkleDistance: 26,
  /** Beat 4: the ghost of the points floats up and fades while the week score rolls. */
  ghostDelayMs: 480,
  ghostMs: 420,
  ghostRise: 22,
  rollDelayMs: 480,
  /** Long enough that maxTicks ticks land further apart than the haptics throttle (TICK_MS). */
  rollMs: 660,
  /** The most haptic ticks a roll gives, however many points it counts. */
  maxTicks: 6,
  /** Beat 5, the perfect week: a shimmer across the row, a heavier burst and a toast. */
  shimmerDelayMs: 560,
  shimmerMs: 520,
  perfectSparkles: 14,
  perfectSparkleDistance: 40,
  perfectToastDelayMs: 900,
} as const;
