/**
 * Pure comfort-analysis functions.
 *
 * All functions are side-effect-free and suitable for use on every render.
 * Invalid inputs (non-finite numbers, out-of-range values) return `undefined`
 * rather than NaN so callers can safely pattern-match on result type.
 *
 * Thermodynamic constants follow the August-Roche-Magnus approximation
 * (Alduchov & Eskridge 1996):
 *   a = 17.625
 *   b = 243.04 °C
 *   c = 611.2 Pa  (saturation vapour pressure at 0 °C)
 */

/** Magnus formula constants. */
const MAGNUS_A = 17.625;
const MAGNUS_B = 243.04; // °C

/** Water molar mass (g/mol) / gas constant (J/mol/K) × 100 (for RH as %). */
const AH_FACTOR = (611.2 * 18.015) / (8.3143 * 100); // ≈ 13.233

// ---------------------------------------------------------------------------
// Unit conversion
// ---------------------------------------------------------------------------

/**
 * Converts a temperature value to Celsius given its unit string.
 *
 * Recognised units: `'°C'`, `'C'` (pass-through), `'°F'`, `'F'`.
 * Returns `undefined` for any other unit string or for a non-finite value.
 */
export function toCelsius(value: number, unit: string): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  switch (unit.trim()) {
    case '°C':
    case 'C':
      return value;
    case '°F':
    case 'F':
      return ((value - 32) * 5) / 9;
    default:
      return undefined;
  }
}

/**
 * Converts common atmospheric-pressure units to hectopascals.
 */
export function toHectopascals(value: number, unit: string): number | undefined {
  if (!Number.isFinite(value)) return undefined;

  switch (unit.trim().toLowerCase()) {
    case 'hpa':
    case 'mbar':
    case 'mb':
      return value;
    case 'pa':
      return value / 100;
    case 'kpa':
      return value * 10;
    case 'inhg':
      return value * 33.8638866667;
    case 'mmhg':
      return value * 1.33322387415;
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Core thermodynamic functions
// ---------------------------------------------------------------------------

/**
 * Dew-point temperature (°C) using the August-Roche-Magnus formula.
 *
 * @param tempC   Air temperature in °C (must be finite).
 * @param rh      Relative humidity in % (must be in the range 0 < rh ≤ 100).
 * @returns       Dew-point temperature in °C, or `undefined` for invalid input.
 */
export function dewPoint(tempC: number, rh: number): number | undefined {
  if (!Number.isFinite(tempC)) return undefined;
  if (!Number.isFinite(rh) || rh <= 0 || rh > 100) return undefined;

  const gamma = (MAGNUS_A * tempC) / (MAGNUS_B + tempC) + Math.log(rh / 100);
  const result = (MAGNUS_B * gamma) / (MAGNUS_A - gamma);
  return Number.isFinite(result) ? result : undefined;
}

/**
 * Absolute humidity (g/m³) using the August-Roche-Magnus saturation vapour
 * pressure and the ideal-gas law.
 *
 * @param tempC  Air temperature in °C (must be finite).
 * @param rh     Relative humidity in % (must be in the range 0 < rh ≤ 100).
 * @returns      Absolute humidity in g/m³, or `undefined` for invalid input.
 */
export function absoluteHumidity(tempC: number, rh: number): number | undefined {
  if (!Number.isFinite(tempC)) return undefined;
  if (!Number.isFinite(rh) || rh <= 0 || rh > 100) return undefined;

  const pSat = Math.exp((MAGNUS_A * tempC) / (MAGNUS_B + tempC)); // relative, scaled by c
  const result = (AH_FACTOR * rh * pSat) / (tempC + 273.15);
  return Number.isFinite(result) && result >= 0 ? result : undefined;
}

/**
 * Temperature-to-dew-point spread (°C). A smaller spread means the air is
 * closer to saturation at its current temperature.
 */
export function saturationDistance(tempC: number, rh: number): number | undefined {
  const dp = dewPoint(tempC, rh);
  return dp === undefined ? undefined : tempC - dp;
}

// ---------------------------------------------------------------------------
// Condensation analysis
// ---------------------------------------------------------------------------

/** Classification of the condensation risk on a surface. */
export type CondensationLevel = 'critical' | 'warning' | 'safe';

/** Full result of a condensation analysis. */
export interface CondensationResult {
  /** Dew point of the indoor air (°C). */
  dewPointC: number;
  /** Difference between surface temperature and dew point (°C). ≤ 0 means condensation. */
  margin: number;
  /** Risk classification. */
  level: CondensationLevel;
}

/**
 * Analyses condensation risk on a surface.
 *
 * @param indoorTempC    Indoor air temperature (°C).
 * @param indoorRH       Indoor relative humidity (%).
 * @param surfaceTempC   Temperature of the surface to analyse (°C).
 * @returns              `CondensationResult`, or `undefined` for invalid input.
 */
export function condensationAnalysis(
  indoorTempC: number,
  indoorRH: number,
  surfaceTempC: number
): CondensationResult | undefined {
  const dp = dewPoint(indoorTempC, indoorRH);
  if (dp === undefined) return undefined;
  if (!Number.isFinite(surfaceTempC)) return undefined;

  const margin = surfaceTempC - dp;
  const level: CondensationLevel = margin <= 0 ? 'critical' : margin <= 3 ? 'warning' : 'safe';
  return { dewPointC: dp, margin, level };
}

// ---------------------------------------------------------------------------
// Ventilation recommendation
// ---------------------------------------------------------------------------

/** Ventilation recommendation status. */
export type VentilationStatus = 'open' | 'avoid' | 'neutral';

/** Result of a ventilation recommendation. */
export interface VentilationResult {
  /** Indoor absolute humidity (g/m³). */
  indoorAH: number;
  /** Outdoor absolute humidity (g/m³). */
  outdoorAH: number;
  /** Difference indoorAH − outdoorAH (positive means indoor is wetter). */
  delta: number;
  /** Recommendation. */
  status: VentilationStatus;
}

/**
 * Recommends whether to open windows based on the absolute-humidity difference
 * between indoor and outdoor air.
 *
 * - `'open'`   — outdoor air is drier by at least `thresholdGm3` g/m³: ventilating
 *                will lower indoor humidity.
 * - `'avoid'`  — outdoor air is wetter by at least `thresholdGm3` g/m³: ventilating
 *                would raise indoor humidity.
 * - `'neutral'`— difference is below the threshold in either direction.
 *
 * @param indoorAH      Indoor absolute humidity (g/m³, must be finite and ≥ 0).
 * @param outdoorAH     Outdoor absolute humidity (g/m³, must be finite and ≥ 0).
 * @param thresholdGm3  Minimum absolute difference to trigger a recommendation
 *                      (must be finite and ≥ 0; typically the configured
 *                      `ventilation_humidity_delta`).
 * @returns             `VentilationResult`, or `undefined` for invalid input.
 */
export function ventilationRecommendation(
  indoorAH: number,
  outdoorAH: number,
  thresholdGm3: number
): VentilationResult | undefined {
  if (!Number.isFinite(indoorAH) || indoorAH < 0) return undefined;
  if (!Number.isFinite(outdoorAH) || outdoorAH < 0) return undefined;
  if (!Number.isFinite(thresholdGm3) || thresholdGm3 < 0) return undefined;

  const delta = indoorAH - outdoorAH;
  let status: VentilationStatus;
  if (delta > 0 && delta >= thresholdGm3) {
    status = 'open';
  } else if (delta < 0 && -delta >= thresholdGm3) {
    status = 'avoid';
  } else {
    status = 'neutral';
  }

  return { indoorAH, outdoorAH, delta, status };
}

// ---------------------------------------------------------------------------
// Cooling recommendation
// ---------------------------------------------------------------------------

/** Cooling recommendation status. */
export type CoolingStatus = 'open' | 'avoid' | 'unnecessary';

/** Result of a cooling recommendation. */
export interface CoolingResult {
  /** Indoor temperature (°C). */
  indoorTempC: number;
  /** Outdoor temperature (°C). */
  outdoorTempC: number;
  /** Recommendation. */
  status: CoolingStatus;
}

/**
 * Recommends whether to open windows to cool the room.
 *
 * - `'open'`        — indoor temperature exceeds `maxTempC` and outdoor air is
 *                     cooler by at least `deltaTempC`: opening will help.
 * - `'unnecessary'` — indoor temperature is at or below `maxTempC`: no cooling needed.
 * - `'avoid'`       — indoor is too warm but outdoor is not cool enough to help
 *                     (or is hotter).
 *
 * @param indoorTempC   Indoor air temperature (°C, must be finite).
 * @param outdoorTempC  Outdoor air temperature (°C, must be finite).
 * @param maxTempC      Upper threshold of the comfortable range (°C, must be finite).
 * @param deltaTempC    Minimum °C by which outdoor must be cooler than indoor
 *                      (must be finite and ≥ 0).
 * @returns             `CoolingResult`, or `undefined` for invalid input.
 */
export function coolingRecommendation(
  indoorTempC: number,
  outdoorTempC: number,
  maxTempC: number,
  deltaTempC: number
): CoolingResult | undefined {
  if (!Number.isFinite(indoorTempC)) return undefined;
  if (!Number.isFinite(outdoorTempC)) return undefined;
  if (!Number.isFinite(maxTempC)) return undefined;
  if (!Number.isFinite(deltaTempC) || deltaTempC < 0) return undefined;

  let status: CoolingStatus;
  if (indoorTempC <= maxTempC) {
    status = 'unnecessary';
  } else if (outdoorTempC <= indoorTempC - deltaTempC) {
    status = 'open';
  } else {
    status = 'avoid';
  }

  return { indoorTempC, outdoorTempC, status };
}
