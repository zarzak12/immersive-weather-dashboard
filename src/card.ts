import { LitElement, PropertyValues, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type {
  EnvironmentZoneConfig,
  EnvironmentZoneEntityKey,
  ForecastAttribute,
  HassEntity,
  HomeAssistant,
  ImmersiveWeatherCardConfig,
  LovelaceCardConfig,
  MetricKey,
  PartialImmersiveWeatherCardConfig
} from './types';
import { ENVIRONMENT_ZONE_ENTITY_KEYS } from './types';
import { CARD_TYPE, mergeConfig } from './config/defaults';
import { METRIC_CATALOG } from './config/metrics';
import { validateConfig } from './config/validate';
import { evaluateAlerts, type EvaluatedAlert } from './data/alerts';
import { isUnavailable, pickWeatherEntity, resolveAllMetrics, type ResolvedMetric } from './data/entity-discovery';
import { subscribeForecast } from './data/forecast-subscribe';
import {
  bearingToCompass,
  convertToKmh,
  formatHour,
  formatNumber,
  formatPercent,
  formatTemperature,
  formatTime,
  formatWeekday
} from './data/format';
import { conditionToScene, isDaytime } from './data/weather-condition';
import { localize } from './localize/localize';
import { SceneRenderer, type SceneState } from './rendering/scene-renderer';

const CONDITION_ICONS: Record<string, string> = {
  'clear-night': 'mdi:weather-night',
  sunny: 'mdi:weather-sunny',
  partlycloudy: 'mdi:weather-partly-cloudy',
  cloudy: 'mdi:weather-cloudy',
  fog: 'mdi:weather-fog',
  hail: 'mdi:weather-hail',
  lightning: 'mdi:weather-lightning',
  'lightning-rainy': 'mdi:weather-lightning-rainy',
  pouring: 'mdi:weather-pouring',
  rainy: 'mdi:weather-rainy',
  snowy: 'mdi:weather-snowy',
  'snowy-rainy': 'mdi:weather-snowy-rainy',
  windy: 'mdi:weather-windy',
  'windy-variant': 'mdi:weather-windy-variant',
  exceptional: 'mdi:alert-circle-outline'
};

const ALERT_SEVERITY_ICON: Record<string, string> = {
  info: 'mdi:information-outline',
  warning: 'mdi:alert-outline',
  critical: 'mdi:alert-octagon-outline'
};

const ZONE_ENTITY_ICON: Record<EnvironmentZoneEntityKey, string> = {
  temperature: 'mdi:thermometer',
  humidity: 'mdi:water-percent',
  aqi: 'mdi:air-filter',
  co2: 'mdi:molecule-co2',
  pm2_5: 'mdi:blur',
  pm10: 'mdi:blur-radial',
  voc: 'mdi:flask-outline'
};

function conditionIcon(condition: string | undefined): string {
  return CONDITION_ICONS[condition ?? ''] ?? 'mdi:weather-cloudy';
}

@customElement('immersive-weather-dashboard')
export class ImmersiveWeatherDashboardCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private _config!: ImmersiveWeatherCardConfig;
  @state() private _dailyForecast: ForecastAttribute[] = [];
  @state() private _hourlyForecast: ForecastAttribute[] = [];
  @state() private _visible = true;

  private _renderer?: SceneRenderer;
  private _resizeObserver?: ResizeObserver;
  private _intersectionObserver?: IntersectionObserver;
  private _reducedMotionQuery?: MediaQueryList;
  private _dailyUnsub?: () => Promise<void>;
  private _hourlyUnsub?: () => Promise<void>;
  private _subscribedWeatherEntity?: string;
  private _subscribedDaily = false;
  private _subscribedHourly = false;
  private _subscriptionEpoch = 0;

  private readonly _handleReducedMotionChange = () => this._updateSceneState();
  private readonly _handleVisibilityChange = () => {
    this._renderer?.setPaused(document.hidden || !this._visible);
  };

  setConfig(config: LovelaceCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration.');
    }
    this._config = mergeConfig(config as PartialImmersiveWeatherCardConfig);
  }

  /**
   * Rough row-count estimate for legacy masonry/grid dashboards. Home
   * Assistant's modern "sections" view uses `getGridOptions` instead, which
   * intentionally does not force a fixed number of rows (see below) so the
   * card grows naturally with its content.
   */
  getCardSize(): number {
    if (!this._config) return 4;
    let rows = Math.max(3, Math.round(this._config.appearance.min_height / 50));
    rows += 1; // title + current condition overlay
    if (this._config.alerts.some((rule) => rule.enabled)) rows += 1;
    if (this._config.metrics.some((metric) => metric.visible)) rows += 2;
    const visibleZones = this._config.environment_zones.filter((zone) => zone.visible).length;
    if (visibleZones > 0) rows += Math.ceil(visibleZones / 2) * 2;
    if (this._config.forecast.show_hourly) rows += 2;
    if (this._config.forecast.show_daily) rows += 2;
    return rows;
  }

  /**
   * Only constrains the column span. Rows are intentionally left unset so
   * Home Assistant's sections view sizes the card to its natural,
   * information-driven height instead of clipping/stretching it to a fixed
   * number of grid rows.
   */
  getGridOptions(): { columns: number; min_columns: number } {
    return { columns: 12, min_columns: 6 };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement('immersive-weather-dashboard-editor');
  }

  static getStubConfig(hass: HomeAssistant): PartialImmersiveWeatherCardConfig {
    return {
      type: CARD_TYPE,
      weather_entity: pickWeatherEntity(hass)
    };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._reducedMotionQuery.addEventListener('change', this._handleReducedMotionChange);
    document.addEventListener('visibilitychange', this._handleVisibilityChange);
    if (this.hasUpdated) {
      void this.updateComplete.then(() => {
        if (!this.isConnected) return;
        this._initializeRenderer();
        void this._manageForecastSubscriptions();
      });
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._subscriptionEpoch++;
    this._renderer?.dispose();
    this._renderer = undefined;
    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;
    this._intersectionObserver?.disconnect();
    this._intersectionObserver = undefined;
    this._reducedMotionQuery?.removeEventListener('change', this._handleReducedMotionChange);
    this._reducedMotionQuery = undefined;
    document.removeEventListener('visibilitychange', this._handleVisibilityChange);
    this._subscribedWeatherEntity = undefined;
    this._subscribedDaily = false;
    this._subscribedHourly = false;
    void this._unsubscribeForecasts();
  }

  protected firstUpdated(): void {
    this._initializeRenderer();
  }

  private _initializeRenderer(): void {
    if (this._renderer) return;
    const scene = this.renderRoot.querySelector('.scene') as HTMLElement | null;
    const bg = this.renderRoot.querySelector('canvas.bg-canvas') as HTMLCanvasElement | null;
    const fg = this.renderRoot.querySelector('canvas.fg-canvas') as HTMLCanvasElement | null;
    if (!scene || !bg || !fg) return;

    this._renderer = new SceneRenderer(bg, fg);
    this._resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      this._renderer?.resize(rect.width, rect.height, window.devicePixelRatio || 1);
    });
    this._resizeObserver.observe(scene);

    this._intersectionObserver = new IntersectionObserver(
      (entries) => {
        this._visible = entries[0]?.isIntersecting ?? true;
        this._renderer?.setPaused(!this._visible || document.hidden);
      },
      { threshold: 0.01 }
    );
    this._intersectionObserver.observe(scene);

    this._updateSceneState();
    this._renderer.start();
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('hass') || changed.has('_config')) {
      this._updateSceneState();
      void this._manageForecastSubscriptions();
    }
  }

  private _updateSceneState(): void {
    if (!this._renderer || !this._config) return;
    const weatherEntityId = this.hass ? pickWeatherEntity(this.hass, this._config.weather_entity) : undefined;
    const weatherState = weatherEntityId ? this.hass?.states[weatherEntityId] : undefined;
    const condition = weatherState?.state;
    const metrics = this.hass ? resolveAllMetrics(this.hass, this._config.entities, weatherEntityId) : undefined;
    const windSpeedKmh = metrics ? convertToKmh(metrics.wind_speed.value, metrics.wind_speed.unit) : 0;
    const windBearingDeg = Number(metrics?.wind_bearing.value ?? 0) || 0;
    const cloudCoverage = Number(metrics?.cloud_coverage.value ?? 0) || 0;
    const reducedMotion =
      !this._config.animation.enabled || (this._config.animation.respect_reduced_motion && (this._reducedMotionQuery?.matches ?? false));

    const state: SceneState = {
      category: conditionToScene(condition),
      isDay: isDaytime(this.hass, this._config.scene.mode, condition),
      quality: this._config.animation.quality,
      intensity: this._config.animation.intensity,
      windSpeedKmh,
      windBearingDeg,
      reducedMotion,
      cloudCoverage
    };
    this._renderer.setState(state);
    this._renderer.setPaused(!this._visible || document.hidden);
  }

  private async _manageForecastSubscriptions(): Promise<void> {
    if (!this.hass || !this._config) return;
    const entityId = pickWeatherEntity(this.hass, this._config.weather_entity);
    const wantDaily = this._config.forecast.show_daily;
    const wantHourly = this._config.forecast.show_hourly;
    if (entityId === this._subscribedWeatherEntity && wantDaily === this._subscribedDaily && wantHourly === this._subscribedHourly) {
      return;
    }

    const epoch = ++this._subscriptionEpoch;
    this._subscribedWeatherEntity = entityId;
    this._subscribedDaily = wantDaily;
    this._subscribedHourly = wantHourly;
    await this._unsubscribeForecasts();
    if (epoch !== this._subscriptionEpoch || !entityId || !this.hass) return;

    if (wantDaily) {
      const unsub = await subscribeForecast(this.hass, entityId, 'daily', (forecast) => {
        this._dailyForecast = forecast;
      });
      if (epoch === this._subscriptionEpoch) {
        this._dailyUnsub = unsub;
      } else {
        void unsub?.();
      }
    }
    if (wantHourly) {
      const unsub = await subscribeForecast(this.hass, entityId, 'hourly', (forecast) => {
        this._hourlyForecast = forecast;
      });
      if (epoch === this._subscriptionEpoch) {
        this._hourlyUnsub = unsub;
      } else {
        void unsub?.();
      }
    }
  }

  private async _unsubscribeForecasts(): Promise<void> {
    const dailyUnsub = this._dailyUnsub;
    const hourlyUnsub = this._hourlyUnsub;
    this._dailyUnsub = undefined;
    this._hourlyUnsub = undefined;
    this._dailyForecast = [];
    this._hourlyForecast = [];
    if (dailyUnsub) await dailyUnsub();
    if (hourlyUnsub) await hourlyUnsub();
  }

  private _formatMetricValue(key: MetricKey, value: unknown, unit: string | undefined, language: string): string {
    switch (key) {
      case 'outdoor_temperature':
      case 'apparent_temperature':
      case 'dew_point':
        return formatTemperature(value, this.hass, unit);
      case 'humidity':
      case 'cloud_coverage':
      case 'precipitation_probability':
        return formatPercent(value);
      case 'pressure':
        return formatNumber(value, unit ?? this.hass?.config.unit_system.pressure, 0);
      case 'wind_speed':
      case 'wind_gust':
        return formatNumber(value, unit ?? this.hass?.config.unit_system.wind_speed, 1);
      case 'wind_bearing': {
        const numeric = Number(value);
        return Number.isNaN(numeric) ? '—' : `${bearingToCompass(numeric)} (${Math.round(numeric)}°)`;
      }
      case 'precipitation':
        return formatNumber(value, unit ?? 'mm', 1);
      case 'uv_index':
        return formatNumber(value, undefined, 1);
      case 'visibility':
        return formatNumber(value, unit ?? this.hass?.config.unit_system.length, 1);
      case 'ozone':
        return formatNumber(value, unit ?? 'DU', 0);
      case 'air_quality':
        return formatNumber(value, unit, 0);
      case 'sunrise':
      case 'sunset':
        return formatTime(value, language);
      default:
        return formatNumber(value, unit);
    }
  }

  private _formatZoneValue(key: EnvironmentZoneEntityKey, entity: HassEntity): string {
    const unit = entity.attributes.unit_of_measurement;
    switch (key) {
      case 'temperature':
        return formatTemperature(entity.state, this.hass, unit);
      case 'humidity':
        return formatPercent(entity.state);
      case 'aqi':
        return formatNumber(entity.state, unit, 0);
      case 'co2':
        return formatNumber(entity.state, unit ?? 'ppm', 0);
      case 'pm2_5':
      case 'pm10':
        return formatNumber(entity.state, unit ?? 'µg/m³', 1);
      case 'voc':
        return formatNumber(entity.state, unit, 1);
      default:
        return formatNumber(entity.state, unit);
    }
  }

  protected render() {
    if (!this._config) return nothing;
    const language = this.hass?.locale?.language ?? this.hass?.language ?? 'en';
    const weatherEntityId = this.hass ? pickWeatherEntity(this.hass, this._config.weather_entity) : undefined;
    const weatherState = weatherEntityId ? this.hass?.states[weatherEntityId] : undefined;
    const issues = this.hass ? validateConfig(this._config, this.hass) : [];
    const appearance = this._config.appearance;
    const resolvedMetrics = this.hass ? resolveAllMetrics(this.hass, this._config.entities, weatherEntityId) : undefined;
    const activeAlerts = this.hass ? evaluateAlerts(this.hass, this._config.alerts).filter((alert) => alert.active) : [];
    const hasOutdoorTemperature = resolvedMetrics?.outdoor_temperature.source !== 'none';

    const rootStyle = styleMap({
      '--panel-opacity': String(appearance.panel_opacity),
      '--panel-blur': `${appearance.panel_blur}px`,
      '--panel-radius': `${appearance.panel_radius}px`,
      '--accent-color': appearance.accent_color,
      '--text-color': appearance.text_color
    });
    const sceneStyle = styleMap({
      minHeight: `${appearance.min_height}px`,
      aspectRatio: appearance.aspect_ratio || undefined
    });
    const imageStyle = styleMap({
      objectFit: this._config.scene.image_fit,
      objectPosition: `${this._config.scene.image_position_x}% ${this._config.scene.image_position_y}%`,
      transform: `scale(${this._config.scene.image_scale})`,
      transformOrigin: `${this._config.scene.image_position_x}% ${this._config.scene.image_position_y}%`
    });

    return html`
      <ha-card style=${rootStyle} class="density-${appearance.density}">
        <div class="scene" style=${sceneStyle}>
          <canvas class="bg-canvas"></canvas>
          ${this._config.image_url ? html`<img class="house-image" style=${imageStyle} src=${this._config.image_url} alt="" />` : nothing}
          <canvas class="fg-canvas"></canvas>
          <div class="scene-overlay">
            ${this._config.title ? html`<h1 class="title">${this._config.title}</h1>` : nothing}
            ${weatherEntityId || hasOutdoorTemperature
              ? this._renderCurrent(weatherState, resolvedMetrics?.outdoor_temperature, language)
              : nothing}
          </div>
        </div>
        <div class="info">
          ${!weatherEntityId ? html`<div class="panel notice">${localize(language, 'card.no_weather_entity')}</div>` : nothing}
          ${activeAlerts.length ? this._renderAlerts(activeAlerts, language) : nothing}
          ${this._renderMetrics(resolvedMetrics, language)}
          ${this._renderZones(language)}
          ${weatherEntityId ? this._renderForecast(language) : nothing}
          ${issues.length
            ? html`<div class="panel notice">
                ${issues.map((issue) => html`<div>${localize(language, issue.messageKey, issue.vars)}</div>`)}
              </div>`
            : nothing}
        </div>
      </ha-card>
    `;
  }

  private _renderCurrent(weatherState: HassEntity | undefined, outdoorTemperature: ResolvedMetric | undefined, language: string) {
    const condition = weatherState?.state;
    const hasResolvedTemperature = outdoorTemperature && outdoorTemperature.source !== 'none';
    const value = hasResolvedTemperature ? outdoorTemperature!.value : weatherState?.attributes.temperature;
    const unit = hasResolvedTemperature ? outdoorTemperature!.unit : (weatherState?.attributes.temperature_unit as string | undefined);
    return html`
      <div class="panel current">
        <ha-icon icon=${conditionIcon(condition)}></ha-icon>
        <div class="temperature">${this._formatMetricValue('outdoor_temperature', value, unit, language)}</div>
        <div class="condition">${condition ? localize(language, `condition.${condition}`) : ''}</div>
      </div>
    `;
  }

  private _renderAlerts(alerts: EvaluatedAlert[], language: string) {
    return html`
      <div class="alerts">
        ${alerts.map(
          (alert) => html`
            <div class="alert alert-${alert.severity}">
              <ha-icon icon=${ALERT_SEVERITY_ICON[alert.severity] ?? 'mdi:information-outline'}></ha-icon>
              <div class="alert-body">
                <div class="alert-name">${alert.name || localize(language, 'alerts.default_name')}</div>
                ${alert.message ? html`<div class="alert-message">${alert.message}</div>` : nothing}
              </div>
            </div>
          `
        )}
      </div>
    `;
  }

  private _renderMetrics(resolved: Record<MetricKey, ResolvedMetric> | undefined, language: string) {
    if (!resolved || !this._config) return nothing;
    const visible = [...this._config.metrics].filter((metric) => metric.visible).sort((a, b) => a.order - b.order);
    const items = visible
      .map((metric) => ({ metric, resolved: resolved[metric.key] }))
      .filter((entry) => entry.resolved.source !== 'none');
    if (items.length === 0) return nothing;

    return html`
      <div class="panel metrics">
        <div class="panel-title">${localize(language, 'card.outdoor_station')}</div>
        <div class="metrics-grid">
          ${items.map(
            ({ metric, resolved }) => html`
              <div class="metric">
                <ha-icon icon=${metric.icon || METRIC_CATALOG[metric.key].defaultIcon}
                  style=${metric.color ? `color:${metric.color}` : ''}></ha-icon>
                <span class="metric-label">${metric.label || localize(language, `metrics.${metric.key}`)}</span>
                <span class="metric-value">${this._formatMetricValue(metric.key, resolved.value, resolved.unit, language)}</span>
              </div>
            `
          )}
        </div>
      </div>
    `;
  }

  private _renderZones(language: string) {
    const zones = this._config.environment_zones.filter((zone) => zone.visible);
    if (zones.length === 0) return nothing;
    return html` <div class="zones-grid">${zones.map((zone) => this._renderZoneCard(zone, language))}</div> `;
  }

  private _renderZoneCard(zone: EnvironmentZoneConfig, language: string) {
    const configuredKeys = ENVIRONMENT_ZONE_ENTITY_KEYS.filter((key) => zone.entities[key]);
    return html`
      <div class="panel zone-card">
        <div class="zone-header">
          <ha-icon icon=${zone.kind === 'outdoor' ? 'mdi:tree-outline' : 'mdi:home-outline'}></ha-icon>
          <span class="zone-name">${zone.name || localize(language, `zone.kind_${zone.kind}`)}</span>
          <span class="zone-kind">${localize(language, `zone.kind_${zone.kind}`)}</span>
        </div>
        ${configuredKeys.length === 0
          ? html`<div class="zone-empty">${localize(language, 'zone.no_metrics')}</div>`
          : configuredKeys.map((key) => this._renderZoneRow(zone, key, language))}
      </div>
    `;
  }

  private _renderZoneRow(zone: EnvironmentZoneConfig, key: EnvironmentZoneEntityKey, language: string) {
    const entityId = zone.entities[key] as string;
    const entity = this.hass?.states[entityId];
    const unavailable = !this.hass || !entity || isUnavailable(entity);
    const value = unavailable ? '—' : this._formatZoneValue(key, entity!);
    return html`
      <div class="zone-row">
        <ha-icon icon=${ZONE_ENTITY_ICON[key]}></ha-icon>
        <span class="zone-label">${localize(language, `zone_metric.${key}`)}</span>
        <span class="zone-value">${value}</span>
        ${unavailable
          ? html`<span class="zone-warning" title=${localize(language, 'zone.entity_unavailable', { entity: entityId })}>
              <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
            </span>`
          : nothing}
      </div>
    `;
  }

  private _renderForecast(language: string) {
    if (!this._config.forecast.show_hourly && !this._config.forecast.show_daily) return nothing;
    return html`
      ${this._config.forecast.show_hourly && this._hourlyForecast.length
        ? html`
            <div class="panel forecast">
              <div class="forecast-title">${localize(language, 'forecast.hourly')}</div>
              <div class="forecast-row">
                ${this._hourlyForecast.slice(0, this._config.forecast.hourly_count).map(
                  (item) => html`
                    <div class="forecast-item">
                      <span>${formatHour(item.datetime, language)}</span>
                      <ha-icon icon=${conditionIcon(item.condition)}></ha-icon>
                      <span>${formatTemperature(item.temperature, this.hass)}</span>
                    </div>
                  `
                )}
              </div>
            </div>
          `
        : nothing}
      ${this._config.forecast.show_daily && this._dailyForecast.length
        ? html`
            <div class="panel forecast">
              <div class="forecast-title">${localize(language, 'forecast.daily')}</div>
              <div class="forecast-row">
                ${this._dailyForecast.slice(0, this._config.forecast.daily_count).map(
                  (item) => html`
                    <div class="forecast-item">
                      <span>${formatWeekday(item.datetime, language)}</span>
                      <ha-icon icon=${conditionIcon(item.condition)}></ha-icon>
                      <span>${formatTemperature(item.temperature, this.hass)} / ${formatTemperature(item.templow, this.hass)}</span>
                    </div>
                  `
                )}
              </div>
            </div>
          `
        : nothing}
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    ha-card {
      overflow: hidden;
      padding: 0;
      border: none;
      display: flex;
      flex-direction: column;
    }
    .scene {
      position: relative;
      width: 100%;
      min-height: 480px;
      overflow: hidden;
      background: #10131c;
      flex-shrink: 0;
    }
    canvas.bg-canvas {
      position: absolute;
      inset: 0;
      z-index: 0;
    }
    .house-image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: bottom center;
      transform-origin: bottom center;
      z-index: 1;
      pointer-events: none;
    }
    canvas.fg-canvas {
      position: absolute;
      inset: 0;
      z-index: 2;
      pointer-events: none;
    }
    .scene-overlay {
      position: absolute;
      inset: 0;
      z-index: 3;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      color: var(--text-color, #fff);
      pointer-events: none;
    }
    .title {
      margin: 0;
      font-size: 1.4rem;
      font-weight: 600;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    }
    .info {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: rgba(16, 19, 28, 0.94);
    }
    .panel {
      background: rgba(255, 255, 255, var(--panel-opacity, 0.5));
      backdrop-filter: blur(var(--panel-blur, 12px));
      -webkit-backdrop-filter: blur(var(--panel-blur, 12px));
      border-radius: var(--panel-radius, 18px);
      border: 1px solid rgba(255, 255, 255, 0.25);
      padding: 10px 14px;
      pointer-events: auto;
      color: var(--text-color, #fff);
    }
    .panel.notice {
      background: rgba(200, 60, 60, 0.35);
    }
    .panel.current {
      display: flex;
      align-items: center;
      gap: 10px;
      width: fit-content;
    }
    .panel.current ha-icon {
      --mdc-icon-size: 40px;
      color: var(--accent-color, #7ec8ff);
    }
    .temperature {
      font-size: 2rem;
      font-weight: 700;
    }
    .condition {
      font-size: 0.95rem;
      opacity: 0.9;
    }
    .panel-title {
      font-size: 0.8rem;
      font-weight: 600;
      opacity: 0.8;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .panel.metrics .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 10px 16px;
    }
    .density-compact .metrics-grid {
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 6px 10px;
    }
    .metric {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
    }
    .metric ha-icon {
      --mdc-icon-size: 20px;
      color: var(--accent-color, #7ec8ff);
      flex-shrink: 0;
    }
    .metric-label {
      min-width: 0;
    }
    .metric-value {
      margin-left: auto;
      font-weight: 600;
      flex-shrink: 0;
      white-space: nowrap;
    }
    .forecast-title {
      font-size: 0.85rem;
      opacity: 0.8;
      margin-bottom: 6px;
    }
    .forecast-row {
      display: flex;
      gap: 14px;
      overflow-x: auto;
      scrollbar-width: thin;
    }
    .forecast-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      font-size: 0.8rem;
      min-width: 48px;
    }
    .alerts {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .alert {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 14px;
      border-radius: var(--panel-radius, 18px);
      border: 1px solid rgba(255, 255, 255, 0.25);
      color: #fff;
    }
    .alert ha-icon {
      --mdc-icon-size: 24px;
      margin-top: 2px;
    }
    .alert-info {
      background: rgba(33, 150, 243, 0.35);
    }
    .alert-warning {
      background: rgba(255, 152, 0, 0.4);
    }
    .alert-critical {
      background: rgba(211, 47, 47, 0.45);
    }
    .alert-name {
      font-weight: 700;
    }
    .alert-message {
      font-size: 0.85rem;
      opacity: 0.95;
    }
    .zones-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }
    .zone-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .zone-header ha-icon {
      color: var(--accent-color, #7ec8ff);
    }
    .zone-name {
      font-weight: 700;
      flex: 1;
    }
    .zone-kind {
      font-size: 0.75rem;
      opacity: 0.75;
      text-transform: uppercase;
    }
    .zone-empty {
      font-size: 0.8rem;
      opacity: 0.7;
    }
    .zone-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      padding: 3px 0;
    }
    .zone-row ha-icon {
      --mdc-icon-size: 18px;
      color: var(--accent-color, #7ec8ff);
      flex-shrink: 0;
    }
    .zone-label {
      min-width: 0;
    }
    .zone-value {
      margin-left: auto;
      font-weight: 600;
      flex-shrink: 0;
      white-space: nowrap;
    }
    .zone-warning ha-icon {
      --mdc-icon-size: 16px;
      color: #ffb300;
    }
    @media (max-width: 480px) {
      .panel.metrics .metrics-grid {
        grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      }
      .zones-grid {
        grid-template-columns: 1fr;
      }
      .temperature {
        font-size: 1.5rem;
      }
    }
  `;
}
