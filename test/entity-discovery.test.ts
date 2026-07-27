import { describe, expect, it } from 'vitest';
import {
  autoDetectSnapshot,
  findBestSensor,
  isUnavailable,
  pickWeatherEntity,
  resolveMetric,
  scoreSensorCandidate
} from '../src/data/entity-discovery';
import { METRIC_CATALOG } from '../src/config/metrics';
import type { HassEntity, HomeAssistant } from '../src/types';

function entity(entityId: string, state: string, attributes: Record<string, unknown> = {}): HassEntity {
  return { entity_id: entityId, state, attributes, last_changed: '', last_updated: '' };
}

function makeHass(entities: HassEntity[]): HomeAssistant {
  const states: Record<string, HassEntity> = {};
  for (const item of entities) states[item.entity_id] = item;
  return {
    states,
    locale: { language: 'en' },
    language: 'en',
    config: { latitude: 0, longitude: 0, unit_system: { length: 'km', temperature: '°C', pressure: 'hPa' } },
    themes: {},
    connection: { subscribeMessage: async () => async () => undefined },
    callWS: async () => ({}) as never
  };
}

describe('isUnavailable', () => {
  it('flags unavailable, unknown and missing entities', () => {
    expect(isUnavailable(undefined)).toBe(true);
    expect(isUnavailable(entity('sensor.x', 'unavailable'))).toBe(true);
    expect(isUnavailable(entity('sensor.x', 'unknown'))).toBe(true);
    expect(isUnavailable(entity('sensor.x', '42'))).toBe(false);
  });
});

describe('pickWeatherEntity', () => {
  it('prefers the configured entity when available', () => {
    const hass = makeHass([entity('weather.home', 'sunny'), entity('weather.other', 'rainy')]);
    expect(pickWeatherEntity(hass, 'weather.other')).toBe('weather.other');
  });

  it('falls back to the first available weather entity alphabetically when equally complete', () => {
    const hass = makeHass([entity('weather.zzz', 'sunny'), entity('weather.aaa', 'unavailable')]);
    expect(pickWeatherEntity(hass, 'weather.aaa')).toBe('weather.zzz');
  });

  it('prefers the available weather entity with the richest current data', () => {
    const hass = makeHass([
      entity('weather.aaa', 'sunny', { temperature: 20 }),
      entity('weather.zzz', 'rainy', { temperature: 18, humidity: 80, pressure: 1012 })
    ]);
    expect(pickWeatherEntity(hass)).toBe('weather.zzz');
  });

  it('ignores a configured entity outside the weather domain', () => {
    const hass = makeHass([entity('sensor.fake_weather', 'sunny'), entity('weather.home', 'cloudy')]);
    expect(pickWeatherEntity(hass, 'sensor.fake_weather')).toBe('weather.home');
  });

  it('returns undefined when no weather entity exists', () => {
    const hass = makeHass([entity('sensor.temp', '20')]);
    expect(pickWeatherEntity(hass)).toBeUndefined();
  });
});

describe('scoreSensorCandidate', () => {
  it('rejects entities outside the allowed domain', () => {
    const definition = METRIC_CATALOG.humidity;
    const candidate = entity('binary_sensor.humidity', 'on', { device_class: 'humidity' });
    expect(scoreSensorCandidate(candidate, definition)).toBe(Number.NEGATIVE_INFINITY);
  });

  it('rejects unavailable sensors regardless of matching device class', () => {
    const definition = METRIC_CATALOG.humidity;
    const candidate = entity('sensor.humidity', 'unavailable', { device_class: 'humidity' });
    expect(scoreSensorCandidate(candidate, definition)).toBe(Number.NEGATIVE_INFINITY);
  });

  it('scores device_class matches higher than keyword-only matches', () => {
    const definition = METRIC_CATALOG.pressure;
    const strong = entity('sensor.outdoor_pressure', '1013', { device_class: 'pressure' });
    const weak = entity('sensor.pression_exterieure', '1013', {});
    expect(scoreSensorCandidate(strong, definition)).toBeGreaterThan(scoreSensorCandidate(weak, definition));
  });

  it('does not cross-match unrelated device classes to a metric', () => {
    const definition = METRIC_CATALOG.humidity;
    const candidate = entity('sensor.random', '10', { device_class: 'temperature' });
    expect(scoreSensorCandidate(candidate, definition)).toBe(0);
  });

  it('requires a semantic keyword for ambiguous device classes', () => {
    const genericTemperature = entity('sensor.living_room_temperature', '21', { device_class: 'temperature' });
    const dewPoint = entity('sensor.outdoor_dew_point', '12', { device_class: 'temperature' });
    expect(scoreSensorCandidate(genericTemperature, METRIC_CATALOG.dew_point)).toBe(Number.NEGATIVE_INFINITY);
    expect(scoreSensorCandidate(dewPoint, METRIC_CATALOG.dew_point)).toBeGreaterThan(0);
  });
});

describe('findBestSensor', () => {
  it('deterministically picks the highest scoring sensor, tie-broken alphabetically', () => {
    const hass = makeHass([
      entity('sensor.b_humidity', '50', { device_class: 'humidity' }),
      entity('sensor.a_humidity', '55', { device_class: 'humidity' })
    ]);
    expect(findBestSensor(hass, 'humidity')?.entity_id).toBe('sensor.a_humidity');
  });

  it('returns undefined when nothing scores above zero', () => {
    const hass = makeHass([entity('sensor.random', '5')]);
    expect(findBestSensor(hass, 'humidity')).toBeUndefined();
  });
});

describe('resolveMetric priority', () => {
  it('honors manual mapping over everything else', () => {
    const hass = makeHass([
      entity('weather.home', 'sunny', { humidity: 40 }),
      entity('sensor.humidity_auto', '60', { device_class: 'humidity' }),
      entity('sensor.humidity_manual', '77', { device_class: 'humidity' })
    ]);
    const result = resolveMetric(hass, 'humidity', { humidity: 'sensor.humidity_manual' }, 'weather.home');
    expect(result.source).toBe('manual');
    expect(result.value).toBe('77');
  });

  it('falls back to weather entity attribute when no manual override exists', () => {
    const hass = makeHass([
      entity('weather.home', 'sunny', { humidity: 40 }),
      entity('sensor.humidity_auto', '60', { device_class: 'humidity' })
    ]);
    const result = resolveMetric(hass, 'humidity', {}, 'weather.home');
    expect(result.source).toBe('weather_attribute');
    expect(result.value).toBe(40);
  });

  it('falls back to best-scoring sensor when the weather entity lacks the attribute', () => {
    const hass = makeHass([entity('weather.home', 'sunny', {}), entity('sensor.humidity_auto', '60', { device_class: 'humidity' })]);
    const result = resolveMetric(hass, 'humidity', {}, 'weather.home');
    expect(result.source).toBe('sensor');
    expect(result.entityId).toBe('sensor.humidity_auto');
  });

  it('falls back to sun.sun attributes for sunrise/sunset when nothing else matches', () => {
    const hass = makeHass([
      entity('sensor.unrelated_timestamp', '2024-01-01T04:00:00Z', { device_class: 'timestamp' }),
      entity('sun.sun', 'above_horizon', { next_rising: '2024-01-01T06:00:00Z' })
    ]);
    const result = resolveMetric(hass, 'sunrise', {}, undefined);
    expect(result.source).toBe('sun_attribute');
    expect(result.value).toBe('2024-01-01T06:00:00Z');
  });

  it('returns source none when a manual entity is configured but unavailable', () => {
    const hass = makeHass([entity('sensor.humidity_manual', 'unavailable')]);
    const result = resolveMetric(hass, 'humidity', { humidity: 'sensor.humidity_manual' }, undefined);
    expect(result.source).toBe('none');
  });
});

describe('autoDetectSnapshot', () => {
  it('does not include metrics already satisfied by the weather entity attribute', () => {
    const hass = makeHass([
      entity('weather.home', 'sunny', { humidity: 40 }),
      entity('sensor.humidity_auto', '60', { device_class: 'humidity' })
    ]);
    const snapshot = autoDetectSnapshot(hass, 'weather.home');
    expect(snapshot.entities.humidity).toBeUndefined();
  });

  it('includes sensor entities for metrics with no matching weather attribute', () => {
    const hass = makeHass([entity('weather.home', 'sunny', {}), entity('sensor.aqi', '25', { device_class: 'aqi' })]);
    const snapshot = autoDetectSnapshot(hass, 'weather.home');
    expect(snapshot.entities.air_quality).toBe('sensor.aqi');
  });
});
