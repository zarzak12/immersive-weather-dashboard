import type { HomeAssistant } from '../types';

const COMPASS_POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/** Converts a wind bearing in degrees to a compass point label (e.g. 90 -> "E"). */
export function bearingToCompass(bearing: number): string {
  const normalized = ((bearing % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return COMPASS_POINTS[index];
}

/** Formats a numeric value with a unit, rounding to a sensible precision. */
export function formatNumber(value: unknown, unit?: string, decimals = 0): string {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (typeof numeric !== 'number' || Number.isNaN(numeric)) return '—';
  const rounded = decimals > 0 ? numeric.toFixed(decimals) : Math.round(numeric).toString();
  return unit ? `${rounded} ${unit}` : rounded;
}

/** Formats an ISO datetime or timestamp as a localized time string (e.g. sunrise/sunset). */
export function formatTime(value: unknown, language: string | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(language || 'en', { hour: 'numeric', minute: '2-digit' }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

/** Formats an ISO datetime as a short weekday label for daily forecasts. */
export function formatWeekday(value: string, language: string | undefined): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(language || 'en', { weekday: 'short' }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

/** Formats an ISO datetime as a short hour label for hourly forecasts. */
export function formatHour(value: string, language: string | undefined): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(language || 'en', { hour: 'numeric' }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

/** Formats a temperature value using the Home Assistant configured unit when the sensor's own unit is unknown. */
export function formatTemperature(value: unknown, hass: HomeAssistant | undefined, explicitUnit?: string): string {
  const unit = explicitUnit ?? hass?.config.unit_system.temperature ?? '°C';
  return formatNumber(value, unit, 0);
}

/** Formats a percentage-like value (humidity, cloud coverage, probability). */
export function formatPercent(value: unknown): string {
  return formatNumber(value, '%', 0);
}

/** Converts a wind speed value expressed in a given unit to kilometers per hour, best-effort. */
export function convertToKmh(value: unknown, unit: string | undefined): number {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (typeof numeric !== 'number' || Number.isNaN(numeric)) return 0;
  const normalizedUnit = (unit ?? 'km/h').toLowerCase();
  if (normalizedUnit.includes('mph')) return numeric * 1.60934;
  if (normalizedUnit.includes('m/s')) return numeric * 3.6;
  if (normalizedUnit.includes('kn')) return numeric * 1.852;
  return numeric;
}
