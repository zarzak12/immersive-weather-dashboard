import type {
  AnimationConfig,
  AppearanceConfig,
  ForecastConfig,
  ImmersiveWeatherCardConfig,
  MetricConfig,
  MetricKey,
  PartialImmersiveWeatherCardConfig,
  SceneConfig
} from '../types';
import { METRIC_KEYS } from '../types';

export const CARD_TYPE = 'custom:immersive-weather-dashboard';

export const DEFAULT_ANIMATION: AnimationConfig = {
  enabled: true,
  quality: 'medium',
  intensity: 1,
  respect_reduced_motion: true
};

export const DEFAULT_SCENE: SceneConfig = {
  mode: 'auto'
};

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  panel_opacity: 0.55,
  panel_blur: 12,
  panel_radius: 18,
  accent_color: '#7ec8ff',
  text_color: '#ffffff',
  min_height: 480,
  aspect_ratio: '',
  density: 'comfortable'
};

export const DEFAULT_FORECAST: ForecastConfig = {
  show_hourly: true,
  show_daily: true,
  hourly_count: 12,
  daily_count: 5
};

export function defaultMetrics(): MetricConfig[] {
  return METRIC_KEYS.map((key, index) => ({
    key,
    visible: true,
    order: index
  }));
}

export function defaultConfig(): ImmersiveWeatherCardConfig {
  return {
    type: CARD_TYPE,
    title: '',
    weather_entity: undefined,
    image_url: undefined,
    entities: {},
    animation: { ...DEFAULT_ANIMATION },
    scene: { ...DEFAULT_SCENE },
    appearance: { ...DEFAULT_APPEARANCE },
    forecast: { ...DEFAULT_FORECAST },
    metrics: defaultMetrics()
  };
}

function isMetricKey(value: string): value is MetricKey {
  return (METRIC_KEYS as readonly string[]).includes(value);
}

function mergeMetrics(input: Partial<MetricConfig>[] | undefined): MetricConfig[] {
  const base = defaultMetrics();
  if (!input || input.length === 0) return base;

  const byKey = new Map<MetricKey, MetricConfig>(base.map((m) => [m.key, m]));
  input.forEach((partial, index) => {
    if (!partial.key || !isMetricKey(partial.key)) return;
    const existing = byKey.get(partial.key) ?? { key: partial.key, visible: true, order: index };
    byKey.set(partial.key, {
      key: partial.key,
      visible: partial.visible ?? existing.visible,
      order: partial.order ?? existing.order,
      label: partial.label ?? existing.label,
      color: partial.color ?? existing.color,
      icon: partial.icon ?? existing.icon
    });
  });
  return Array.from(byKey.values()).sort((a, b) => a.order - b.order);
}

/**
 * Merges a partial/legacy configuration with defaults so older or hand-written
 * configs keep rendering safely after upgrades.
 */
export function mergeConfig(input: PartialImmersiveWeatherCardConfig | undefined): ImmersiveWeatherCardConfig {
  const base = defaultConfig();
  if (!input) return base;

  return {
    type: input.type ?? base.type,
    title: input.title ?? base.title,
    weather_entity: input.weather_entity ?? base.weather_entity,
    image_url: input.image_url ?? base.image_url,
    entities: { ...base.entities, ...(input.entities ?? {}) },
    animation: { ...base.animation, ...(input.animation ?? {}) },
    scene: { ...base.scene, ...(input.scene ?? {}) },
    appearance: { ...base.appearance, ...(input.appearance ?? {}) },
    forecast: { ...base.forecast, ...(input.forecast ?? {}) },
    metrics: mergeMetrics(input.metrics)
  };
}
