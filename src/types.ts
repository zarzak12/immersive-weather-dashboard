/** Shared type definitions for Home Assistant objects and card configuration. */

export interface HassEntityAttributes {
  friendly_name?: string;
  unit_of_measurement?: string;
  device_class?: string;
  [key: string]: unknown;
}

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: HassEntityAttributes;
  last_changed: string;
  last_updated: string;
}

export interface HassLocale {
  language: string;
}

export interface HassConfig {
  latitude: number;
  longitude: number;
  unit_system: {
    length: string;
    temperature: string;
    pressure: string;
    wind_speed?: string;
  };
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  locale: HassLocale;
  language: string;
  config: HassConfig;
  themes: { darkMode?: boolean };
  connection: {
    subscribeMessage<T>(
      callback: (result: T) => void,
      message: Record<string, unknown>
    ): Promise<() => Promise<void>>;
  };
  callWS<T>(message: Record<string, unknown>): Promise<T>;
  localize?: (key: string, ...args: unknown[]) => string;
}

export type AnimationQuality = 'low' | 'medium' | 'high';
export type SceneMode = 'auto' | 'day' | 'night';
export type ImageFit = 'cover' | 'contain';
export type Density = 'comfortable' | 'compact';

export const METRIC_KEYS = [
  'outdoor_temperature',
  'apparent_temperature',
  'humidity',
  'pressure',
  'wind_speed',
  'wind_bearing',
  'wind_gust',
  'precipitation',
  'precipitation_probability',
  'uv_index',
  'visibility',
  'dew_point',
  'cloud_coverage',
  'ozone',
  'air_quality',
  'sunrise',
  'sunset'
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export interface MetricConfig {
  key: MetricKey;
  visible: boolean;
  order: number;
  label?: string;
  color?: string;
  icon?: string;
}

export type ManualEntityMap = Partial<Record<MetricKey, string>>;

export interface AnimationConfig {
  enabled: boolean;
  quality: AnimationQuality;
  intensity: number;
  respect_reduced_motion: boolean;
}

export interface SceneConfig {
  mode: SceneMode;
  image_fit: ImageFit;
  image_scale: number;
  image_position_x: number;
  image_position_y: number;
}

export interface AppearanceConfig {
  panel_opacity: number;
  panel_blur: number;
  panel_radius: number;
  accent_color: string;
  text_color: string;
  min_height: number;
  aspect_ratio: string;
  density: Density;
}

export interface ForecastConfig {
  show_hourly: boolean;
  show_daily: boolean;
  hourly_count: number;
  daily_count: number;
}

/** Environmental zone kinds: an indoor room or an outdoor location. */
export type EnvironmentZoneKind = 'indoor' | 'outdoor';

export const ENVIRONMENT_ZONE_ENTITY_KEYS = ['temperature', 'humidity', 'aqi', 'co2', 'pm2_5', 'pm10', 'voc'] as const;
export type EnvironmentZoneEntityKey = (typeof ENVIRONMENT_ZONE_ENTITY_KEYS)[number];

export type EnvironmentZoneEntities = Partial<Record<EnvironmentZoneEntityKey, string>>;

/**
 * A user-defined environmental zone (an indoor room or an outdoor location)
 * with manually mapped entities. Zone assignment is intentionally manual —
 * there is no semantic auto-detection of "which room is this sensor in".
 */
export interface EnvironmentZoneConfig {
  id: string;
  name: string;
  kind: EnvironmentZoneKind;
  visible: boolean;
  entities: EnvironmentZoneEntities;
}

export type PartialEnvironmentZoneConfig = Partial<Omit<EnvironmentZoneConfig, 'entities'>> & {
  entities?: EnvironmentZoneEntities;
};

export const ALERT_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'between', 'outside', 'eq'] as const;
export type AlertOperator = (typeof ALERT_OPERATORS)[number];

export const ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_LOGICS = ['all', 'any'] as const;
export type AlertLogic = (typeof ALERT_LOGICS)[number];

export interface AlertConditionConfig {
  id: string;
  entity_id: string;
  operator: AlertOperator;
  threshold: number;
  threshold2?: number;
}

export type PartialAlertConditionConfig = Partial<AlertConditionConfig>;

/**
 * A user-built, display-only recommendation rule (e.g. "Open the windows").
 * Rules are evaluated purely client-side while the card is rendered; they
 * never call Home Assistant services or fire notifications.
 */
export interface AlertRuleConfig {
  id: string;
  enabled: boolean;
  name: string;
  message: string;
  severity: AlertSeverity;
  logic: AlertLogic;
  conditions: AlertConditionConfig[];
}

export type PartialAlertRuleConfig = Partial<Omit<AlertRuleConfig, 'conditions'>> & {
  conditions?: PartialAlertConditionConfig[];
};

/**
 * Comfort monitoring configuration.
 *
 * All temperature values are in °C, humidity in %, absolute humidity in g/m³.
 * Disabled by default; enabled individually per card config.
 */
export interface ComfortConfig {
  /** Feature flag — false by default. */
  enabled: boolean;
  /**
   * Zone id of the indoor zone to source temperature/humidity from.
   * Empty string means "first visible indoor zone".
   */
  indoor_zone: string;
  /** Optional entity id for a surface (e.g. window) temperature sensor. */
  surface_temperature_entity?: string;
  /** Lower bound of the comfortable indoor temperature range (°C). */
  indoor_temperature_min: number;
  /** Upper bound of the comfortable indoor temperature range (°C). */
  indoor_temperature_max: number;
  /** Lower bound of the comfortable indoor relative humidity range (%). */
  indoor_humidity_min: number;
  /** Upper bound of the comfortable indoor relative humidity range (%). */
  indoor_humidity_max: number;
  /**
   * Minimum absolute-humidity difference (g/m³) between indoor and outdoor
   * air required to trigger a ventilation recommendation.
   */
  ventilation_humidity_delta: number;
  /**
   * Minimum temperature difference (°C) between indoor and outdoor air
   * required to trigger a cooling recommendation.
   */
  cooling_temperature_delta: number;
  /**
   * Fraction of the outdoor–indoor temperature difference subtracted from
   * the indoor temperature to estimate the window-surface temperature when
   * no surface_temperature_entity is provided.  Range 0–1, default 0.15.
   */
  glazing_factor: number;
}

/**
 * Sun-path panel configuration.
 *
 * Display-only; disabled by default. Uses the Home Assistant instance
 * latitude/longitude to compute the sun's arc, key times and season locally.
 */
export interface SunConfig {
  /** Feature flag — false by default. */
  enabled: boolean;
}

export interface ImmersiveWeatherCardConfig {
  type: string;
  title?: string;
  weather_entity?: string;
  image_url?: string;
  entities: ManualEntityMap;
  animation: AnimationConfig;
  scene: SceneConfig;
  appearance: AppearanceConfig;
  forecast: ForecastConfig;
  metrics: MetricConfig[];
  environment_zones: EnvironmentZoneConfig[];
  alerts: AlertRuleConfig[];
  comfort: ComfortConfig;
  sun: SunConfig;
}

export type PartialImmersiveWeatherCardConfig = Partial<
  Omit<
    ImmersiveWeatherCardConfig,
    'entities' | 'animation' | 'scene' | 'appearance' | 'forecast' | 'metrics' | 'environment_zones' | 'alerts' | 'comfort' | 'sun'
  >
> & {
  entities?: ManualEntityMap;
  animation?: Partial<AnimationConfig>;
  scene?: Partial<SceneConfig>;
  appearance?: Partial<AppearanceConfig>;
  forecast?: Partial<ForecastConfig>;
  metrics?: Partial<MetricConfig>[];
  environment_zones?: PartialEnvironmentZoneConfig[];
  alerts?: PartialAlertRuleConfig[];
  comfort?: Partial<ComfortConfig>;
  sun?: Partial<SunConfig>;
};

export interface LovelaceCardConfig {
  type: string;
  [key: string]: unknown;
}

export interface LovelaceCard extends HTMLElement {
  hass?: HomeAssistant;
  setConfig(config: LovelaceCardConfig): void;
  getCardSize?(): number | Promise<number>;
}

export interface ForecastAttribute {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  precipitation?: number;
  precipitation_probability?: number;
  wind_speed?: number;
  wind_bearing?: number;
  humidity?: number;
  uv_index?: number;
}

export type ForecastType = 'daily' | 'hourly' | 'twice_daily';
