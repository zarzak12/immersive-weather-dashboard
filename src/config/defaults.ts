import type {
  AlertRuleConfig,
  AnimationConfig,
  AppearanceConfig,
  EnvironmentZoneConfig,
  EnvironmentZoneEntities,
  ForecastConfig,
  ImmersiveWeatherCardConfig,
  MetricConfig,
  MetricKey,
  PartialAlertConditionConfig,
  PartialAlertRuleConfig,
  PartialEnvironmentZoneConfig,
  PartialImmersiveWeatherCardConfig,
  SceneConfig
} from '../types';
import { ALERT_LOGICS, ALERT_OPERATORS, ALERT_SEVERITIES, ENVIRONMENT_ZONE_ENTITY_KEYS, METRIC_KEYS } from '../types';

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
    visible: key !== 'outdoor_temperature',
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
    metrics: defaultMetrics(),
    environment_zones: [],
    alerts: []
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function sanitizeZoneEntities(input: EnvironmentZoneEntities | undefined): EnvironmentZoneEntities {
  const result: EnvironmentZoneEntities = {};
  if (!input) return result;
  for (const key of ENVIRONMENT_ZONE_ENTITY_KEYS) {
    const value = input[key];
    if (isNonEmptyString(value)) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Sanitizes a partial/legacy list of environment zones. Zones without a
 * stable `id` are dropped rather than guessed, since ids are used to target
 * updates/removals from the editor.
 */
function mergeEnvironmentZones(input: PartialEnvironmentZoneConfig[] | undefined): EnvironmentZoneConfig[] {
  if (!input || input.length === 0) return [];
  const zones: EnvironmentZoneConfig[] = [];
  for (const zone of input) {
    if (!isNonEmptyString(zone.id)) continue;
    zones.push({
      id: zone.id,
      name: zone.name ?? '',
      kind: zone.kind === 'outdoor' ? 'outdoor' : 'indoor',
      visible: zone.visible ?? true,
      entities: sanitizeZoneEntities(zone.entities)
    });
  }
  return zones;
}

function isAlertOperator(value: unknown): value is (typeof ALERT_OPERATORS)[number] {
  return (ALERT_OPERATORS as readonly string[]).includes(value as string);
}

function isAlertSeverity(value: unknown): value is (typeof ALERT_SEVERITIES)[number] {
  return (ALERT_SEVERITIES as readonly string[]).includes(value as string);
}

function isAlertLogic(value: unknown): value is (typeof ALERT_LOGICS)[number] {
  return (ALERT_LOGICS as readonly string[]).includes(value as string);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function mergeAlertConditions(input: PartialAlertConditionConfig[] | undefined) {
  if (!input || input.length === 0) return [];
  const conditions = [];
  for (const condition of input) {
    if (!isNonEmptyString(condition.id)) continue;
    conditions.push({
      id: condition.id,
      entity_id: typeof condition.entity_id === 'string' ? condition.entity_id : '',
      operator: isAlertOperator(condition.operator) ? condition.operator : ('gt' as const),
      threshold: isFiniteNumber(condition.threshold) ? condition.threshold : 0,
      threshold2: isFiniteNumber(condition.threshold2) ? condition.threshold2 : undefined
    });
  }
  return conditions;
}

/**
 * Sanitizes a partial/legacy list of alert rules. Rules/conditions without a
 * stable `id` are dropped since ids are used to target updates/removals from
 * the editor.
 */
function mergeAlerts(input: PartialAlertRuleConfig[] | undefined): AlertRuleConfig[] {
  if (!input || input.length === 0) return [];
  const alerts: AlertRuleConfig[] = [];
  for (const rule of input) {
    if (!isNonEmptyString(rule.id)) continue;
    alerts.push({
      id: rule.id,
      enabled: rule.enabled ?? true,
      name: rule.name ?? '',
      message: rule.message ?? '',
      severity: isAlertSeverity(rule.severity) ? rule.severity : 'info',
      logic: isAlertLogic(rule.logic) ? rule.logic : 'all',
      conditions: mergeAlertConditions(rule.conditions)
    });
  }
  return alerts;
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
    metrics: mergeMetrics(input.metrics),
    environment_zones: mergeEnvironmentZones(input.environment_zones),
    alerts: mergeAlerts(input.alerts)
  };
}
