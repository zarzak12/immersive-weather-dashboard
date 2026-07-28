import { describe, expect, it } from 'vitest';
import { CARD_TYPE, DEFAULT_COMFORT, defaultConfig, mergeConfig } from '../src/config/defaults';

describe('mergeConfig', () => {
  it('returns full defaults when given undefined', () => {
    const config = mergeConfig(undefined);
    expect(config.type).toBe(CARD_TYPE);
    expect(config.metrics).toHaveLength(17);
    expect(config.metrics.find((metric) => metric.key === 'outdoor_temperature')?.visible).toBe(false);
    expect(config.animation.quality).toBe('medium');
    expect(config.scene).toMatchObject({
      image_fit: 'cover',
      image_scale: 1,
      image_position_x: 50,
      image_position_y: 100
    });
  });

  it('preserves unrelated defaults when only a partial field is provided', () => {
    const config = mergeConfig({ title: 'Home' });
    expect(config.title).toBe('Home');
    expect(config.appearance).toEqual(defaultConfig().appearance);
    expect(config.forecast).toEqual(defaultConfig().forecast);
  });

  it('merges nested partial objects instead of replacing them wholesale', () => {
    const config = mergeConfig({ animation: { intensity: 1.5 } });
    expect(config.animation.intensity).toBe(1.5);
    expect(config.animation.quality).toBe('medium');
    expect(config.animation.enabled).toBe(true);
  });

  it('merges and bounds image framing settings', () => {
    const config = mergeConfig({
      scene: { image_fit: 'contain', image_scale: 4, image_position_x: -10, image_position_y: 35 }
    });
    expect(config.scene).toMatchObject({
      mode: 'auto',
      image_fit: 'contain',
      image_scale: 2,
      image_position_x: 0,
      image_position_y: 35
    });
  });

  it('keeps unknown/legacy metric entries safe and merges known metric overrides', () => {
    const config = mergeConfig({
      metrics: [{ key: 'humidity', visible: false, label: 'Humidité' }]
    });
    const humidity = config.metrics.find((m) => m.key === 'humidity');
    expect(humidity?.visible).toBe(false);
    expect(humidity?.label).toBe('Humidité');
    expect(config.metrics).toHaveLength(17);
  });

  it('ignores metric entries with an invalid key rather than throwing', () => {
    const config = mergeConfig({
      // @ts-expect-error intentionally invalid key to test robustness
      metrics: [{ key: 'not_a_real_metric', visible: false }]
    });
    expect(config.metrics).toHaveLength(17);
  });

  it('merges manual entity overrides without dropping existing ones', () => {
    const config = mergeConfig({ entities: { humidity: 'sensor.custom_humidity' } });
    expect(config.entities.humidity).toBe('sensor.custom_humidity');
  });

  it('defaults environment_zones and alerts to empty arrays', () => {
    const config = mergeConfig(undefined);
    expect(config.environment_zones).toEqual([]);
    expect(config.alerts).toEqual([]);
  });

  it('sanitizes environment zones, dropping entries without a stable id and unknown entity keys', () => {
    const config = mergeConfig({
      environment_zones: [
        { id: 'zone-1', name: 'Living room', kind: 'indoor', entities: { temperature: 'sensor.living_temp', co2: 'sensor.living_co2' } },
        { name: 'No id', kind: 'outdoor' }
      ]
    });
    expect(config.environment_zones).toHaveLength(1);
    expect(config.environment_zones[0]).toMatchObject({
      id: 'zone-1',
      name: 'Living room',
      kind: 'indoor',
      visible: true,
      entities: { temperature: 'sensor.living_temp', co2: 'sensor.living_co2' }
    });
  });

  it('defaults an invalid zone kind to indoor rather than throwing', () => {
    const config = mergeConfig({
      // @ts-expect-error intentionally invalid kind
      environment_zones: [{ id: 'zone-1', kind: 'not_a_kind' }]
    });
    expect(config.environment_zones[0].kind).toBe('indoor');
  });

  it('sanitizes alert rules and their conditions, dropping entries without a stable id', () => {
    const config = mergeConfig({
      alerts: [
        {
          id: 'alert-1',
          name: 'Open windows',
          message: 'Open the windows',
          severity: 'warning',
          logic: 'all',
          conditions: [
            { id: 'cond-1', entity_id: 'sensor.co2', operator: 'gt', threshold: 1000 },
            { entity_id: 'sensor.no_id', operator: 'lt', threshold: 5 }
          ]
        },
        { name: 'No id rule' }
      ]
    });
    expect(config.alerts).toHaveLength(1);
    expect(config.alerts[0].conditions).toHaveLength(1);
    expect(config.alerts[0]).toMatchObject({ id: 'alert-1', enabled: true, severity: 'warning', logic: 'all' });
    expect(config.alerts[0].conditions[0]).toMatchObject({ id: 'cond-1', entity_id: 'sensor.co2', operator: 'gt', threshold: 1000 });
  });

  it('falls back to safe defaults for invalid alert enum values', () => {
    const config = mergeConfig({
      alerts: [
        {
          id: 'alert-1',
          // @ts-expect-error intentionally invalid severity
          severity: 'not_a_severity',
          // @ts-expect-error intentionally invalid logic
          logic: 'not_a_logic',
          conditions: [
            // @ts-expect-error intentionally invalid operator
            { id: 'cond-1', entity_id: 'sensor.x', operator: 'not_an_operator', threshold: 'not_a_number' }
          ]
        }
      ]
    });
    expect(config.alerts[0].severity).toBe('info');
    expect(config.alerts[0].logic).toBe('all');
    expect(config.alerts[0].conditions[0].operator).toBe('gt');
    expect(config.alerts[0].conditions[0].threshold).toBe(0);
  });

  it('preserves a new alert condition while its entity is still being entered', () => {
    const config = mergeConfig({
      alerts: [{ id: 'alert-1', conditions: [{ id: 'cond-1', entity_id: '', operator: 'gt', threshold: 0 }] }]
    });
    expect(config.alerts[0].conditions).toEqual([{ id: 'cond-1', entity_id: '', operator: 'gt', threshold: 0 }]);
  });
});

describe('mergeConfig — comfort', () => {
  it('includes disabled comfort defaults when comfort is not provided', () => {
    const config = mergeConfig(undefined);
    expect(config.comfort).toEqual(DEFAULT_COMFORT);
    expect(config.comfort.enabled).toBe(false);
  });

  it('defaultConfig includes comfort with disabled flag', () => {
    const config = defaultConfig();
    expect(config.comfort.enabled).toBe(false);
    expect(config.comfort.indoor_temperature_min).toBe(18);
    expect(config.comfort.indoor_temperature_max).toBe(26);
    expect(config.comfort.glazing_factor).toBe(0.15);
  });

  it('enables comfort when explicitly set', () => {
    const config = mergeConfig({ comfort: { enabled: true } });
    expect(config.comfort.enabled).toBe(true);
    // unrelated defaults are preserved
    expect(config.comfort.glazing_factor).toBe(0.15);
  });

  it('preserves unrelated defaults when only a partial comfort object is given', () => {
    const config = mergeConfig({ comfort: { indoor_temperature_max: 24 } });
    expect(config.comfort.indoor_temperature_max).toBe(24);
    expect(config.comfort.indoor_temperature_min).toBe(DEFAULT_COMFORT.indoor_temperature_min);
    expect(config.comfort.indoor_humidity_min).toBe(DEFAULT_COMFORT.indoor_humidity_min);
    expect(config.comfort.ventilation_humidity_delta).toBe(DEFAULT_COMFORT.ventilation_humidity_delta);
  });

  it('stores indoor_zone as an empty string by default', () => {
    const config = mergeConfig(undefined);
    expect(config.comfort.indoor_zone).toBe('');
  });

  it('stores an explicit indoor_zone id', () => {
    const config = mergeConfig({ comfort: { indoor_zone: 'zone-living' } });
    expect(config.comfort.indoor_zone).toBe('zone-living');
  });

  it('omits surface_temperature_entity when not set', () => {
    const config = mergeConfig(undefined);
    expect(config.comfort.surface_temperature_entity).toBeUndefined();
  });

  it('stores a valid surface_temperature_entity string', () => {
    const config = mergeConfig({ comfort: { surface_temperature_entity: 'sensor.window_temp' } });
    expect(config.comfort.surface_temperature_entity).toBe('sensor.window_temp');
  });

  it('drops a surface_temperature_entity that is an empty string', () => {
    const config = mergeConfig({ comfort: { surface_temperature_entity: '' } });
    expect(config.comfort.surface_temperature_entity).toBeUndefined();
  });

  it('clamps indoor_temperature_min/max to −10…40', () => {
    const config = mergeConfig({ comfort: { indoor_temperature_min: -20, indoor_temperature_max: 50 } });
    expect(config.comfort.indoor_temperature_min).toBe(-10);
    expect(config.comfort.indoor_temperature_max).toBe(40);
  });

  it('clamps indoor_humidity_min/max to 0…100', () => {
    const config = mergeConfig({ comfort: { indoor_humidity_min: -5, indoor_humidity_max: 110 } });
    expect(config.comfort.indoor_humidity_min).toBe(0);
    expect(config.comfort.indoor_humidity_max).toBe(100);
  });

  it('normalizes an inverted temperature range by swapping min and max', () => {
    const config = mergeConfig({ comfort: { indoor_temperature_min: 30, indoor_temperature_max: 20 } });
    expect(config.comfort.indoor_temperature_min).toBe(20);
    expect(config.comfort.indoor_temperature_max).toBe(30);
  });

  it('normalizes an inverted humidity range by swapping min and max', () => {
    const config = mergeConfig({ comfort: { indoor_humidity_min: 70, indoor_humidity_max: 40 } });
    expect(config.comfort.indoor_humidity_min).toBe(40);
    expect(config.comfort.indoor_humidity_max).toBe(70);
  });

  it('clamps ventilation_humidity_delta to 0…20', () => {
    const hi = mergeConfig({ comfort: { ventilation_humidity_delta: 99 } });
    expect(hi.comfort.ventilation_humidity_delta).toBe(20);
    const lo = mergeConfig({ comfort: { ventilation_humidity_delta: -1 } });
    expect(lo.comfort.ventilation_humidity_delta).toBe(0);
  });

  it('clamps cooling_temperature_delta to 0…20', () => {
    const hi = mergeConfig({ comfort: { cooling_temperature_delta: 50 } });
    expect(hi.comfort.cooling_temperature_delta).toBe(20);
    const lo = mergeConfig({ comfort: { cooling_temperature_delta: -5 } });
    expect(lo.comfort.cooling_temperature_delta).toBe(0);
  });

  it('clamps glazing_factor to 0…1', () => {
    const hi = mergeConfig({ comfort: { glazing_factor: 5 } });
    expect(hi.comfort.glazing_factor).toBe(1);
    const lo = mergeConfig({ comfort: { glazing_factor: -0.1 } });
    expect(lo.comfort.glazing_factor).toBe(0);
  });

  it('falls back to default for non-finite numeric comfort fields', () => {
    const config = mergeConfig({
      comfort: {
        indoor_temperature_min: NaN,
        indoor_temperature_max: Infinity,
        ventilation_humidity_delta: NaN,
        glazing_factor: NaN
      }
    });
    expect(config.comfort.indoor_temperature_min).toBe(DEFAULT_COMFORT.indoor_temperature_min);
    expect(config.comfort.indoor_temperature_max).toBe(DEFAULT_COMFORT.indoor_temperature_max);
    expect(config.comfort.ventilation_humidity_delta).toBe(DEFAULT_COMFORT.ventilation_humidity_delta);
    expect(config.comfort.glazing_factor).toBe(DEFAULT_COMFORT.glazing_factor);
  });

  it('does not affect other top-level config sections when only comfort changes', () => {
    const config = mergeConfig({ comfort: { enabled: true, glazing_factor: 0.3 } });
    expect(config.animation).toEqual(defaultConfig().animation);
    expect(config.appearance).toEqual(defaultConfig().appearance);
    expect(config.alerts).toEqual([]);
  });
});
