import { describe, expect, it } from 'vitest';
import { CARD_TYPE, defaultConfig, mergeConfig } from '../src/config/defaults';

describe('mergeConfig', () => {
  it('returns full defaults when given undefined', () => {
    const config = mergeConfig(undefined);
    expect(config.type).toBe(CARD_TYPE);
    expect(config.metrics).toHaveLength(16);
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
    expect(config.metrics).toHaveLength(16);
  });

  it('ignores metric entries with an invalid key rather than throwing', () => {
    const config = mergeConfig({
      // @ts-expect-error intentionally invalid key to test robustness
      metrics: [{ key: 'not_a_real_metric', visible: false }]
    });
    expect(config.metrics).toHaveLength(16);
  });

  it('merges manual entity overrides without dropping existing ones', () => {
    const config = mergeConfig({ entities: { humidity: 'sensor.custom_humidity' } });
    expect(config.entities.humidity).toBe('sensor.custom_humidity');
  });
});
