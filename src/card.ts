import { LitElement, PropertyValues, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type {
  ForecastAttribute,
  HassEntity,
  HomeAssistant,
  ImmersiveWeatherCardConfig,
  LovelaceCardConfig,
  MetricKey,
  PartialImmersiveWeatherCardConfig
} from './types';
import { CARD_TYPE, mergeConfig } from './config/defaults';
import { METRIC_CATALOG } from './config/metrics';
import { validateConfig } from './config/validate';
import { pickWeatherEntity, resolveAllMetrics } from './data/entity-discovery';
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

  getCardSize(): number {
    return Math.max(4, Math.round((this._config?.appearance.min_height ?? 480) / 50));
  }

  getGridOptions(): { columns: number; rows: number; min_columns: number; min_rows: number } {
    return { columns: 12, rows: 8, min_columns: 6, min_rows: 6 };
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

  protected render() {
    if (!this._config) return nothing;
    const language = this.hass?.locale?.language ?? this.hass?.language ?? 'en';
    const weatherEntityId = this.hass ? pickWeatherEntity(this.hass, this._config.weather_entity) : undefined;
    const weatherState = weatherEntityId ? this.hass?.states[weatherEntityId] : undefined;
    const issues = this.hass ? validateConfig(this._config, this.hass) : [];
    const appearance = this._config.appearance;

    const sceneStyle = styleMap({
      '--panel-opacity': String(appearance.panel_opacity),
      '--panel-blur': `${appearance.panel_blur}px`,
      '--panel-radius': `${appearance.panel_radius}px`,
      '--accent-color': appearance.accent_color,
      '--text-color': appearance.text_color,
      minHeight: `${appearance.min_height}px`,
      aspectRatio: appearance.aspect_ratio || undefined
    });

    return html`
      <ha-card>
        <div class="scene density-${appearance.density}" style=${sceneStyle}>
          <canvas class="bg-canvas"></canvas>
          ${this._config.image_url ? html`<img class="house-image" src=${this._config.image_url} alt="" />` : nothing}
          <canvas class="fg-canvas"></canvas>
          <div class="ui-layer">
            ${this._config.title ? html`<h1 class="title">${this._config.title}</h1>` : nothing}
            ${!weatherEntityId
              ? html`<div class="panel notice">${localize(language, 'card.no_weather_entity')}</div>`
              : this._renderCurrent(weatherState, language)}
            ${weatherEntityId ? this._renderMetrics(weatherEntityId, language) : nothing}
            ${weatherEntityId ? this._renderForecast(language) : nothing}
            ${issues.length
              ? html`<div class="panel notice">
                  ${issues.map((issue) => html`<div>${localize(language, issue.messageKey, issue.vars)}</div>`)}
                </div>`
              : nothing}
          </div>
        </div>
      </ha-card>
    `;
  }

  private _renderCurrent(weatherState: HassEntity | undefined, language: string) {
    const condition = weatherState?.state;
    const temperature = weatherState?.attributes.temperature;
    const unit = weatherState?.attributes.temperature_unit as string | undefined;
    return html`
      <div class="panel current">
        <ha-icon icon=${conditionIcon(condition)}></ha-icon>
        <div class="temperature">${formatTemperature(temperature, this.hass, unit)}</div>
        <div class="condition">${condition ? localize(language, `condition.${condition}`) : ''}</div>
      </div>
    `;
  }

  private _renderMetrics(weatherEntityId: string, language: string) {
    if (!this.hass || !this._config) return nothing;
    const resolved = resolveAllMetrics(this.hass, this._config.entities, weatherEntityId);
    const visible = [...this._config.metrics].filter((metric) => metric.visible).sort((a, b) => a.order - b.order);
    const items = visible
      .map((metric) => ({ metric, resolved: resolved[metric.key] }))
      .filter((entry) => entry.resolved.source !== 'none');
    if (items.length === 0) return nothing;

    return html`
      <div class="panel metrics">
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
    }
    .scene {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 480px;
      overflow: hidden;
      background: #10131c;
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
      z-index: 1;
      pointer-events: none;
    }
    canvas.fg-canvas {
      position: absolute;
      inset: 0;
      z-index: 2;
      pointer-events: none;
    }
    .ui-layer {
      position: absolute;
      inset: 0;
      z-index: 3;
      display: flex;
      flex-direction: column;
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
    .panel.metrics {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 10px 16px;
    }
    .density-compact .panel.metrics {
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
    }
    .metric-value {
      margin-left: auto;
      font-weight: 600;
    }
    .panel.forecast {
      margin-top: auto;
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
    @media (max-width: 480px) {
      .panel.metrics {
        grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      }
      .temperature {
        font-size: 1.5rem;
      }
    }
  `;
}
