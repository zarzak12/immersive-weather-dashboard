/**
 * Unit tests for src/data/solar.ts
 *
 * Reference values are cross-checked against the NOAA Solar Calculator with a
 * tolerance of ~1° / a few minutes, which comfortably covers the low-precision
 * terms of the algorithm.
 */
import { describe, expect, it } from 'vitest';
import { season, solarPosition, sunTimes } from '../src/data/solar';

describe('season', () => {
  it('classifies northern-hemisphere seasons by date', () => {
    expect(season(new Date('2025-01-15T12:00:00Z'), 48)).toBe('winter');
    expect(season(new Date('2025-04-15T12:00:00Z'), 48)).toBe('spring');
    expect(season(new Date('2025-07-15T12:00:00Z'), 48)).toBe('summer');
    expect(season(new Date('2025-10-15T12:00:00Z'), 48)).toBe('autumn');
  });

  it('flips seasons in the southern hemisphere', () => {
    expect(season(new Date('2025-01-15T12:00:00Z'), -33)).toBe('summer');
    expect(season(new Date('2025-07-15T12:00:00Z'), -33)).toBe('winter');
    expect(season(new Date('2025-04-15T12:00:00Z'), -33)).toBe('autumn');
    expect(season(new Date('2025-10-15T12:00:00Z'), -33)).toBe('spring');
  });
});

describe('sunTimes', () => {
  it('gives roughly 12h of daylight at the equator near an equinox', () => {
    const t = sunTimes(new Date('2025-03-20T12:00:00Z'), 0, 0);
    expect(t.polar).toBe('none');
    expect(t.dayLengthMinutes).toBeGreaterThan(715);
    expect(t.dayLengthMinutes).toBeLessThan(735);
    expect(t.sunrise!.getTime()).toBeLessThan(t.solarNoon.getTime());
    expect(t.solarNoon.getTime()).toBeLessThan(t.sunset!.getTime());
  });

  it('is symmetric: solar noon sits at the midpoint of sunrise and sunset', () => {
    const t = sunTimes(new Date('2025-06-21T12:00:00Z'), 48.85, 2.35); // Paris
    const mid = (t.sunrise!.getTime() + t.sunset!.getTime()) / 2;
    expect(Math.abs(mid - t.solarNoon.getTime())).toBeLessThan(60000); // within a minute
  });

  it('reports polar night above the Arctic circle at the December solstice', () => {
    expect(sunTimes(new Date('2025-12-21T12:00:00Z'), 80, 15).polar).toBe('night');
  });

  it('reports polar day above the Arctic circle at the June solstice', () => {
    expect(sunTimes(new Date('2025-06-21T12:00:00Z'), 80, 15).polar).toBe('day');
  });
});

describe('solarPosition', () => {
  it('peaks near the zenith at the equator on an equinox', () => {
    const t = sunTimes(new Date('2025-03-20T12:00:00Z'), 0, 0);
    const noon = solarPosition(t.solarNoon, 0, 0);
    expect(noon.elevation).toBeGreaterThan(88);
    expect(noon.elevation).toBeLessThanOrEqual(90.001);
  });

  it('matches the expected midday elevation at the summer solstice (London)', () => {
    // 90 - (lat - declination) = 90 - (51.48 - 23.44) ≈ 61.96
    const t = sunTimes(new Date('2025-06-21T12:00:00Z'), 51.48, -0.0);
    const noon = solarPosition(t.solarNoon, 51.48, -0.0);
    expect(noon.elevation).toBeGreaterThan(61);
    expect(noon.elevation).toBeLessThan(63);
    expect(noon.azimuth).toBeGreaterThan(177);
    expect(noon.azimuth).toBeLessThan(183); // due south
  });

  it('the sun is near the horizon at computed sunrise and sunset', () => {
    const t = sunTimes(new Date('2025-06-21T12:00:00Z'), 48.85, 2.35);
    expect(Math.abs(solarPosition(t.sunrise!, 48.85, 2.35).elevation + 0.833)).toBeLessThan(1.5);
    expect(Math.abs(solarPosition(t.sunset!, 48.85, 2.35).elevation + 0.833)).toBeLessThan(1.5);
  });

  it('rises in the east in the morning and sets in the west in the afternoon', () => {
    const t = sunTimes(new Date('2025-06-21T12:00:00Z'), 48.85, 2.35);
    const morning = solarPosition(new Date(t.solarNoon.getTime() - 4 * 3600000), 48.85, 2.35);
    const afternoon = solarPosition(new Date(t.solarNoon.getTime() + 4 * 3600000), 48.85, 2.35);
    expect(morning.azimuth).toBeGreaterThan(45);
    expect(morning.azimuth).toBeLessThan(180); // eastern half
    expect(afternoon.azimuth).toBeGreaterThan(180);
    expect(afternoon.azimuth).toBeLessThan(315); // western half
  });

  it('always returns an azimuth in [0, 360)', () => {
    for (let h = 0; h < 24; h += 3) {
      const pos = solarPosition(new Date(Date.UTC(2025, 8, 21, h)), 48.85, 2.35);
      expect(pos.azimuth).toBeGreaterThanOrEqual(0);
      expect(pos.azimuth).toBeLessThan(360);
    }
  });

  it('puts the noon sun to the north in the southern hemisphere', () => {
    const t = sunTimes(new Date('2025-06-21T12:00:00Z'), -33.87, 151.21); // Sydney
    const noon = solarPosition(t.solarNoon, -33.87, 151.21);
    expect(noon.azimuth < 5 || noon.azimuth > 355).toBe(true); // due north
  });
});
