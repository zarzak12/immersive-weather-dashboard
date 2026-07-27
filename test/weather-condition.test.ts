import { describe, expect, it } from 'vitest';
import { conditionToScene, isDaytime, isExplicitNightCondition } from '../src/data/weather-condition';
import type { HassEntity, HomeAssistant } from '../src/types';

function makeHass(sunState?: string): HomeAssistant {
  const states: Record<string, HassEntity> = {};
  if (sunState) {
    states['sun.sun'] = { entity_id: 'sun.sun', state: sunState, attributes: {}, last_changed: '', last_updated: '' };
  }
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

describe('conditionToScene', () => {
  it('maps known conditions to their scene category', () => {
    expect(conditionToScene('pouring')).toBe('pouring');
    expect(conditionToScene('lightning-rainy')).toBe('thunderstorm');
    expect(conditionToScene('snowy-rainy')).toBe('snowy-rainy');
  });

  it('defaults to clear when condition is undefined and cloudy for unknown strings', () => {
    expect(conditionToScene(undefined)).toBe('clear');
    expect(conditionToScene('made-up-condition')).toBe('cloudy');
  });
});

describe('isExplicitNightCondition', () => {
  it('only flags clear-night', () => {
    expect(isExplicitNightCondition('clear-night')).toBe(true);
    expect(isExplicitNightCondition('sunny')).toBe(false);
  });
});

describe('isDaytime', () => {
  it('honors forced day/night scene modes regardless of sun state', () => {
    const hass = makeHass('below_horizon');
    expect(isDaytime(hass, 'day')).toBe(true);
    expect(isDaytime(hass, 'night')).toBe(false);
  });

  it('uses the sun.sun entity for auto mode when available', () => {
    expect(isDaytime(makeHass('above_horizon'), 'auto')).toBe(true);
    expect(isDaytime(makeHass('below_horizon'), 'auto')).toBe(false);
  });

  it('treats clear-night condition as night even if sun.sun says otherwise', () => {
    expect(isDaytime(makeHass('above_horizon'), 'auto', 'clear-night')).toBe(false);
  });
});
