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
