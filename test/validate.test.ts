import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config/defaults';
import { validateConfig } from '../src/config/validate';
import type { HassEntity, HomeAssistant } from '../src/types';

function entity(entityId: string, state: string): HassEntity {
  return { entity_id: entityId, state, attributes: {}, last_changed: '', last_updated: '' };
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

describe('validateConfig', () => {
  it('reports no issues for a valid default configuration without hass', () => {
    expect(validateConfig(defaultConfig(), undefined)).toEqual([]);
  });

  it('flags a configured weather entity that does not exist', () => {
    const hass = makeHass([]);
    const config = { ...defaultConfig(), weather_entity: 'weather.missing' };
    const issues = validateConfig(config, hass);
    expect(issues.some((issue) => issue.field === 'weather_entity')).toBe(true);
  });

  it('flags a weather_entity field pointing to a non-weather domain', () => {
    const hass = makeHass([entity('sensor.not_weather', '20')]);
    const config = { ...defaultConfig(), weather_entity: 'sensor.not_weather' };
    const issues = validateConfig(config, hass);
    expect(issues.some((issue) => issue.field === 'weather_entity')).toBe(true);
  });

  it('flags manual entity overrides pointing to missing entities', () => {
    const hass = makeHass([]);
    const config = { ...defaultConfig(), entities: { humidity: 'sensor.missing' } };
    const issues = validateConfig(config, hass);
    expect(issues.some((issue) => issue.field === 'entities.humidity')).toBe(true);
  });

  it('flags out-of-range appearance and animation values', () => {
    const config = {
      ...defaultConfig(),
      appearance: { ...defaultConfig().appearance, panel_opacity: 1.5, min_height: 50 },
      animation: { ...defaultConfig().animation, intensity: 5 }
    };
    const issues = validateConfig(config, undefined);
    expect(issues.length).toBeGreaterThanOrEqual(3);
  });
});
