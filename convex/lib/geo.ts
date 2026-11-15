/**
 * Distance maths for location check-ins.
 *
 * Pure functions only. The 150 m rule decides whether money-backed points are
 * awarded, so it has to be provable without a phone, a database or a model.
 */

export type LatLng = { lat: number; lng: number };

/** A check-in counts when the phone is within this many metres of the pinned place. */
export const CHECK_IN_RADIUS_M = 150;

// Mean Earth radius. The haversine error from treating Earth as a sphere is
// about 0.3%, which is under half a metre at check-in scale.
const EARTH_RADIUS_M = 6_371_008.8;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance between two points, in metres (haversine formula). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  // Rounding can push h a hair above 1 for antipodal points, and asin(>1) is NaN.
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True for coordinates a phone could really report. Guards against NaN and swapped lat/lng. */
export function isValidLatLng(point: LatLng): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
}

/** "40 m" or "1.2 km", for the referee's reason. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
