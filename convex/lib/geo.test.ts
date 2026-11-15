import { describe, expect, it } from "vitest";
import {
  CHECK_IN_RADIUS_M,
  distanceMeters,
  formatDistance,
  isValidLatLng,
  isWithinCheckInRadius,
} from "./geo";

const YC_OFFICE = { lat: 37.7609, lng: -122.3884 };

/** A point the given number of metres due north of the origin. */
function metresNorth(origin: { lat: number; lng: number }, metres: number) {
  // One degree of latitude is 111.195 km on the mean-radius sphere geo.ts uses.
  return { lat: origin.lat + metres / 111_195, lng: origin.lng };
}

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters(YC_OFFICE, YC_OFFICE)).toBe(0);
  });

  it("matches a known city-to-city distance", () => {
    const sanFrancisco = { lat: 37.7749, lng: -122.4194 };
    const losAngeles = { lat: 34.0522, lng: -118.2437 };
    // Published great-circle distance is about 559 km.
    expect(distanceMeters(sanFrancisco, losAngeles) / 1000).toBeCloseTo(559.1, 0);
  });

  it("measures one degree of latitude as about 111.2 km", () => {
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) / 1000).toBeCloseTo(111.2, 1);
  });

  it("shrinks a degree of longitude with latitude", () => {
    const atEquator = distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    const atSixty = distanceMeters({ lat: 60, lng: 0 }, { lat: 60, lng: 1 });
    expect(atSixty / atEquator).toBeCloseTo(0.5, 2);
  });

  it("is symmetric", () => {
    const park = { lat: 37.7596, lng: -122.4269 };
    expect(distanceMeters(YC_OFFICE, park)).toBeCloseTo(distanceMeters(park, YC_OFFICE), 6);
  });

  it("takes the short way across the antimeridian", () => {
    const metres = distanceMeters({ lat: 0, lng: 179.999 }, { lat: 0, lng: -179.999 });
    expect(metres).toBeLessThan(250);
  });

  it("stays finite for antipodal points", () => {
    const metres = distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    expect(metres / 1000).toBeCloseTo(20_015, -1);
  });
});

describe("isWithinCheckInRadius", () => {
  it("uses a 150 m radius", () => {
    expect(CHECK_IN_RADIUS_M).toBe(150);
  });

  it("passes at the place itself and just inside the radius", () => {
    expect(isWithinCheckInRadius(YC_OFFICE, YC_OFFICE)).toBe(true);
    expect(isWithinCheckInRadius(metresNorth(YC_OFFICE, 149), YC_OFFICE)).toBe(true);
  });

  it("fails just outside the radius", () => {
    expect(isWithinCheckInRadius(metresNorth(YC_OFFICE, 151), YC_OFFICE)).toBe(false);
  });

  it("fails from across town", () => {
    const missionDolores = { lat: 37.7596, lng: -122.4269 };
    expect(isWithinCheckInRadius(missionDolores, YC_OFFICE)).toBe(false);
  });

  it("honours a custom radius", () => {
    expect(isWithinCheckInRadius(metresNorth(YC_OFFICE, 151), YC_OFFICE, 200)).toBe(true);
  });
});

describe("isValidLatLng", () => {
  it("accepts real coordinates", () => {
    expect(isValidLatLng(YC_OFFICE)).toBe(true);
    expect(isValidLatLng({ lat: -90, lng: 180 })).toBe(true);
  });

  it("rejects out-of-range and non-finite coordinates", () => {
    expect(isValidLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: 0, lng: -181 })).toBe(false);
    expect(isValidLatLng({ lat: Number.NaN, lng: 0 })).toBe(false);
  });
});

describe("formatDistance", () => {
  it("uses metres under a kilometre and kilometres above", () => {
    expect(formatDistance(42.4)).toBe("42 m");
    expect(formatDistance(1234)).toBe("1.2 km");
    expect(formatDistance(25_400)).toBe("25 km");
  });
});
