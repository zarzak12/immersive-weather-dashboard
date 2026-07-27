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
