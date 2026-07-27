import { describe, expect, it } from 'vitest';
import { CARD_TYPE, defaultConfig, mergeConfig } from '../src/config/defaults';

describe('mergeConfig', () => {
  it('returns full defaults when given undefined', () => {
    const config = mergeConfig(undefined);
    expect(config.type).toBe(CARD_TYPE);
    expect(config.metrics).toHaveLength(17);
    expect(config.metrics.find((metric) => metric.key === 'outdoor_temperature')?.visible).toBe(false);
    expect(config.animation.quality).toBe('medium');
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
