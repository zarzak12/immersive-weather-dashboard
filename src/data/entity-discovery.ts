import type { HassEntity, HomeAssistant, ManualEntityMap, MetricKey } from '../types';
import { METRIC_CATALOG } from '../config/metrics';

export type MetricSource = 'manual' | 'weather_attribute' | 'sensor' | 'sun_attribute' | 'none';

export interface ResolvedMetric {
  key: MetricKey;
  source: MetricSource;
  value: unknown;
  unit?: string;
  entityId?: string;
}

const UNAVAILABLE_STATES = new Set(['unavailable', 'unknown', '', null, undefined]);
const WEATHER_DATA_ATTRIBUTES = [
  'temperature',
  'apparent_temperature',
  'humidity',
  'pressure',
  'wind_speed',
  'wind_bearing',
  'wind_gust_speed',
  'visibility',
  'dew_point',
  'cloud_coverage',
  'uv_index',
  'ozone'
] as const;

export function isUnavailable(entity: HassEntity | undefined): boolean {
  if (!entity) return true;
  return UNAVAILABLE_STATES.has(entity.state as never);
}

function domainOf(entityId: string): string {
  return entityId.split('.', 1)[0];
}

/**
 * Picks the best available weather entity. Honors the preferred entity if it
 * still exists and is available, otherwise falls back to the first available
 * `weather.*` entity with the richest current data, with deterministic
 * alphabetical tie-breaking.
 */
export function pickWeatherEntity(hass: HomeAssistant, preferred?: string): string | undefined {
  if (preferred && domainOf(preferred) === 'weather' && hass.states[preferred] && !isUnavailable(hass.states[preferred])) {
    return preferred;
  }
  const candidates = Object.values(hass.states)
    .filter((entity) => domainOf(entity.entity_id) === 'weather' && !isUnavailable(entity))
    .sort((a, b) => {
      const score = (entity: HassEntity) =>
        WEATHER_DATA_ATTRIBUTES.reduce(
          (total, attribute) => total + (entity.attributes[attribute] !== undefined && entity.attributes[attribute] !== null ? 1 : 0),
          0
        );
      return score(b) - score(a) || a.entity_id.localeCompare(b.entity_id);
    });
  return candidates[0]?.entity_id;
}

/**
 * Scores how well a sensor entity matches a metric definition. Returns
 * Number.NEGATIVE_INFINITY for entities that must never be picked (wrong
 * domain or unavailable state), 0 for no meaningful match, and a positive
 * number for increasingly confident matches.
 */
export function scoreSensorCandidate(entity: HassEntity, definition: (typeof METRIC_CATALOG)[MetricKey]): number {
  if (isUnavailable(entity)) return Number.NEGATIVE_INFINITY;
  if (!definition.domains.includes(domainOf(entity.entity_id))) return Number.NEGATIVE_INFINITY;

  let score = 0;
  const deviceClass = entity.attributes.device_class;
  if (deviceClass && definition.deviceClasses.includes(deviceClass)) {
    score += 10;
  }

  const entityId = entity.entity_id.toLowerCase();
  const friendlyName = (entity.attributes.friendly_name ?? '').toLowerCase();
  let keywordMatched = false;
  for (const keyword of definition.keywords) {
    if (entityId.includes(keyword)) {
      score += 5;
      keywordMatched = true;
    }
    if (friendlyName.includes(keyword)) {
      score += 3;
      keywordMatched = true;
    }
  }

  if (definition.keywordRequired && !keywordMatched) return Number.NEGATIVE_INFINITY;
  return score;
}

/** Finds the best-scoring sensor entity for a metric, or undefined if none qualifies. */
export function findBestSensor(hass: HomeAssistant, key: MetricKey): HassEntity | undefined {
  const definition = METRIC_CATALOG[key];
  let best: HassEntity | undefined;
  let bestScore = 0;

  for (const entityId of Object.keys(hass.states).sort()) {
    const entity = hass.states[entityId];
    const score = scoreSensorCandidate(entity, definition);
    if (score > bestScore) {
      bestScore = score;
      best = entity;
    }
  }

  return best;
}

/**
 * Resolves the value/source for a single metric following the priority:
 * manual mapping > weather entity attribute > best-scoring sensor > sun entity
 * (sunrise/sunset only) > unavailable.
 */
export function resolveMetric(
  hass: HomeAssistant,
  key: MetricKey,
  manualEntities: ManualEntityMap,
  weatherEntityId: string | undefined
): ResolvedMetric {
  const manualId = manualEntities[key];
  if (manualId) {
    const entity = hass.states[manualId];
    if (entity && !isUnavailable(entity)) {
      return { key, source: 'manual', value: entity.state, unit: entity.attributes.unit_of_measurement, entityId: manualId };
    }
    return { key, source: 'none', value: undefined, entityId: manualId };
  }

  const definition = METRIC_CATALOG[key];
  if (definition.weatherAttribute && weatherEntityId) {
    const weatherEntity = hass.states[weatherEntityId];
    const value = weatherEntity?.attributes[definition.weatherAttribute];
    if (value !== undefined && value !== null) {
      return { key, source: 'weather_attribute', value, entityId: weatherEntityId };
    }
  }

  const sensor = findBestSensor(hass, key);
  if (sensor) {
    return { key, source: 'sensor', value: sensor.state, unit: sensor.attributes.unit_of_measurement, entityId: sensor.entity_id };
  }

  if (key === 'sunrise' || key === 'sunset') {
    const sun = hass.states['sun.sun'];
    if (sun && !isUnavailable(sun)) {
      const attribute = key === 'sunrise' ? 'next_rising' : 'next_setting';
      const value = sun.attributes[attribute];
      if (value) {
        return { key, source: 'sun_attribute', value, entityId: 'sun.sun' };
      }
    }
  }

  return { key, source: 'none', value: undefined };
}

/** Resolves every supported metric at once. */
export function resolveAllMetrics(
  hass: HomeAssistant,
  manualEntities: ManualEntityMap,
  weatherEntityId: string | undefined
): Record<MetricKey, ResolvedMetric> {
  const keys = Object.keys(METRIC_CATALOG) as MetricKey[];
  const result = {} as Record<MetricKey, ResolvedMetric>;
  for (const key of keys) {
    result[key] = resolveMetric(hass, key, manualEntities, weatherEntityId);
  }
  return result;
}

export interface AutoConfigureResult {
  weatherEntity?: string;
  entities: ManualEntityMap;
}

/**
 * Computes a snapshot of currently auto-detected entities suitable for a
 * one-time "Auto-configure" save action. This never mutates configuration by
 * itself; the caller decides whether to persist the result.
 */
export function autoDetectSnapshot(hass: HomeAssistant, preferredWeatherEntity?: string): AutoConfigureResult {
  const weatherEntity = pickWeatherEntity(hass, preferredWeatherEntity);
  const entities: ManualEntityMap = {};
  const keys = Object.keys(METRIC_CATALOG) as MetricKey[];
  for (const key of keys) {
    const definition = METRIC_CATALOG[key];
    if (definition.weatherAttribute && weatherEntity) {
      const value = hass.states[weatherEntity]?.attributes[definition.weatherAttribute];
      if (value !== undefined && value !== null) continue;
    }
    const sensor = findBestSensor(hass, key);
    if (sensor) {
      entities[key] = sensor.entity_id;
    }
  }
  return { weatherEntity, entities };
}
