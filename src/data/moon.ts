/**
 * Pure lunar-geometry functions (no side effects, no network).
 *
 * Implements the standard low-precision Meeus / SunCalc formulas for the moon's
 * horizontal position, its illuminated fraction and phase, and its rise/set
 * times. All functions take a plain `Date` (a UTC instant) plus latitude and
 * longitude in decimal degrees (longitude east-positive). Angles are returned
 * in degrees; rise/set are `Date` instants that callers format locally.
 *
 * Accuracy is a few arc-minutes for position and a few percent for phase —
 * ample for a dashboard display. Kept standalone (no imports) so it stays
 * trivially testable and mirrors src/data/solar.ts.
 */

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;
const OBLIQUITY = 23.4397 * RAD; // mean obliquity of the ecliptic
const SUN_DISTANCE_KM = 149598000; // 1 AU

export interface MoonPosition {
  /** Elevation above the horizon in degrees (refraction-corrected). */
  elevation: number;
  /** Azimuth in degrees clockwise from true north (0 = N, 90 = E, 180 = S, 270 = W). */
  azimuth: number;
  /** Distance to the moon in kilometers. */
  distanceKm: number;
}

export type MoonPhaseName =
  | 'new_moon'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full_moon'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent';

export interface MoonIllumination {
  /** Illuminated fraction of the disc, 0 (new) … 1 (full). */
  fraction: number;
  /** Phase 0 … 1: 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter. */
  phase: number;
  /** Named phase bucket. */
  phaseName: MoonPhaseName;
  /** True while the illuminated fraction is increasing (new → full). */
  waxing: boolean;
}

export interface MoonTimes {
  /** Moonrise for the local day, or `undefined` when there is none. */
  moonrise?: Date;
  /** Moonset for the local day, or `undefined` when there is none. */
  moonset?: Date;
  /** The moon stays above the horizon for the whole local day. */
  alwaysUp: boolean;
  /** The moon stays below the horizon for the whole local day. */
  alwaysDown: boolean;
}

/** Days since the J2000.0 epoch (2000-01-01 12:00 TT). */
function toDays(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5 - 2451545.0;
}

function rightAscension(eclipticLon: number, eclipticLat: number): number {
  return Math.atan2(
    Math.sin(eclipticLon) * Math.cos(OBLIQUITY) - Math.tan(eclipticLat) * Math.sin(OBLIQUITY),
    Math.cos(eclipticLon)
  );
}

function declination(eclipticLon: number, eclipticLat: number): number {
  return Math.asin(
    Math.sin(eclipticLat) * Math.cos(OBLIQUITY) + Math.cos(eclipticLat) * Math.sin(OBLIQUITY) * Math.sin(eclipticLon)
  );
}

/** Azimuth measured from due south, positive toward the west (radians). */
function azimuthFromSouth(hourAngle: number, lat: number, dec: number): number {
  return Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat));
}

function altitude(hourAngle: number, lat: number, dec: number): number {
  return Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle));
}

/** Local mean sidereal time (radians) for the observer's west-longitude `lw`. */
function siderealTime(days: number, lw: number): number {
  return RAD * (280.16 + 360.9856235 * days) - lw;
}

/** Approximate atmospheric refraction (radians) for an apparent altitude `h` (radians). */
function astroRefraction(h: number): number {
  const hh = h < 0 ? 0 : h;
  return 0.0002967 / Math.tan(hh + 0.00312536 / (hh + 0.08901179));
}

/** Sun equatorial coordinates (radians), needed for the phase calculation. */
function sunCoords(days: number): { ra: number; dec: number } {
  const m = RAD * (357.5291 + 0.98560028 * days); // mean anomaly
  const l = m + RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m)) + RAD * 102.9372 + Math.PI;
  return { ra: rightAscension(l, 0), dec: declination(l, 0) };
}

/** Moon equatorial coordinates (radians) and distance (km). */
function moonCoords(days: number): { ra: number; dec: number; dist: number } {
  const l = RAD * (218.316 + 13.176396 * days); // ecliptic longitude
  const m = RAD * (134.963 + 13.064993 * days); // mean anomaly
  const f = RAD * (93.272 + 13.2293 * days); // mean distance / argument of latitude

  const lon = l + RAD * 6.289 * Math.sin(m); // geocentric ecliptic longitude
  const lat = RAD * 5.128 * Math.sin(f); // geocentric ecliptic latitude
  const dist = 385001 - 20905 * Math.cos(m); // distance to the moon in km

  return { ra: rightAscension(lon, lat), dec: declination(lon, lat), dist };
}

/**
 * Computes the moon's elevation, azimuth and distance for a UTC instant.
 */
export function moonPosition(date: Date, latitude: number, longitude: number): MoonPosition {
  const lw = RAD * -longitude;
  const phi = RAD * latitude;
  const days = toDays(date);

  const c = moonCoords(days);
  const hourAngle = siderealTime(days, lw) - c.ra;
  let h = altitude(hourAngle, phi, c.dec);
  h += astroRefraction(h); // altitude correction for refraction

  const azSouth = azimuthFromSouth(hourAngle, phi, c.dec);
  let azimuth = (azSouth * DEG + 180) % 360; // convert to clockwise-from-north
  if (azimuth < 0) azimuth += 360;

  return { elevation: h * DEG, azimuth, distanceKm: c.dist };
}

function phaseNameFor(phase: number): MoonPhaseName {
  if (phase < 0.0345 || phase >= 0.9655) return 'new_moon';
  if (phase < 0.2155) return 'waxing_crescent';
  if (phase < 0.2845) return 'first_quarter';
  if (phase < 0.4655) return 'waxing_gibbous';
  if (phase < 0.5345) return 'full_moon';
  if (phase < 0.7155) return 'waning_gibbous';
  if (phase < 0.7845) return 'last_quarter';
  return 'waning_crescent';
}

/**
 * Computes the moon's illuminated fraction and phase.
 */
export function moonIllumination(date: Date): MoonIllumination {
  const days = toDays(date);
  const s = sunCoords(days);
  const m = moonCoords(days);

  // Geocentric elongation of the moon from the sun.
  const elongation = Math.acos(
    Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra)
  );
  // Phase angle (sun–moon–earth).
  const inc = Math.atan2(SUN_DISTANCE_KM * Math.sin(elongation), m.dist - SUN_DISTANCE_KM * Math.cos(elongation));
  // Position angle of the bright limb: its sign distinguishes waxing from waning.
  const angle = Math.atan2(
    Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra)
  );

  const fraction = (1 + Math.cos(inc)) / 2;
  const phase = 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI;

  return { fraction, phase, phaseName: phaseNameFor(phase), waxing: phase < 0.5 };
}

function hoursLater(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3600000);
}

/**
 * Computes moonrise and moonset for the local calendar day containing `date`.
 *
 * Because the moon's declination changes quickly, this samples its altitude in
 * two-hour steps across the day and locates the horizon crossings by quadratic
 * interpolation (the standard SunCalc approach). The rise/set altitude of
 * 0.133° accounts for refraction and the mean lunar parallax.
 */
export function moonTimes(date: Date, latitude: number, longitude: number): MoonTimes {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0); // local midnight

  const hc = 0.133; // rise/set altitude threshold in degrees
  let h0 = moonPosition(start, latitude, longitude).elevation - hc;
  let rise: number | undefined;
  let set: number | undefined;
  let ye = 0;

  for (let i = 1; i <= 24; i += 2) {
    const h1 = moonPosition(hoursLater(start, i), latitude, longitude).elevation - hc;
    const h2 = moonPosition(hoursLater(start, i + 1), latitude, longitude).elevation - hc;

    const a = (h0 + h2) / 2 - h1;
    const b = (h2 - h0) / 2;
    if (a !== 0) {
      const xe = -b / (2 * a);
      ye = (a * xe + b) * xe + h1;
      const d = b * b - 4 * a * h1;
      let roots = 0;
      let x1 = 0;
      let x2 = 0;
      if (d >= 0) {
        const dx = Math.sqrt(d) / (Math.abs(a) * 2);
        x1 = xe - dx;
        x2 = xe + dx;
        if (Math.abs(x1) <= 1) roots += 1;
        if (Math.abs(x2) <= 1) roots += 1;
        if (x1 < -1) x1 = x2;
      }

      if (roots === 1) {
        if (h0 < 0) rise = i + x1;
        else set = i + x1;
      } else if (roots === 2) {
        rise = i + (ye < 0 ? x2 : x1);
        set = i + (ye < 0 ? x1 : x2);
      }
    } else {
      ye = h1;
    }

    if (rise !== undefined && set !== undefined) break;
    h0 = h2;
  }

  const result: MoonTimes = { alwaysUp: false, alwaysDown: false };
  if (rise !== undefined) result.moonrise = hoursLater(start, rise);
  if (set !== undefined) result.moonset = hoursLater(start, set);
  if (rise === undefined && set === undefined) {
    if (ye > 0) result.alwaysUp = true;
    else result.alwaysDown = true;
  }
  return result;
}
