/**
 * The drawing maths behind the market charts, kept free of React so it is tested on its own.
 * Every function maps data onto a box of `width` x `height` points with y growing downward.
 */

export type ChartPoint = { at: number; value: number };
type Box = { width: number; height: number; padding?: number };

/** x from time, y from value; a flat series sits in the middle rather than on an edge. */
function scaler(points: readonly ChartPoint[], { width, height, padding = 4 }: Box, range?: [number, number]) {
  const first = points[0]?.at ?? 0;
  const last = points[points.length - 1]?.at ?? first;
  const [low, high] = range ?? [Math.min(...points.map((p) => p.value)), Math.max(...points.map((p) => p.value))];
  const span = high - low;
  return {
    x: (at: number) => padding + (last === first ? 0 : ((at - first) / (last - first)) * (width - 2 * padding)),
    y: (value: number) => (span === 0 ? height / 2 : padding + (1 - (value - low) / span) * (height - 2 * padding)),
  };
}

/**
 * A step line, the way a market price chart holds its price until the next trade: flat to each
 * proof, then straight up or down. Returns the path, its length (for the draw-on animation) and the
 * last point (for the "now" dot).
 */
export function stepPath(points: readonly ChartPoint[], box: Box, range: [number, number] = [0, 1]) {
  if (points.length === 0) return { d: "", length: 0, end: { x: 0, y: box.height / 2 } };
  const { x, y } = scaler(points, box, range);
  let d = `M${x(points[0].at).toFixed(1)} ${y(points[0].value).toFixed(1)}`;
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const nx = x(points[i].at);
    const py = y(points[i - 1].value);
    const ny = y(points[i].value);
    length += Math.abs(nx - x(points[i - 1].at)) + Math.abs(ny - py);
    d += ` H${nx.toFixed(1)} V${ny.toFixed(1)}`;
  }
  // A single price still draws: a flat line across the whole box.
  if (points.length === 1) {
    d += ` H${(box.width - (box.padding ?? 4)).toFixed(1)}`;
    length = box.width - 2 * (box.padding ?? 4);
  }
  const lastX = points.length === 1 ? box.width - (box.padding ?? 4) : x(points[points.length - 1].at);
  return { d, length, end: { x: lastX, y: y(points[points.length - 1].value) } };
}

/** The same step line closed down to the bottom edge, for the soft fill under it. */
export function areaPath(line: { d: string; end: { x: number } }, box: Box): string {
  if (!line.d) return "";
  const start = line.d.match(/^M([\d.-]+)/)?.[1] ?? "0";
  return `${line.d} V${box.height} H${start} Z`;
}

/** A smooth-enough sparkline: straight segments between points, scaled to the series' own range. */
export function sparkPath(points: readonly ChartPoint[], box: Box): string {
  if (points.length === 0) return "";
  const { x, y } = scaler(points, box);
  const series = points.length === 1 ? [points[0], { ...points[0], at: points[0].at + 1 }] : points;
  const sx = points.length === 1 ? (i: number) => (i === 0 ? box.padding ?? 4 : box.width - (box.padding ?? 4)) : (i: number) => x(series[i].at);
  return series.map((p, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
}

/** "62%": a chance in whole percent. A long shot reads "<1%" and a near-lock ">99%", as a market quotes them, never a flat 0 or 100 while it can still move. */
export function formatChance(chance: number): string {
  const clamped = Math.min(1, Math.max(0, chance));
  if (clamped > 0 && clamped < 0.005) return "<1%";
  if (clamped < 1 && clamped > 0.995) return ">99%";
  return `${Math.round(clamped * 100)}%`;
}

/** "+14 today", "-3 today", or "Flat today": the delta chip, in percentage points. */
export function deltaLabel(points: number): string {
  if (points === 0) return "Flat today";
  return `${points > 0 ? "+" : "−"}${Math.abs(points)} today`;
}

/** "+$34", "-$8", "$0": a projected net in whole dollars, signed so a gain reads at a glance. */
export function formatNet(usd: number): string {
  const dollars = Math.round(usd);
  if (dollars === 0) return "$0";
  return `${dollars > 0 ? "+" : "−"}$${Math.abs(dollars)}`;
}
