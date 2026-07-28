/**
 * Pure solar-geometry functions (no side effects, no network).
 *
 * Implements the NOAA solar position algorithm (the same math as the NOAA
 * Solar Calculator spreadsheet), accurate to well under a degree for dates
 * around the present era. All functions take a plain `Date` (interpreted as a
 * UTC instant, which is exactly what `Date.getTime()` represents) plus a
 * latitude/longitude in decimal degrees (longitude east-positive), and return
 * either angles in degrees or `Date` instants that callers format in the local
 * timezone.
 *
 * These are intentionally standalone (no imports) so they stay trivially
 * testable and reusable.
 */

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Instantaneous solar elevation (altitude) and azimuth, both in degrees. */
export interface SolarPosition {
  /** Elevation above the horizon in degrees (negative below the horizon). */
  elevation: number;
  /** Azimuth in degrees, measured clockwise from true north (0 = N, 90 = E, 180 = S, 270 = W). */
  azimuth: number;
}

/** Whether the sun stays permanently above/below the horizon for the day. */
export type PolarState = 'none' | 'day' | 'night';

/** Key solar times for a given calendar day. */
export interface SunTimes {
  /** Sunrise instant, or `undefined` during a polar day/night. */
  sunrise?: Date;
  /** Solar noon (sun transit) instant — always defined. */
  solarNoon: Date;
  /** Sunset instant, or `undefined` during a polar day/night. */
  sunset?: Date;
  /** Length of daylight in minutes, or `undefined` during a polar day/night. */
  dayLengthMinutes?: number;
  /** `'none'` on an ordinary day, `'day'`/`'night'` when the sun never sets/rises. */
  polar: PolarState;
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * Day-level solar parameters (declination and equation of time) derived once
 * from a Date. The declination and equation of time change only slowly through
 * a day, so callers evaluate them at the relevant instant.
 */
function solarParameters(date: Date): { declination: number; eqTimeMinutes: number } {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const t = (jd - 2451545.0) / 36525; // Julian centuries since J2000.0

  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360; // geometric mean longitude
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t); // geometric mean anomaly
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t); // eccentricity

  const mRad = m * RAD;
  const c =
    Math.sin(mRad) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * mRad) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * mRad) * 0.000289; // equation of center

  const trueLong = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  const lambda = (trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD)) * RAD; // apparent longitude

  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const eps0 = 23 + (26 + seconds / 60) / 60; // mean obliquity of the ecliptic
  const epsCorr = (eps0 + 0.00256 * Math.cos(omega * RAD)) * RAD; // corrected obliquity

  const declination = Math.asin(Math.sin(epsCorr) * Math.sin(lambda)) * DEG;

  const y = Math.tan(epsCorr / 2) ** 2;
  const l0Rad = l0 * RAD;
  const eqTimeMinutes =
    4 *
    DEG *
    (y * Math.sin(2 * l0Rad) -
      2 * e * Math.sin(mRad) +
      4 * e * y * Math.sin(mRad) * Math.cos(2 * l0Rad) -
      0.5 * y * y * Math.sin(4 * l0Rad) -
      1.25 * e * e * Math.sin(2 * mRad));

  return { declination, eqTimeMinutes };
}

/**
 * Computes the sun's elevation and azimuth for a UTC instant at a location.
 *
 * @param date  The instant to evaluate (UTC, as stored by `Date`).
 * @param latitude   Latitude in decimal degrees (north positive).
 * @param longitude  Longitude in decimal degrees (east positive).
 */
export function solarPosition(date: Date, latitude: number, longitude: number): SolarPosition {
  const { declination, eqTimeMinutes } = solarParameters(date);

  const utcMinutes =
    date.getUTCHours() * 60 +
    date.getUTCMinutes() +
    date.getUTCSeconds() / 60 +
    date.getUTCMilliseconds() / 60000;

  let trueSolarTime = (utcMinutes + eqTimeMinutes + 4 * longitude) % 1440;
  if (trueSolarTime < 0) trueSolarTime += 1440;
  const hourAngle = trueSolarTime / 4 - 180; // degrees, negative before solar noon

  const latRad = latitude * RAD;
  const decRad = declination * RAD;
  const haRad = hourAngle * RAD;

  const cosZenith = clamp(
    Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad),
    -1,
    1
  );
  const zenith = Math.acos(cosZenith);
  const elevation = 90 - zenith * DEG;

  const denom = Math.cos(latRad) * Math.sin(zenith);
  let azimuth: number;
  if (Math.abs(denom) > 1e-6) {
    const cosAz = clamp((Math.sin(latRad) * Math.cos(zenith) - Math.sin(decRad)) / denom, -1, 1);
    const az = Math.acos(cosAz) * DEG;
    azimuth = hourAngle > 0 ? (az + 180) % 360 : (540 - az) % 360;
  } else {
    azimuth = latitude >= 0 ? 180 : 0;
  }

  return { elevation, azimuth };
}

/**
 * Computes sunrise, solar noon and sunset for the UTC calendar day containing
 * `date`. The `Date` instants returned are formatted by callers in the local
 * timezone. Handles polar day/night by returning the corresponding `polar`
 * state with `sunrise`/`sunset` left undefined.
 *
 * Uses the standard −0.833° geometric sunrise/sunset altitude (accounting for
 * atmospheric refraction and the solar disc radius).
 */
export function sunTimes(date: Date, latitude: number, longitude: number): SunTimes {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const dayStartUTC = Date.UTC(year, month, day);

  // Evaluate the slowly-varying day parameters near local solar noon for stability.
  const { declination, eqTimeMinutes } = solarParameters(new Date(Date.UTC(year, month, day, 12)));

  const solarNoonUTCMin = 720 - 4 * longitude - eqTimeMinutes;
  const solarNoon = new Date(dayStartUTC + solarNoonUTCMin * 60000);

  const latRad = latitude * RAD;
  const decRad = declination * RAD;
  const cosHourAngle =
    (Math.cos(90.833 * RAD) - Math.sin(latRad) * Math.sin(decRad)) / (Math.cos(latRad) * Math.cos(decRad));

  if (cosHourAngle > 1) {
    return { solarNoon, polar: 'night' }; // sun never rises
  }
  if (cosHourAngle < -1) {
    return { solarNoon, polar: 'day' }; // sun never sets
  }

  const hourAngle = Math.acos(cosHourAngle) * DEG;
  const sunrise = new Date(dayStartUTC + (solarNoonUTCMin - 4 * hourAngle) * 60000);
  const sunset = new Date(dayStartUTC + (solarNoonUTCMin + 4 * hourAngle) * 60000);
  const dayLengthMinutes = 8 * hourAngle;

  return { sunrise, solarNoon, sunset, dayLengthMinutes, polar: 'none' };
}

const OPPOSITE_SEASON: Record<Season, Season> = {
  spring: 'autumn',
  autumn: 'spring',
  summer: 'winter',
  winter: 'summer'
};

/**
 * Astronomical season for a date, flipped for the southern hemisphere.
 * Uses fixed approximate equinox/solstice boundaries (accurate to a day or so),
 * which is more than enough for a display label.
 */
export function season(date: Date, latitude: number): Season {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  let northern: Season;
  if (md >= 321 && md <= 620) northern = 'spring';
  else if (md >= 621 && md <= 921) northern = 'summer';
  else if (md >= 922 && md <= 1220) northern = 'autumn';
  else northern = 'winter';
  return latitude < 0 ? OPPOSITE_SEASON[northern] : northern;
}
