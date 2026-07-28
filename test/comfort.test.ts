/**
 * Unit tests for src/data/comfort.ts
 *
 * Expected values for dew point and absolute humidity are derived from the
 * same August-Roche-Magnus constants used in the implementation (a=17.625,
 * b=243.04, c=611.2 Pa) so tests remain self-consistent without relying on
 * external reference tables.
 */
import { describe, expect, it } from 'vitest';
import {
  absoluteHumidity,
  condensationAnalysis,
  coolingRecommendation,
  dewPoint,
  saturationDistance,
  toCelsius,
  toHectopascals,
  ventilationRecommendation
} from '../src/data/comfort';

// ---------------------------------------------------------------------------
// Helper: reproduce the formulas independently so tests have concrete numbers
// ---------------------------------------------------------------------------
const A = 17.625;
const B = 243.04;
const AH_FACTOR = (611.2 * 18.015) / (8.3143 * 100);

function refDewPoint(t: number, rh: number): number {
  const g = (A * t) / (B + t) + Math.log(rh / 100);
  return (B * g) / (A - g);
}

function refAH(t: number, rh: number): number {
  return (AH_FACTOR * rh * Math.exp((A * t) / (B + t))) / (t + 273.15);
}

// ---------------------------------------------------------------------------
// toCelsius
// ---------------------------------------------------------------------------
describe('toCelsius', () => {
  it('returns the value unchanged for °C', () => {
    expect(toCelsius(20, '°C')).toBe(20);
    expect(toCelsius(-5, '°C')).toBe(-5);
  });

  describe('toHectopascals', () => {
    it('converts the common Home Assistant pressure units', () => {
      expect(toHectopascals(1013.25, 'hPa')).toBeCloseTo(1013.25, 5);
      expect(toHectopascals(1013.25, 'mbar')).toBeCloseTo(1013.25, 5);
      expect(toHectopascals(101325, 'Pa')).toBeCloseTo(1013.25, 5);
      expect(toHectopascals(101.325, 'kPa')).toBeCloseTo(1013.25, 5);
      expect(toHectopascals(29.92, 'inHg')).toBeCloseTo(1013.21, 1);
      expect(toHectopascals(760, 'mmHg')).toBeCloseTo(1013.25, 1);
    });

    it('rejects unknown units and non-finite values', () => {
      expect(toHectopascals(1013, 'psi')).toBeUndefined();
      expect(toHectopascals(NaN, 'hPa')).toBeUndefined();
    });
  });

  it('returns the value unchanged for bare C', () => {
    expect(toCelsius(100, 'C')).toBe(100);
  });

  it('converts °F to °C correctly', () => {
    expect(toCelsius(32, '°F')).toBeCloseTo(0, 5);
    expect(toCelsius(212, '°F')).toBeCloseTo(100, 5);
    expect(toCelsius(98.6, '°F')).toBeCloseTo(37, 5);
    expect(toCelsius(-40, '°F')).toBeCloseTo(-40, 5);
  });

  it('converts bare F to °C correctly', () => {
    expect(toCelsius(32, 'F')).toBeCloseTo(0, 5);
  });

  it('trims whitespace around the unit string', () => {
    expect(toCelsius(0, ' °C')).toBeCloseTo(0, 5);
    expect(toCelsius(32, ' °F ')).toBeCloseTo(0, 5);
  });

  it('returns undefined for an unknown unit', () => {
    expect(toCelsius(100, 'K')).toBeUndefined();
    expect(toCelsius(100, '')).toBeUndefined();
    expect(toCelsius(100, '°X')).toBeUndefined();
  });

  it('returns undefined for non-finite values', () => {
    expect(toCelsius(NaN, '°C')).toBeUndefined();
    expect(toCelsius(Infinity, '°C')).toBeUndefined();
    expect(toCelsius(-Infinity, '°F')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// dewPoint
// ---------------------------------------------------------------------------
describe('dewPoint', () => {
  it('equals the air temperature at 100 % RH', () => {
    expect(dewPoint(20, 100)).toBeCloseTo(20, 3);
    expect(dewPoint(0, 100)).toBeCloseTo(0, 3);
    expect(dewPoint(-10, 100)).toBeCloseTo(-10, 3);
  });

  it('matches reference values for typical indoor conditions', () => {
    // T=20°C, RH=50% → ~9.3°C
    expect(dewPoint(20, 50)).toBeCloseTo(refDewPoint(20, 50), 4);
    // T=20°C, RH=80% → ~16.4°C
    expect(dewPoint(20, 80)).toBeCloseTo(refDewPoint(20, 80), 4);
    // T=25°C, RH=60% → ~16.7°C
    expect(dewPoint(25, 60)).toBeCloseTo(refDewPoint(25, 60), 4);
    // T=30°C, RH=40% → ~15.2°C
    expect(dewPoint(30, 40)).toBeCloseTo(refDewPoint(30, 40), 4);
  });

  it('returns a value below the air temperature for RH < 100', () => {
    for (const [t, rh] of [[20, 50], [25, 70], [15, 90]] as [number, number][]) {
      const dp = dewPoint(t, rh);
      expect(dp).toBeDefined();
      expect(dp!).toBeLessThan(t);
    }
  });

  it('returns undefined for RH = 0', () => {
    expect(dewPoint(20, 0)).toBeUndefined();
  });

  it('returns undefined for RH > 100', () => {
    expect(dewPoint(20, 101)).toBeUndefined();
  });

  it('returns undefined for RH < 0', () => {
    expect(dewPoint(20, -1)).toBeUndefined();
  });

  it('returns undefined for non-finite temperature', () => {
    expect(dewPoint(NaN, 60)).toBeUndefined();
    expect(dewPoint(Infinity, 60)).toBeUndefined();
  });

  it('returns undefined for non-finite RH', () => {
    expect(dewPoint(20, NaN)).toBeUndefined();
    expect(dewPoint(20, Infinity)).toBeUndefined();
  });

  it('does not leak non-finite results for singular temperatures', () => {
    expect(dewPoint(-243.04, 60)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// absoluteHumidity
// ---------------------------------------------------------------------------
describe('absoluteHumidity', () => {
  it('matches reference values for typical conditions', () => {
    expect(absoluteHumidity(20, 60)).toBeCloseTo(refAH(20, 60), 3);
    expect(absoluteHumidity(20, 100)).toBeCloseTo(refAH(20, 100), 3);
    expect(absoluteHumidity(0, 100)).toBeCloseTo(refAH(0, 100), 3);
    expect(absoluteHumidity(30, 50)).toBeCloseTo(refAH(30, 50), 3);
  });

  it('increases with temperature at the same RH', () => {
    const ah10 = absoluteHumidity(10, 80)!;
    const ah20 = absoluteHumidity(20, 80)!;
    expect(ah20).toBeGreaterThan(ah10);
  });

  it('is proportional to RH at the same temperature', () => {
    const ah50 = absoluteHumidity(20, 50)!;
    const ah100 = absoluteHumidity(20, 100)!;
    // Not exactly 2× due to different RH/100 scaling vs. the pSat term
    expect(ah100).toBeCloseTo(ah50 * 2, 3);
  });

  it('returns undefined for RH = 0', () => {
    expect(absoluteHumidity(20, 0)).toBeUndefined();
  });

  it('returns undefined for RH > 100', () => {
    expect(absoluteHumidity(20, 101)).toBeUndefined();
  });

  it('returns undefined for non-finite temperature', () => {
    expect(absoluteHumidity(NaN, 60)).toBeUndefined();
    expect(absoluteHumidity(Infinity, 60)).toBeUndefined();
  });

  it('returns undefined for non-finite RH', () => {
    expect(absoluteHumidity(20, NaN)).toBeUndefined();
  });

  it('does not leak non-finite results for absolute zero', () => {
    expect(absoluteHumidity(-273.15, 60)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// saturationDistance
// ---------------------------------------------------------------------------
describe('saturationDistance', () => {
  it('returns 0 °C at 100 % RH (fully saturated)', () => {
    expect(saturationDistance(20, 100)).toBeCloseTo(0, 10);
  });

  it('uses the temperature minus calculated dew point', () => {
    expect(saturationDistance(20, 50)).toBeCloseTo(10.74, 1);
  });

  it('changes with temperature even at the same relative humidity', () => {
    expect(saturationDistance(30, 60)).not.toBeCloseTo(saturationDistance(5, 60)!, 2);
  });

  it('returns undefined for RH = 0 or negative', () => {
    expect(saturationDistance(20, 0)).toBeUndefined();
    expect(saturationDistance(20, -1)).toBeUndefined();
  });

  it('returns undefined for RH > 100', () => {
    expect(saturationDistance(20, 101)).toBeUndefined();
  });

  it('returns undefined for non-finite inputs', () => {
    expect(saturationDistance(NaN, 50)).toBeUndefined();
    expect(saturationDistance(20, Infinity)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// condensationAnalysis
// ---------------------------------------------------------------------------
describe('condensationAnalysis', () => {
  it('classifies as critical when surface temperature is below the dew point', () => {
    // dew point at 20°C / 80 % RH ≈ 16.4°C, surface = 15°C → margin < 0
    const dp = refDewPoint(20, 80);
    const result = condensationAnalysis(20, 80, 15);
    expect(result).not.toBeNull();
    expect(result!.level).toBe('critical');
    expect(result!.margin).toBeLessThan(0);
    expect(result!.dewPointC).toBeCloseTo(dp, 3);
  });

  it('classifies as warning when margin is between 0 and 3 (inclusive boundaries)', () => {
    const dp = refDewPoint(20, 80); // ≈ 16.4°C
    // surface just above dew point by ~0.5°C → warning
    const surface = dp + 0.5;
    const r = condensationAnalysis(20, 80, surface);
    expect(r!.level).toBe('warning');
    expect(r!.margin).toBeCloseTo(0.5, 3);
  });

  it('classifies as warning at exactly margin = 3', () => {
    const dp = refDewPoint(20, 80);
    const r = condensationAnalysis(20, 80, dp + 3);
    expect(r!.level).toBe('warning');
  });

  it('classifies as safe when margin is above 3', () => {
    const dp = refDewPoint(20, 80);
    const r = condensationAnalysis(20, 80, dp + 3.01);
    expect(r!.level).toBe('safe');
  });

  it('classifies as critical at exactly margin = 0', () => {
    const dp = refDewPoint(20, 80);
    const r = condensationAnalysis(20, 80, dp);
    expect(r!.level).toBe('critical');
    expect(r!.margin).toBeCloseTo(0, 5);
  });

  it('returns undefined for invalid RH', () => {
    expect(condensationAnalysis(20, 0, 15)).toBeUndefined();
    expect(condensationAnalysis(20, 101, 15)).toBeUndefined();
  });

  it('returns undefined for non-finite surface temperature', () => {
    expect(condensationAnalysis(20, 80, NaN)).toBeUndefined();
    expect(condensationAnalysis(20, 80, Infinity)).toBeUndefined();
  });

  it('returns undefined for non-finite indoor temperature', () => {
    expect(condensationAnalysis(NaN, 80, 15)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ventilationRecommendation
// ---------------------------------------------------------------------------
describe('ventilationRecommendation', () => {
  it('recommends open when indoor is wetter than outdoor by at least the threshold', () => {
    const r = ventilationRecommendation(12, 8, 2);
    expect(r!.status).toBe('open');
    expect(r!.delta).toBeCloseTo(4, 5);
  });

  it('recommends avoid when outdoor is wetter than indoor by at least the threshold', () => {
    const r = ventilationRecommendation(8, 12, 2);
    expect(r!.status).toBe('avoid');
    expect(r!.delta).toBeCloseTo(-4, 5);
  });

  it('recommends neutral when difference is below the threshold in both directions', () => {
    const r = ventilationRecommendation(10, 9.5, 2);
    expect(r!.status).toBe('neutral');
  });

  it('recommends open at exactly the threshold (boundary inclusive)', () => {
    const r = ventilationRecommendation(12, 10, 2);
    expect(r!.status).toBe('open');
  });

  it('recommends neutral just below the threshold', () => {
    const r = ventilationRecommendation(11.99, 10, 2);
    expect(r!.status).toBe('neutral');
  });

  it('recommends neutral when threshold is 0 and values are equal', () => {
    const r = ventilationRecommendation(10, 10, 0);
    expect(r!.status).toBe('neutral');
  });

  it('returns indoor/outdoor AH in the result', () => {
    const r = ventilationRecommendation(12, 8, 2)!;
    expect(r.indoorAH).toBe(12);
    expect(r.outdoorAH).toBe(8);
  });

  it('returns undefined for negative indoor AH', () => {
    expect(ventilationRecommendation(-1, 8, 2)).toBeUndefined();
  });

  it('returns undefined for non-finite values', () => {
    expect(ventilationRecommendation(NaN, 8, 2)).toBeUndefined();
    expect(ventilationRecommendation(12, Infinity, 2)).toBeUndefined();
    expect(ventilationRecommendation(12, 8, NaN)).toBeUndefined();
  });

  it('returns undefined for negative threshold', () => {
    expect(ventilationRecommendation(12, 8, -1)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// coolingRecommendation
// ---------------------------------------------------------------------------
describe('coolingRecommendation', () => {
  it('recommends open when indoor > max and outdoor is cooler by delta', () => {
    // indoor=28, max=26, outdoor=22, delta=3 → 28 > 26 and 22 ≤ 28-3=25 ✓
    const r = coolingRecommendation(28, 22, 26, 3);
    expect(r!.status).toBe('open');
  });

  it('recommends avoid when indoor > max but outdoor is not cool enough', () => {
    // indoor=28, max=26, outdoor=26, delta=3 → 26 ≤ 25? No → avoid
    const r = coolingRecommendation(28, 26, 26, 3);
    expect(r!.status).toBe('avoid');
  });

  it('recommends avoid when indoor > max and outdoor is hotter', () => {
    const r = coolingRecommendation(28, 32, 26, 3);
    expect(r!.status).toBe('avoid');
  });

  it('recommends unnecessary when indoor is within the comfortable range', () => {
    const r = coolingRecommendation(24, 20, 26, 3);
    expect(r!.status).toBe('unnecessary');
  });

  it('recommends unnecessary when indoor equals max exactly', () => {
    const r = coolingRecommendation(26, 20, 26, 3);
    expect(r!.status).toBe('unnecessary');
  });

  it('recommends open at exactly the delta boundary', () => {
    // indoor=28, outdoor=25 (=28-3), delta=3 → 25 ≤ 25 → open
    const r = coolingRecommendation(28, 25, 26, 3);
    expect(r!.status).toBe('open');
  });

  it('returns indoor/outdoor temps in the result', () => {
    const r = coolingRecommendation(28, 22, 26, 3)!;
    expect(r.indoorTempC).toBe(28);
    expect(r.outdoorTempC).toBe(22);
  });

  it('returns undefined for non-finite inputs', () => {
    expect(coolingRecommendation(NaN, 22, 26, 3)).toBeUndefined();
    expect(coolingRecommendation(28, Infinity, 26, 3)).toBeUndefined();
    expect(coolingRecommendation(28, 22, NaN, 3)).toBeUndefined();
    expect(coolingRecommendation(28, 22, 26, NaN)).toBeUndefined();
  });

  it('returns undefined for a negative delta', () => {
    expect(coolingRecommendation(28, 22, 26, -1)).toBeUndefined();
  });

  it('works correctly with delta = 0 (any outdoor temp qualifies)', () => {
    // indoor=27 > max=26, outdoor=27 → 27 ≤ 27-0=27 → open
    const r = coolingRecommendation(27, 27, 26, 0);
    expect(r!.status).toBe('open');
  });
});
