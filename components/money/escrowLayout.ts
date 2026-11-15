/**
 * Geometry for the escrow diagram: where each member's avatar sits, the curve from it to the pot,
 * and the pot box itself. Pure numbers, so the picture is tested without a renderer.
 */

export type Point = { x: number; y: number };

/** A cubic bezier from beside a member's avatar to the side of the pot. */
export type Curve = { from: Point; c1: Point; c2: Point; to: Point };

export type Lane = {
  /** Top-left corner of the member's avatar. */
  avatar: Point;
  curve: Curve;
  /** The curve as an SVG path. */
  path: string;
};

export type EscrowLayout = {
  height: number;
  avatarSize: number;
  pot: { x: number; y: number; width: number; height: number };
  /** One per member, in the order the members were given. */
  lanes: Lane[];
};

const SIZES = {
  regular: { avatar: 36, gap: 10, potHeight: 112, lane: 44 },
  /** Inside a sheet, where the diagram shares the height with a form. */
  compact: { avatar: 28, gap: 6, potHeight: 76, lane: 36 },
} as const;

/** Clear space between an avatar and the start of its line. */
const AVATAR_CLEARANCE = 4;
/** The pot never gets narrower than its figure needs, even in a very narrow container. */
const MIN_POT_WIDTH = 96;

/**
 * Members alternate between the left and the right column, so the two sides stay balanced and a
 * staggered flow comes in from both. Each column is centred on the pot, and its lines land spread
 * down the pot's side instead of on one point, as in the owner's sketch.
 */
export function escrowLayout(width: number, memberCount: number, compact = false): EscrowLayout {
  const size = compact ? SIZES.compact : SIZES.regular;
  const leftCount = Math.ceil(memberCount / 2);
  const columnHeight = (count: number) => count * size.avatar + Math.max(0, count - 1) * size.gap;
  const height = Math.max(size.potHeight, columnHeight(leftCount));
  const potWidth = Math.max(MIN_POT_WIDTH, width - 2 * (size.avatar + size.lane));
  const pot = { x: (width - potWidth) / 2, y: (height - size.potHeight) / 2, width: potWidth, height: size.potHeight };

  const lanes = Array.from({ length: memberCount }, (_, index): Lane => {
    const left = index % 2 === 0;
    const row = Math.floor(index / 2);
    const count = left ? leftCount : memberCount - leftCount;
    const top = (height - columnHeight(count)) / 2 + row * (size.avatar + size.gap);
    const from = { x: left ? size.avatar + AVATAR_CLEARANCE : width - size.avatar - AVATAR_CLEARANCE, y: top + size.avatar / 2 };
    const to = { x: left ? pot.x : pot.x + pot.width, y: pot.y + (pot.height * (row + 1)) / (count + 1) };
    // Both handles sit on the midline, so the line leaves the avatar and meets the pot level.
    const midX = (from.x + to.x) / 2;
    const curve = { from, c1: { x: midX, y: from.y }, c2: { x: midX, y: to.y }, to };
    return { avatar: { x: left ? 0 : width - size.avatar, y: top }, curve, path: curvePath(curve) };
  });

  return { height, avatarSize: size.avatar, pot, lanes };
}

export function curvePath({ from, c1, c2, to }: Curve): string {
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}

/** The point a fraction `t` of the way along the curve. Runs on the UI thread for every dollar, every frame. */
export function curvePoint(curve: Curve, t: number): Point {
  "worklet";
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * curve.from.x + b * curve.c1.x + c * curve.c2.x + d * curve.to.x,
    y: a * curve.from.y + b * curve.c1.y + c * curve.c2.y + d * curve.to.y,
  };
}
