import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  AlertConditionConfig,
  AlertLogic,
  AlertOperator,
  AlertRuleConfig,
  AlertSeverity,
  AnimationConfig,
  AppearanceConfig,
  EnvironmentZoneConfig,
  EnvironmentZoneEntityKey,
  EnvironmentZoneKind,
  ForecastConfig,
  HomeAssistant,
  ImmersiveWeatherCardConfig,
  LovelaceCardConfig,
  MetricConfig,
  MetricKey,
  PartialImmersiveWeatherCardConfig,
  SceneConfig
} from '../types';
import { ALERT_LOGICS, ALERT_OPERATORS, ALERT_SEVERITIES, ENVIRONMENT_ZONE_ENTITY_KEYS, METRIC_KEYS } from '../types';
import { defaultConfig, mergeConfig } from '../config/defaults';
import { METRIC_CATALOG } from '../config/metrics';
import { autoDetectSnapshot, pickWeatherEntity, resolveMetric, type ResolvedMetric } from '../data/entity-discovery';
import { localize } from '../localize/localize';

type TabId = 'data' | 'mapping' | 'image' | 'appearance' | 'forecast' | 'metrics' | 'environment' | 'alerts';

const TABS: TabId[] = ['data', 'mapping', 'image', 'appearance', 'forecast', 'metrics', 'environment', 'alerts'];

interface EntitySuggestion {
  id: string;
  label: string;
}

function domainOf(entityId: string): string {
  return entityId.split('.', 1)[0];
}

/** Generates a short, unique-enough id for a new zone/alert/condition created in the editor. */
function generateId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
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

  private _entitySuggestions(domains: string[]): EntitySuggestion[] {
    if (!this.hass) return [];
    return Object.keys(this.hass.states)
      .filter((id) => domains.includes(domainOf(id)))
      .sort()
      .map((id) => {
        const entity = this.hass!.states[id];
        const friendly = entity.attributes.friendly_name;
        const unit = entity.attributes.unit_of_measurement;
        const extra = [friendly, unit].filter(Boolean).join(' · ');
        return { id, label: extra ? `${id} — ${extra}` : id };
      });
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

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
        ${this._activeTab === 'mapping' ? this._renderMappingTab() : nothing}
        ${this._activeTab === 'image' ? this._renderImageTab() : nothing}
        ${this._activeTab === 'appearance' ? this._renderAppearanceTab() : nothing}
        ${this._activeTab === 'forecast' ? this._renderForecastTab() : nothing}
        ${this._activeTab === 'metrics' ? this._renderMetricsTab() : nothing}
        ${this._activeTab === 'environment' ? this._renderEnvironmentTab() : nothing}
        ${this._activeTab === 'alerts' ? this._renderAlertsTab() : nothing}
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

  // ---------------------------------------------------------------------
  // Entity mapping tab
  // ---------------------------------------------------------------------

  private _describeResolvedMetric(resolved: ResolvedMetric | undefined): string {
    if (!resolved || resolved.source === 'none') return this._t('editor.source_none');
    const sourceLabel = this._t(`editor.source_${resolved.source === 'sun_attribute' ? 'sensor' : resolved.source}`);
    return resolved.entityId ? `${sourceLabel}: ${resolved.entityId}` : sourceLabel;
  }

  private _renderMappingTab() {
    return html`
      <p class="helper">${this._t('editor.mapping_helper')}</p>
      ${METRIC_KEYS.map((key) => this._renderMappingRow(key))}
    `;
  }

  private _renderMappingRow(key: MetricKey) {
    const definition = METRIC_CATALOG[key];
    const weatherEntityId = this.hass ? pickWeatherEntity(this.hass, this._config.weather_entity) : undefined;
    const resolved = this.hass ? resolveMetric(this.hass, key, this._config.entities, weatherEntityId) : undefined;
    const manualValue = this._config.entities[key] ?? '';
    const listId = `mapping-list-${key}`;
    const suggestions = this._entitySuggestions(definition.domains);
    const manualInvalid = Boolean(manualValue && this.hass && !this.hass.states[manualValue]);

    return html`
      <div class="mapping-row">
        <div class="mapping-row-header">
          <span class="mapping-name">${this._t(`metrics.${key}`)}</span>
          <span class="mapping-resolved">${this._describeResolvedMetric(resolved)}</span>
        </div>
        <div class="mapping-controls">
          <input
            type="text"
            list=${listId}
            placeholder=${this._t('editor.mapping_placeholder')}
            .value=${manualValue}
            @change=${(event: Event) => this._updateEntityOverride(key, (event.target as HTMLInputElement).value.trim())}
          />
          <datalist id=${listId}>${suggestions.map((s) => html`<option value=${s.id}>${s.label}</option>`)}</datalist>
          <button class="clear" ?disabled=${!manualValue} @click=${() => this._updateEntityOverride(key, '')}>
            ${this._t('editor.clear_override')}
          </button>
        </div>
        ${manualInvalid ? html`<p class="mapping-error">${this._t('validation.entity_not_found', { entity: manualValue })}</p>` : nothing}
      </div>
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
      <p class="helper">${this._t('editor.min_height_helper')}</p>

      <label>${this._t('editor.aspect_ratio')}</label>
      <input
        type="text"
        placeholder="16/9"
        .value=${appearance.aspect_ratio}
        @input=${(event: Event) => this._updateAppearance({ aspect_ratio: (event.target as HTMLInputElement).value })}
      />
      <p class="helper">${this._t('editor.aspect_ratio_helper')}</p>

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
    return html`
      <p class="helper">${this._t('editor.metrics_helper')}</p>
      ${metrics.map((metric) => this._renderMetricRow(metric))}
    `;
  }

  private _renderMetricRow(metric: MetricConfig) {
    const definition = METRIC_CATALOG[metric.key];
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
      </div>
    `;
  }

  // ---------------------------------------------------------------------
  // Environment zones tab
  // ---------------------------------------------------------------------

  private _addZone(): void {
    const zone: EnvironmentZoneConfig = { id: generateId('zone'), name: '', kind: 'indoor', visible: true, entities: {} };
    this._updateRoot('environment_zones', [...this._config.environment_zones, zone]);
  }

  private _updateZone(id: string, partial: Partial<EnvironmentZoneConfig>): void {
    const zones = this._config.environment_zones.map((zone) => (zone.id === id ? { ...zone, ...partial } : zone));
    this._updateRoot('environment_zones', zones);
  }

  private _updateZoneEntity(id: string, key: EnvironmentZoneEntityKey, value: string): void {
    const zones = this._config.environment_zones.map((zone) => {
      if (zone.id !== id) return zone;
      const entities = { ...zone.entities };
      if (value) {
        entities[key] = value;
      } else {
        delete entities[key];
      }
      return { ...zone, entities };
    });
    this._updateRoot('environment_zones', zones);
  }

  private _removeZone(id: string): void {
    if (!window.confirm(this._t('editor.remove_zone_confirm'))) return;
    this._updateRoot(
      'environment_zones',
      this._config.environment_zones.filter((zone) => zone.id !== id)
    );
  }

  private _moveZone(id: string, direction: -1 | 1): void {
    const zones = [...this._config.environment_zones];
    const index = zones.findIndex((zone) => zone.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= zones.length) return;
    const [item] = zones.splice(index, 1);
    zones.splice(target, 0, item);
    this._updateRoot('environment_zones', zones);
  }

  private _renderEnvironmentTab() {
    const zones = this._config.environment_zones;
    return html`
      <p class="helper">${this._t('editor.environment_helper')}</p>
      ${zones.map((zone, index) => this._renderZoneEditorCard(zone, index, zones.length))}
      <button class="secondary" @click=${this._addZone}>${this._t('editor.add_zone')}</button>
    `;
  }

  private _renderZoneEditorCard(zone: EnvironmentZoneConfig, index: number, total: number) {
    return html`
      <div class="entity-card">
        <div class="entity-card-header">
          <input
            type="text"
            placeholder=${this._t('editor.zone_name')}
            .value=${zone.name}
            @change=${(event: Event) => this._updateZone(zone.id, { name: (event.target as HTMLInputElement).value })}
          />
          <select
            @change=${(event: Event) =>
              this._updateZone(zone.id, { kind: (event.target as HTMLSelectElement).value as EnvironmentZoneKind })}
          >
            <option value="indoor" ?selected=${zone.kind === 'indoor'}>${this._t('editor.zone_kind_indoor')}</option>
            <option value="outdoor" ?selected=${zone.kind === 'outdoor'}>${this._t('editor.zone_kind_outdoor')}</option>
          </select>
          <label class="checkbox">
            <input
              type="checkbox"
              .checked=${zone.visible}
              @change=${(event: Event) => this._updateZone(zone.id, { visible: (event.target as HTMLInputElement).checked })}
            />
            ${this._t('editor.metric_visible')}
          </label>
          <button title="up" ?disabled=${index === 0} @click=${() => this._moveZone(zone.id, -1)}>▲</button>
          <button title="down" ?disabled=${index === total - 1} @click=${() => this._moveZone(zone.id, 1)}>▼</button>
          <button class="danger" @click=${() => this._removeZone(zone.id)}>${this._t('editor.remove_zone')}</button>
        </div>
        ${ENVIRONMENT_ZONE_ENTITY_KEYS.map((key) => this._renderZoneEntityRow(zone, key))}
      </div>
    `;
  }

  private _renderZoneEntityRow(zone: EnvironmentZoneConfig, key: EnvironmentZoneEntityKey) {
    const value = zone.entities[key] ?? '';
    const listId = `zone-${zone.id}-${key}`;
    const domains = key === 'aqi' ? ['sensor', 'air_quality'] : ['sensor'];
    const suggestions = this._entitySuggestions(domains);
    const invalid = Boolean(value && this.hass && !this.hass.states[value]);
    return html`
      <div class="mapping-row nested">
        <div class="mapping-row-header">
          <span class="mapping-name">${this._t(`zone_metric.${key}`)}</span>
        </div>
        <div class="mapping-controls">
          <input
            type="text"
            list=${listId}
            placeholder=${this._t('editor.mapping_placeholder')}
            .value=${value}
            @change=${(event: Event) => this._updateZoneEntity(zone.id, key, (event.target as HTMLInputElement).value.trim())}
          />
          <datalist id=${listId}>${suggestions.map((s) => html`<option value=${s.id}>${s.label}</option>`)}</datalist>
          <button class="clear" ?disabled=${!value} @click=${() => this._updateZoneEntity(zone.id, key, '')}>
            ${this._t('editor.clear_override')}
          </button>
        </div>
        ${invalid ? html`<p class="mapping-error">${this._t('validation.entity_not_found', { entity: value })}</p>` : nothing}
      </div>
    `;
  }

  // ---------------------------------------------------------------------
  // Alerts tab
  // ---------------------------------------------------------------------

  private _addAlert(): void {
    const rule: AlertRuleConfig = {
      id: generateId('alert'),
      enabled: true,
      name: '',
      message: '',
      severity: 'info',
      logic: 'all',
      conditions: []
    };
    this._updateRoot('alerts', [...this._config.alerts, rule]);
  }

  private _updateAlert(id: string, partial: Partial<AlertRuleConfig>): void {
    const alerts = this._config.alerts.map((rule) => (rule.id === id ? { ...rule, ...partial } : rule));
    this._updateRoot('alerts', alerts);
  }

  private _removeAlert(id: string): void {
    if (!window.confirm(this._t('editor.remove_alert_confirm'))) return;
    this._updateRoot(
      'alerts',
      this._config.alerts.filter((rule) => rule.id !== id)
    );
  }

  private _addCondition(ruleId: string): void {
    const condition: AlertConditionConfig = { id: generateId('cond'), entity_id: '', operator: 'gt', threshold: 0 };
    const alerts = this._config.alerts.map((rule) =>
      rule.id === ruleId ? { ...rule, conditions: [...rule.conditions, condition] } : rule
    );
    this._updateRoot('alerts', alerts);
  }

  private _updateCondition(ruleId: string, conditionId: string, partial: Partial<AlertConditionConfig>): void {
    const alerts = this._config.alerts.map((rule) => {
      if (rule.id !== ruleId) return rule;
      return {
        ...rule,
        conditions: rule.conditions.map((condition) => (condition.id === conditionId ? { ...condition, ...partial } : condition))
      };
    });
    this._updateRoot('alerts', alerts);
  }

  private _removeCondition(ruleId: string, conditionId: string): void {
    const alerts = this._config.alerts.map((rule) =>
      rule.id === ruleId ? { ...rule, conditions: rule.conditions.filter((condition) => condition.id !== conditionId) } : rule
    );
    this._updateRoot('alerts', alerts);
  }

  private _renderAlertsTab() {
    return html`
      <p class="helper">${this._t('editor.alerts_helper')}</p>
      <p class="helper">${this._t('editor.alerts_example')}</p>
      ${this._config.alerts.map((rule) => this._renderAlertCard(rule))}
      <button class="secondary" @click=${this._addAlert}>${this._t('editor.add_alert')}</button>
    `;
  }

  private _renderAlertCard(rule: AlertRuleConfig) {
    return html`
      <div class="entity-card">
        <div class="entity-card-header">
          <input
            type="text"
            placeholder=${this._t('editor.alert_name')}
            .value=${rule.name}
            @change=${(event: Event) => this._updateAlert(rule.id, { name: (event.target as HTMLInputElement).value })}
          />
          <label class="checkbox">
            <input
              type="checkbox"
              .checked=${rule.enabled}
              @change=${(event: Event) => this._updateAlert(rule.id, { enabled: (event.target as HTMLInputElement).checked })}
            />
            ${this._t('editor.alert_enabled')}
          </label>
          <button class="danger" @click=${() => this._removeAlert(rule.id)}>${this._t('editor.remove_alert')}</button>
        </div>

        <label>${this._t('editor.alert_message')}</label>
        <textarea
          rows="2"
          .value=${rule.message}
          @change=${(event: Event) => this._updateAlert(rule.id, { message: (event.target as HTMLTextAreaElement).value })}
        ></textarea>

        <div class="inline-fields">
          <div>
            <label>${this._t('editor.alert_severity')}</label>
            <select
              @change=${(event: Event) =>
                this._updateAlert(rule.id, { severity: (event.target as HTMLSelectElement).value as AlertSeverity })}
            >
              ${ALERT_SEVERITIES.map(
                (severity) => html`<option value=${severity} ?selected=${rule.severity === severity}>
                  ${this._t(`editor.severity_${severity}`)}
                </option>`
              )}
            </select>
          </div>
          <div>
            <label>${this._t('editor.alert_logic')}</label>
            <select
              @change=${(event: Event) => this._updateAlert(rule.id, { logic: (event.target as HTMLSelectElement).value as AlertLogic })}
            >
              ${ALERT_LOGICS.map(
                (logic) => html`<option value=${logic} ?selected=${rule.logic === logic}>${this._t(`editor.logic_${logic}`)}</option>`
              )}
            </select>
          </div>
        </div>

        <div class="conditions">
          ${rule.conditions.map((condition) => this._renderConditionRow(rule.id, condition))}
          <button class="secondary" @click=${() => this._addCondition(rule.id)}>${this._t('editor.add_condition')}</button>
        </div>
      </div>
    `;
  }

  private _renderConditionRow(ruleId: string, condition: AlertConditionConfig) {
    const listId = `condition-${condition.id}`;
    const suggestions = this._entitySuggestions(['sensor', 'air_quality', 'weather']);
    const invalid = Boolean(condition.entity_id && this.hass && !this.hass.states[condition.entity_id]);
    const needsSecondThreshold = condition.operator === 'between' || condition.operator === 'outside';

    return html`
      <div class="condition-row">
        <input
          type="text"
          list=${listId}
          placeholder=${this._t('editor.condition_entity')}
          .value=${condition.entity_id}
          @change=${(event: Event) =>
            this._updateCondition(ruleId, condition.id, { entity_id: (event.target as HTMLInputElement).value.trim() })}
        />
        <datalist id=${listId}>${suggestions.map((s) => html`<option value=${s.id}>${s.label}</option>`)}</datalist>

        <select
          @change=${(event: Event) =>
            this._updateCondition(ruleId, condition.id, { operator: (event.target as HTMLSelectElement).value as AlertOperator })}
        >
          ${ALERT_OPERATORS.map(
            (operator) => html`<option value=${operator} ?selected=${condition.operator === operator}>
              ${this._t(`editor.operator_${operator}`)}
            </option>`
          )}
        </select>

        <input
          type="number"
          step="any"
          placeholder=${this._t('editor.condition_threshold')}
          .value=${String(condition.threshold)}
          @change=${(event: Event) =>
            this._updateCondition(ruleId, condition.id, { threshold: Number((event.target as HTMLInputElement).value) })}
        />
        ${needsSecondThreshold
          ? html`<input
              type="number"
              step="any"
              placeholder=${this._t('editor.condition_threshold2')}
              .value=${condition.threshold2 !== undefined ? String(condition.threshold2) : ''}
              @change=${(event: Event) =>
                this._updateCondition(ruleId, condition.id, { threshold2: Number((event.target as HTMLInputElement).value) })}
            />`
          : nothing}
        <button class="clear" @click=${() => this._removeCondition(ruleId, condition.id)}>${this._t('editor.remove_condition')}</button>
        ${invalid ? html`<p class="mapping-error">${this._t('validation.entity_not_found', { entity: condition.entity_id })}</p>` : nothing}
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
    select,
    textarea {
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: inherit;
      font: inherit;
    }
    textarea {
      resize: vertical;
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
    button.secondary,
    button.danger {
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
    button.danger {
      background: rgba(211, 47, 47, 0.15);
      color: #d32f2f;
    }
    button.clear {
      border: none;
      background: var(--secondary-background-color, #eee);
      border-radius: 6px;
      cursor: pointer;
      padding: 6px 10px;
    }
    button.clear:disabled {
      opacity: 0.5;
      cursor: default;
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
    .mapping-row {
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 8px;
      padding: 8px 10px;
      margin-bottom: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .mapping-row.nested {
      border: none;
      border-top: 1px dashed var(--divider-color, #e0e0e0);
      border-radius: 0;
      margin-bottom: 0;
      padding: 6px 0;
    }
    .mapping-row-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
    }
    .mapping-name {
      font-weight: 600;
    }
    .mapping-resolved {
      font-size: 0.75rem;
      opacity: 0.75;
    }
    .mapping-controls {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .mapping-controls input {
      flex: 1;
    }
    .mapping-error {
      color: #d32f2f;
      font-size: 0.75rem;
      margin: 0;
    }
    .entity-card {
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .entity-card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .entity-card-header input[type='text'] {
      flex: 1;
      min-width: 120px;
    }
    .inline-fields {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .inline-fields > div {
      display: flex;
      flex-direction: column;
    }
    .conditions {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px dashed var(--divider-color, #e0e0e0);
    }
    .condition-row {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }
    .condition-row input[type='text'] {
      flex: 1;
      min-width: 140px;
    }
    .condition-row input[type='number'] {
      width: 90px;
    }
  `;
}
