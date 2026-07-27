import type { HomeAssistant, ImmersiveWeatherCardConfig } from '../types';

export interface ValidationIssue {
  field: string;
  messageKey: string;
  vars?: Record<string, string | number>;
}

/**
 * Validates a merged configuration against the current Home Assistant state.
 * Returns a list of human-readable issues; an empty array means the config is usable.
 * This never throws so the card can render a helpful message instead of crashing.
 */
export function validateConfig(config: ImmersiveWeatherCardConfig, hass: HomeAssistant | undefined): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (config.weather_entity) {
    const state = hass?.states[config.weather_entity];
    if (!state) {
      issues.push({ field: 'weather_entity', messageKey: 'validation.weather_not_found', vars: { entity: config.weather_entity } });
    } else if (!config.weather_entity.startsWith('weather.')) {
      issues.push({ field: 'weather_entity', messageKey: 'validation.not_weather', vars: { entity: config.weather_entity } });
    }
  }

  for (const [metric, entityId] of Object.entries(config.entities)) {
    if (!entityId) continue;
    const state = hass?.states[entityId];
    if (!state) {
      issues.push({ field: `entities.${metric}`, messageKey: 'validation.entity_not_found', vars: { entity: entityId } });
    }
  }

  for (const zone of config.environment_zones) {
    for (const [metric, entityId] of Object.entries(zone.entities)) {
      if (!entityId) continue;
      const state = hass?.states[entityId];
      if (!state) {
        issues.push({
          field: `environment_zones.${zone.id}.${metric}`,
          messageKey: 'validation.zone_entity_not_found',
          vars: { entity: entityId, zone: zone.name || zone.id }
        });
      }
    }
  }

  for (const rule of config.alerts) {
    for (const condition of rule.conditions) {
      if (!condition.entity_id) {
        issues.push({
          field: `alerts.${rule.id}.${condition.id}`,
          messageKey: 'validation.alert_entity_required',
          vars: { alert: rule.name || rule.id }
        });
      } else if (hass && !hass.states[condition.entity_id]) {
        issues.push({
          field: `alerts.${rule.id}.${condition.id}`,
          messageKey: 'validation.alert_entity_not_found',
          vars: { entity: condition.entity_id, alert: rule.name || rule.id }
        });
      }
      if ((condition.operator === 'between' || condition.operator === 'outside') && condition.threshold2 === undefined) {
        issues.push({
          field: `alerts.${rule.id}.${condition.id}.threshold2`,
          messageKey: 'validation.alert_range_incomplete',
          vars: { alert: rule.name || rule.id }
        });
      }
    }
  }

  if (config.appearance.panel_opacity < 0 || config.appearance.panel_opacity > 1) {
    issues.push({ field: 'appearance.panel_opacity', messageKey: 'validation.panel_opacity' });
  }
  if (config.appearance.min_height < 200) {
    issues.push({ field: 'appearance.min_height', messageKey: 'validation.min_height' });
  }
  if (config.animation.intensity < 0 || config.animation.intensity > 2) {
    issues.push({ field: 'animation.intensity', messageKey: 'validation.intensity' });
  }

  return issues;
}
