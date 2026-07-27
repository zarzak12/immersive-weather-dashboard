import type { AlertConditionConfig, AlertRuleConfig, AlertSeverity, HomeAssistant } from '../types';
import { isUnavailable } from './entity-discovery';

export interface EvaluatedAlertCondition {
  id: string;
  met: boolean;
}

export interface EvaluatedAlert {
  id: string;
  name: string;
  message: string;
  severity: AlertSeverity;
  /** True only when the rule is enabled, has at least one condition, and its all/any logic is satisfied. */
  active: boolean;
  conditions: EvaluatedAlertCondition[];
}

/** Parses the numeric state of an entity, or undefined when missing/unavailable/non-numeric. */
function parseNumericState(hass: HomeAssistant, entityId: string): number | undefined {
  const entity = hass.states[entityId];
  if (!entity || isUnavailable(entity)) return undefined;
  const numeric = Number(entity.state);
  return Number.isFinite(numeric) ? numeric : undefined;
}

/**
 * Evaluates a single numeric condition against live Home Assistant state.
 * A condition referencing a missing/unavailable/non-numeric entity, or an
 * incomplete `between`/`outside` range, always evaluates to false.
 */
export function evaluateCondition(hass: HomeAssistant, condition: AlertConditionConfig): boolean {
  const value = parseNumericState(hass, condition.entity_id);
  if (value === undefined) return false;

  switch (condition.operator) {
    case 'gt':
      return value > condition.threshold;
    case 'gte':
      return value >= condition.threshold;
    case 'lt':
      return value < condition.threshold;
    case 'lte':
      return value <= condition.threshold;
    case 'eq':
      return value === condition.threshold;
    case 'between': {
      if (condition.threshold2 === undefined) return false;
      const low = Math.min(condition.threshold, condition.threshold2);
      const high = Math.max(condition.threshold, condition.threshold2);
      return value >= low && value <= high;
    }
    case 'outside': {
      if (condition.threshold2 === undefined) return false;
      const low = Math.min(condition.threshold, condition.threshold2);
      const high = Math.max(condition.threshold, condition.threshold2);
      return value < low || value > high;
    }
    default:
      return false;
  }
}

/**
 * Evaluates every configured alert rule against live Home Assistant state.
 * This is a pure, display-only evaluator: it never calls Home Assistant
 * services or fires notifications, and it is safe to call on every render.
 */
export function evaluateAlerts(hass: HomeAssistant, alerts: AlertRuleConfig[]): EvaluatedAlert[] {
  return alerts.map((rule) => {
    const conditions = rule.conditions.map((condition) => ({ id: condition.id, met: evaluateCondition(hass, condition) }));
    const hasConditions = conditions.length > 0;
    const logicSatisfied = hasConditions
      ? rule.logic === 'any'
        ? conditions.some((condition) => condition.met)
        : conditions.every((condition) => condition.met)
      : false;

    return {
      id: rule.id,
      name: rule.name,
      message: rule.message,
      severity: rule.severity,
      active: rule.enabled && hasConditions && logicSatisfied,
      conditions
    };
  });
}
