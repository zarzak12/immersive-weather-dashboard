/**
 * Unit tests for src/data/moon.ts
 *
 * Illumination/phase are checked against well-known 2025 lunar phase instants
 * (UTC) with tolerances comfortably wider than the low-precision algorithm's
 * error. Position/times are checked for physical ranges and internal
 * consistency rather than exact reference values.
 */
import { describe, expect, it } from 'vitest';
import { moonIllumination, moonPosition, moonTimes } from '../src/data/moon';

describe('moonIllumination', () => {
  it('is (nearly) full at the January 2025 full moon', () => {
    const m = moonIllumination(new Date('2025-01-13T22:27:00Z'));
    expect(m.fraction).toBeGreaterThan(0.97);
    expect(m.phaseName).toBe('full_moon');
  });

  it('is (nearly) dark at the January 2025 new moon', () => {
    const m = moonIllumination(new Date('2025-01-29T12:36:00Z'));
    expect(m.fraction).toBeLessThan(0.03);
    expect(m.phaseName).toBe('new_moon');
  });

  it('is half-lit and waxing at the first quarter', () => {
    const m = moonIllumination(new Date('2025-02-05T08:02:00Z'));
    expect(m.fraction).toBeGreaterThan(0.45);
    expect(m.fraction).toBeLessThan(0.55);
    expect(m.waxing).toBe(true);
    expect(m.phaseName).toBe('first_quarter');
  });

  it('is half-lit and waning at the last quarter', () => {
    const m = moonIllumination(new Date('2025-02-20T17:32:00Z'));
    expect(m.fraction).toBeGreaterThan(0.45);
    expect(m.fraction).toBeLessThan(0.55);
    expect(m.waxing).toBe(false);
    expect(m.phaseName).toBe('last_quarter');
  });

  it('is a waxing gibbous between first quarter and full moon', () => {
    const m = moonIllumination(new Date('2025-02-08T12:00:00Z'));
    expect(m.waxing).toBe(true);
    expect(m.fraction).toBeGreaterThan(0.5);
    expect(m.fraction).toBeLessThan(0.97);
    expect(m.phaseName).toBe('waxing_gibbous');
  });

  it('is a waning gibbous between full moon and last quarter', () => {
    const m = moonIllumination(new Date('2025-02-16T12:00:00Z'));
    expect(m.waxing).toBe(false);
    expect(m.fraction).toBeGreaterThan(0.5);
    expect(m.fraction).toBeLessThan(0.97);
    expect(m.phaseName).toBe('waning_gibbous');
  });

  it('keeps fraction and phase within [0, 1]', () => {
    for (let day = 0; day < 30; day += 1) {
      const m = moonIllumination(new Date(Date.UTC(2025, 5, 1 + day)));
      expect(m.fraction).toBeGreaterThanOrEqual(0);
      expect(m.fraction).toBeLessThanOrEqual(1);
      expect(m.phase).toBeGreaterThanOrEqual(0);
      expect(m.phase).toBeLessThanOrEqual(1);
    }
  });
});

describe('moonPosition', () => {
  it('returns physically sane azimuth, elevation and distance', () => {
    for (let h = 0; h < 24; h += 2) {
      const p = moonPosition(new Date(Date.UTC(2025, 5, 15, h)), 48.85, 2.35);
      expect(p.azimuth).toBeGreaterThanOrEqual(0);
      expect(p.azimuth).toBeLessThan(360);
      expect(p.elevation).toBeGreaterThanOrEqual(-90);
      expect(p.elevation).toBeLessThanOrEqual(90);
      expect(p.distanceKm).toBeGreaterThan(356000);
      expect(p.distanceKm).toBeLessThan(407000);
    }
  });
});

describe('moonTimes', () => {
  const within = (t: Date | undefined, start: Date): boolean => {
    if (!t) return true;
    return t.getTime() >= start.getTime() && t.getTime() <= start.getTime() + 26 * 3600000;
  };

  it('returns rise/set within the local day and never both up-and-down flags', () => {
    for (let day = 10; day <= 20; day += 1) {
      const date = new Date(2025, 5, day, 12, 0, 0);
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const t = moonTimes(date, 48.85, 2.35);

      expect(t.alwaysUp && t.alwaysDown).toBe(false);
      expect(within(t.moonrise, start)).toBe(true);
      expect(within(t.moonset, start)).toBe(true);
      if (t.alwaysUp || t.alwaysDown) {
        expect(t.moonrise).toBeUndefined();
        expect(t.moonset).toBeUndefined();
      }
    }
  });
});
