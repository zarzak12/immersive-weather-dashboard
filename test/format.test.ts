import { describe, expect, it } from 'vitest';
import { bearingToCompass, convertToKmh, formatNumber, formatPercent, formatTemperature } from '../src/data/format';

describe('bearingToCompass', () => {
  it('maps cardinal degrees to compass points', () => {
    expect(bearingToCompass(0)).toBe('N');
    expect(bearingToCompass(90)).toBe('E');
    expect(bearingToCompass(180)).toBe('S');
    expect(bearingToCompass(270)).toBe('W');
  });

  it('normalizes out-of-range and negative bearings', () => {
    expect(bearingToCompass(360)).toBe('N');
    expect(bearingToCompass(-90)).toBe('W');
  });
});

describe('formatNumber', () => {
  it('renders an em-dash for invalid input', () => {
    expect(formatNumber(undefined)).toBe('—');
    expect(formatNumber('not-a-number')).toBe('—');
  });

  it('rounds and appends unit', () => {
    expect(formatNumber(12.345, 'hPa', 1)).toBe('12.3 hPa');
    expect(formatNumber('7.8', '%')).toBe('8 %');
  });
});

describe('formatPercent', () => {
  it('appends a percent sign', () => {
    expect(formatPercent(55)).toBe('55 %');
  });
});

describe('formatTemperature', () => {
  it('falls back to the HA configured unit when no explicit unit is given', () => {
    const hass = { config: { unit_system: { temperature: '°F' } } } as never;
    expect(formatTemperature(70, hass)).toBe('70 °F');
  });

  it('prefers an explicit unit over the HA default', () => {
    const hass = { config: { unit_system: { temperature: '°F' } } } as never;
    expect(formatTemperature(21, hass, '°C')).toBe('21 °C');
  });
});

describe('convertToKmh', () => {
  it('converts mph and m/s to km/h', () => {
    expect(convertToKmh(10, 'mph')).toBeCloseTo(16.0934, 3);
    expect(convertToKmh(10, 'm/s')).toBeCloseTo(36, 3);
  });

  it('assumes km/h when unit is missing or already km/h', () => {
    expect(convertToKmh(10, undefined)).toBe(10);
    expect(convertToKmh(10, 'km/h')).toBe(10);
  });

  it('returns 0 for non-numeric values', () => {
    expect(convertToKmh('n/a', 'km/h')).toBe(0);
  });
});
