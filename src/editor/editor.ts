import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  AnimationConfig,
  AppearanceConfig,
  ForecastConfig,
  HomeAssistant,
  ImmersiveWeatherCardConfig,
  LovelaceCardConfig,
  MetricConfig,
  MetricKey,
  PartialImmersiveWeatherCardConfig,
  SceneConfig
} from '../types';
import { defaultConfig, mergeConfig } from '../config/defaults';
import { METRIC_CATALOG } from '../config/metrics';
import { autoDetectSnapshot, pickWeatherEntity, resolveMetric } from '../data/entity-discovery';
import { localize } from '../localize/localize';

type TabId = 'data' | 'image' | 'appearance' | 'forecast' | 'metrics';

const TABS: TabId[] = ['data', 'image', 'appearance', 'forecast', 'metrics'];

function domainOf(entityId: string): string {
  return entityId.split('.', 1)[0];
}

@customElement('immersive-weather-dashboard-editor')
export class ImmersiveWeatherDashboardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private _config: ImmersiveWeatherCardConfig = defaultConfig();
  @state() private _activeTab: TabId = 'data';

  setConfig(config: LovelaceCardConfig): void {
    this._config = mergeConfig(config as PartialImmersiveWeatherCardConfig);
  }

  private get _language(): string {
    return this.hass?.locale?.language ?? this.hass?.language ?? 'en';
  }

  private _t(key: string, vars?: Record<string, string | number>): string {
    return localize(this._language, key, vars);
  }

  private _fireConfigChanged(): void {
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true }));
  }

  private _updateRoot<K extends keyof ImmersiveWeatherCardConfig>(key: K, value: ImmersiveWeatherCardConfig[K]): void {
    this._config = { ...this._config, [key]: value };
    this._fireConfigChanged();
  }

  private _updateAnimation(partial: Partial<AnimationConfig>): void {
    this._updateRoot('animation', { ...this._config.animation, ...partial });
  }

  private _updateScene(partial: Partial<SceneConfig>): void {
    this._updateRoot('scene', { ...this._config.scene, ...partial });
  }

  private _updateAppearance(partial: Partial<AppearanceConfig>): void {
    this._updateRoot('appearance', { ...this._config.appearance, ...partial });
  }

  private _updateForecast(partial: Partial<ForecastConfig>): void {
    this._updateRoot('forecast', { ...this._config.forecast, ...partial });
  }

  private _updateEntityOverride(key: MetricKey, entityId: string): void {
    const entities = { ...this._config.entities };
    if (entityId) {
      entities[key] = entityId;
    } else {
      delete entities[key];
    }
    this._updateRoot('entities', entities);
  }

  private _updateMetric(key: MetricKey, partial: Partial<MetricConfig>): void {
    const metrics = this._config.metrics.map((metric) => (metric.key === key ? { ...metric, ...partial } : metric));
    this._updateRoot('metrics', metrics);
  }

  private _moveMetric(key: MetricKey, direction: -1 | 1): void {
    const metrics = [...this._config.metrics].sort((a, b) => a.order - b.order);
    const index = metrics.findIndex((metric) => metric.key === key);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= metrics.length) return;
    const orderCurrent = metrics[index].order;
    metrics[index] = { ...metrics[index], order: metrics[targetIndex].order };
    metrics[targetIndex] = { ...metrics[targetIndex], order: orderCurrent };
    this._updateRoot('metrics', metrics);
  }

  private _resetDefaults(): void {
    this._config = { ...defaultConfig(), type: this._config.type };
    this._fireConfigChanged();
  }

  private _autoConfigure(): void {
    if (!this.hass) return;
    if (!window.confirm(this._t('editor.auto_configure_confirm'))) return;
    const snapshot = autoDetectSnapshot(this.hass, this._config.weather_entity);
    this._config = {
      ...this._config,
      weather_entity: snapshot.weatherEntity ?? this._config.weather_entity,
      entities: { ...this._config.entities, ...snapshot.entities }
    };
    this._fireConfigChanged();
  }

  private _entityOptions(domains: string[]): string[] {
    if (!this.hass) return [];
    return Object.keys(this.hass.states)
      .filter((id) => domains.includes(domainOf(id)))
      .sort();
  }

  protected render() {
    return html`
      <div class="tabs">
        ${TABS.map(
          (tab) => html`
            <button class=${tab === this._activeTab ? 'active' : ''} @click=${() => (this._activeTab = tab)}>
              ${this._t(`editor.tab_${tab}`)}
            </button>
          `
        )}
      </div>
      <div class="tab-content">
        ${this._activeTab === 'data' ? this._renderDataTab() : nothing}
        ${this._activeTab === 'image' ? this._renderImageTab() : nothing}
        ${this._activeTab === 'appearance' ? this._renderAppearanceTab() : nothing}
        ${this._activeTab === 'forecast' ? this._renderForecastTab() : nothing}
        ${this._activeTab === 'metrics' ? this._renderMetricsTab() : nothing}
      </div>
      <div class="actions">
        <button class="secondary" @click=${this._resetDefaults}>${this._t('editor.reset_defaults')}</button>
        <button class="primary" @click=${this._autoConfigure}>${this._t('editor.auto_configure')}</button>
      </div>
    `;
  }

  private _renderDataTab() {
    const weatherOptions = this._entityOptions(['weather']);
    return html`
      <label>${this._t('editor.title')}</label>
      <input
        type="text"
        .value=${this._config.title ?? ''}
        @input=${(event: InputEvent) => this._updateRoot('title', (event.target as HTMLInputElement).value)}
      />
      <p class="helper">${this._t('editor.title_helper')}</p>

      <label>${this._t('editor.weather_entity')}</label>
      <select @change=${(event: Event) => this._updateRoot('weather_entity', (event.target as HTMLSelectElement).value || undefined)}>
        <option value="" ?selected=${!this._config.weather_entity}>—</option>
        ${weatherOptions.map((id) => html`<option value=${id} ?selected=${id === this._config.weather_entity}>${id}</option>`)}
      </select>
      <p class="helper">${this._t('editor.weather_entity_helper')}</p>
    `;
  }

  private _renderImageTab() {
    return html`
      <label>${this._t('editor.image_url')}</label>
      <input
        type="text"
        placeholder="/local/house.png"
        .value=${this._config.image_url ?? ''}
        @input=${(event: InputEvent) => this._updateRoot('image_url', (event.target as HTMLInputElement).value || undefined)}
      />
      <p class="helper">${this._t('editor.image_url_helper')}</p>

      <label>${this._t('editor.scene_mode')}</label>
      <select @change=${(event: Event) => this._updateScene({ mode: (event.target as HTMLSelectElement).value as SceneConfig['mode'] })}>
        <option value="auto" ?selected=${this._config.scene.mode === 'auto'}>${this._t('editor.scene_mode_auto')}</option>
        <option value="day" ?selected=${this._config.scene.mode === 'day'}>${this._t('editor.scene_mode_day')}</option>
        <option value="night" ?selected=${this._config.scene.mode === 'night'}>${this._t('editor.scene_mode_night')}</option>
      </select>

      <label class="checkbox">
        <input
          type="checkbox"
          .checked=${this._config.animation.enabled}
          @change=${(event: Event) => this._updateAnimation({ enabled: (event.target as HTMLInputElement).checked })}
        />
        ${this._t('editor.animation_enabled')}
      </label>

      <label>${this._t('editor.animation_quality')}</label>
      <select
        @change=${(event: Event) =>
          this._updateAnimation({ quality: (event.target as HTMLSelectElement).value as AnimationConfig['quality'] })}
      >
        <option value="low" ?selected=${this._config.animation.quality === 'low'}>Low</option>
        <option value="medium" ?selected=${this._config.animation.quality === 'medium'}>Medium</option>
        <option value="high" ?selected=${this._config.animation.quality === 'high'}>High</option>
      </select>

      <label>${this._t('editor.animation_intensity')}</label>
      <input
        type="range"
        min="0"
        max="2"
        step="0.1"
        .value=${String(this._config.animation.intensity)}
        @input=${(event: Event) => this._updateAnimation({ intensity: Number((event.target as HTMLInputElement).value) })}
      />
    `;
  }

  private _renderAppearanceTab() {
    const appearance = this._config.appearance;
    return html`
      <label>${this._t('editor.panel_opacity')}</label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        .value=${String(appearance.panel_opacity)}
        @input=${(event: Event) => this._updateAppearance({ panel_opacity: Number((event.target as HTMLInputElement).value) })}
      />

      <label>${this._t('editor.panel_blur')}</label>
      <input
        type="range"
        min="0"
        max="30"
        step="1"
        .value=${String(appearance.panel_blur)}
        @input=${(event: Event) => this._updateAppearance({ panel_blur: Number((event.target as HTMLInputElement).value) })}
      />

      <label>${this._t('editor.panel_radius')}</label>
      <input
        type="range"
        min="0"
        max="40"
        step="1"
        .value=${String(appearance.panel_radius)}
        @input=${(event: Event) => this._updateAppearance({ panel_radius: Number((event.target as HTMLInputElement).value) })}
      />

      <label>${this._t('editor.accent_color')}</label>
      <input
        type="color"
        .value=${appearance.accent_color}
        @input=${(event: Event) => this._updateAppearance({ accent_color: (event.target as HTMLInputElement).value })}
      />

      <label>${this._t('editor.text_color')}</label>
      <input
        type="color"
        .value=${appearance.text_color}
        @input=${(event: Event) => this._updateAppearance({ text_color: (event.target as HTMLInputElement).value })}
      />

      <label>${this._t('editor.min_height')}</label>
      <input
        type="number"
        min="200"
        .value=${String(appearance.min_height)}
        @input=${(event: Event) => this._updateAppearance({ min_height: Number((event.target as HTMLInputElement).value) })}
      />

      <label>${this._t('editor.aspect_ratio')}</label>
      <input
        type="text"
        placeholder="16/9"
        .value=${appearance.aspect_ratio}
        @input=${(event: Event) => this._updateAppearance({ aspect_ratio: (event.target as HTMLInputElement).value })}
      />

      <label>${this._t('editor.density')}</label>
      <select
        @change=${(event: Event) =>
          this._updateAppearance({ density: (event.target as HTMLSelectElement).value as AppearanceConfig['density'] })}
      >
        <option value="comfortable" ?selected=${appearance.density === 'comfortable'}>${this._t('editor.density_comfortable')}</option>
        <option value="compact" ?selected=${appearance.density === 'compact'}>${this._t('editor.density_compact')}</option>
      </select>
    `;
  }

  private _renderForecastTab() {
    const forecast = this._config.forecast;
    return html`
      <label class="checkbox">
        <input
          type="checkbox"
          .checked=${forecast.show_hourly}
          @change=${(event: Event) => this._updateForecast({ show_hourly: (event.target as HTMLInputElement).checked })}
        />
        ${this._t('editor.show_hourly')}
      </label>
      <label>${this._t('editor.hourly_count')}</label>
      <input
        type="number"
        min="1"
        max="48"
        .value=${String(forecast.hourly_count)}
        @input=${(event: Event) => this._updateForecast({ hourly_count: Number((event.target as HTMLInputElement).value) })}
      />

      <label class="checkbox">
        <input
          type="checkbox"
          .checked=${forecast.show_daily}
          @change=${(event: Event) => this._updateForecast({ show_daily: (event.target as HTMLInputElement).checked })}
        />
        ${this._t('editor.show_daily')}
      </label>
      <label>${this._t('editor.daily_count')}</label>
      <input
        type="number"
        min="1"
        max="14"
        .value=${String(forecast.daily_count)}
        @input=${(event: Event) => this._updateForecast({ daily_count: Number((event.target as HTMLInputElement).value) })}
      />
    `;
  }

  private _renderMetricsTab() {
    const metrics = [...this._config.metrics].sort((a, b) => a.order - b.order);
    return html` ${metrics.map((metric) => this._renderMetricRow(metric))} `;
  }

  private _renderMetricRow(metric: MetricConfig) {
    const definition = METRIC_CATALOG[metric.key];
    const options = this._entityOptions(definition.domains);
    const weatherEntityId = this.hass ? pickWeatherEntity(this.hass, this._config.weather_entity) : undefined;
    const source = this.hass ? resolveMetric(this.hass, metric.key, this._config.entities, weatherEntityId).source : 'none';
    const sourceLabel = this._t(`editor.source_${source === 'sun_attribute' ? 'sensor' : source}`);

    return html`
      <div class="metric-row">
        <div class="metric-row-header">
          <span class="metric-name">${metric.label || this._t(`metrics.${metric.key}`)}</span>
          <span class="metric-source">${sourceLabel}</span>
          <button title="up" @click=${() => this._moveMetric(metric.key, -1)}>▲</button>
          <button title="down" @click=${() => this._moveMetric(metric.key, 1)}>▼</button>
        </div>
        <label class="checkbox">
          <input
            type="checkbox"
            .checked=${metric.visible}
            @change=${(event: Event) => this._updateMetric(metric.key, { visible: (event.target as HTMLInputElement).checked })}
          />
          ${this._t('editor.metric_visible')}
        </label>
        <input
          type="text"
          placeholder=${this._t('editor.metric_label')}
          .value=${metric.label ?? ''}
          @input=${(event: Event) => this._updateMetric(metric.key, { label: (event.target as HTMLInputElement).value || undefined })}
        />
        <input
          type="color"
          .value=${metric.color ?? '#7ec8ff'}
          @input=${(event: Event) => this._updateMetric(metric.key, { color: (event.target as HTMLInputElement).value })}
        />
        <input
          type="text"
          placeholder=${definition.defaultIcon}
          .value=${metric.icon ?? ''}
          @input=${(event: Event) => this._updateMetric(metric.key, { icon: (event.target as HTMLInputElement).value || undefined })}
        />
        <select @change=${(event: Event) => this._updateEntityOverride(metric.key, (event.target as HTMLSelectElement).value)}>
          <option value="" ?selected=${!this._config.entities[metric.key]}>${this._t('editor.manual_entity')}: —</option>
          ${options.map((id) => html`<option value=${id} ?selected=${id === this._config.entities[metric.key]}>${id}</option>`)}
        </select>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--paper-font-body1_-_font-family, sans-serif);
      color: var(--primary-text-color, #212121);
    }
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
      margin-bottom: 12px;
    }
    .tabs button {
      background: none;
      border: none;
      padding: 8px 12px;
      cursor: pointer;
      border-radius: 6px 6px 0 0;
      color: var(--secondary-text-color, #555);
    }
    .tabs button.active {
      background: var(--secondary-background-color, #f0f0f0);
      color: var(--primary-text-color, #212121);
      font-weight: 600;
    }
    .tab-content {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 4px 2px 16px;
    }
    label {
      font-size: 0.85rem;
      margin-top: 8px;
      font-weight: 500;
    }
    label.checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 400;
    }
    input,
    select {
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: inherit;
      font: inherit;
    }
    .helper {
      font-size: 0.75rem;
      color: var(--secondary-text-color, #777);
      margin: 0 0 4px;
    }
    .actions {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--divider-color, #e0e0e0);
    }
    button.primary,
    button.secondary {
      padding: 8px 14px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-weight: 600;
    }
    button.primary {
      background: var(--primary-color, #03a9f4);
      color: #fff;
    }
    button.secondary {
      background: var(--secondary-background-color, #eee);
      color: var(--primary-text-color, #212121);
    }
    .metric-row {
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 8px;
      padding: 8px 10px;
      margin-bottom: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .metric-row-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .metric-name {
      font-weight: 600;
      flex: 1;
    }
    .metric-source {
      font-size: 0.75rem;
      opacity: 0.7;
    }
    .metric-row-header button {
      border: none;
      background: var(--secondary-background-color, #eee);
      border-radius: 4px;
      cursor: pointer;
      padding: 2px 6px;
    }
  `;
}
