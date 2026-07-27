import { describe, expect, it } from 'vitest';
import { evaluateAlerts, evaluateCondition } from '../src/data/alerts';
import type { AlertConditionConfig, AlertRuleConfig, HassEntity, HomeAssistant } from '../src/types';

function entity(entityId: string, state: string, attributes: Record<string, unknown> = {}): HassEntity {
  return { entity_id: entityId, state, attributes, last_changed: '', last_updated: '' };
}

function makeHass(entities: HassEntity[]): HomeAssistant {
  const states: Record<string, HassEntity> = {};
  for (const item of entities) states[item.entity_id] = item;
  return {
    states,
    locale: { language: 'en' },
    language: 'en',
    config: { latitude: 0, longitude: 0, unit_system: { length: 'km', temperature: '°C', pressure: 'hPa' } },
    themes: {},
    connection: { subscribeMessage: async () => async () => undefined },
    callWS: async () => ({}) as never
  };
}

function condition(overrides: Partial<AlertConditionConfig> = {}): AlertConditionConfig {
  return {
    id: 'cond-1',
    entity_id: 'sensor.value',
    operator: 'gt',
    threshold: 10,
    ...overrides
  };
}

function rule(overrides: Partial<AlertRuleConfig> = {}): AlertRuleConfig {
  return {
    id: 'rule-1',
    enabled: true,
    name: 'Test rule',
    message: 'Test message',
    severity: 'warning',
    logic: 'all',
    conditions: [condition()],
    ...overrides
  };
}

describe('evaluateCondition operators', () => {
  it('gt is satisfied only when the value is strictly greater', () => {
    const hass = makeHass([entity('sensor.value', '11')]);
    expect(evaluateCondition(hass, condition({ operator: 'gt', threshold: 10 }))).toBe(true);
    expect(evaluateCondition(hass, condition({ operator: 'gt', threshold: 11 }))).toBe(false);
  });

  it('gte is satisfied when the value is greater or equal', () => {
    const hass = makeHass([entity('sensor.value', '10')]);
    expect(evaluateCondition(hass, condition({ operator: 'gte', threshold: 10 }))).toBe(true);
    expect(evaluateCondition(hass, condition({ operator: 'gte', threshold: 11 }))).toBe(false);
  });

  it('lt is satisfied only when the value is strictly lower', () => {
    const hass = makeHass([entity('sensor.value', '9')]);
    expect(evaluateCondition(hass, condition({ operator: 'lt', threshold: 10 }))).toBe(true);
    expect(evaluateCondition(hass, condition({ operator: 'lt', threshold: 9 }))).toBe(false);
  });

  it('lte is satisfied when the value is lower or equal', () => {
    const hass = makeHass([entity('sensor.value', '10')]);
    expect(evaluateCondition(hass, condition({ operator: 'lte', threshold: 10 }))).toBe(true);
    expect(evaluateCondition(hass, condition({ operator: 'lte', threshold: 9 }))).toBe(false);
  });

  it('eq is satisfied only for an exact numeric match', () => {
    const hass = makeHass([entity('sensor.value', '10')]);
    expect(evaluateCondition(hass, condition({ operator: 'eq', threshold: 10 }))).toBe(true);
    expect(evaluateCondition(hass, condition({ operator: 'eq', threshold: 10.1 }))).toBe(false);
  });

  it('between is inclusive and order-independent', () => {
    const hass = makeHass([entity('sensor.value', '12')]);
    expect(evaluateCondition(hass, condition({ operator: 'between', threshold: 12, threshold2: 28 }))).toBe(true);
    expect(evaluateCondition(hass, condition({ operator: 'between', threshold: 28, threshold2: 12 }))).toBe(true);
    expect(evaluateCondition(hass, condition({ operator: 'between', threshold: 13, threshold2: 28 }))).toBe(false);
  });

  it('between is false when threshold2 is missing', () => {
    const hass = makeHass([entity('sensor.value', '15')]);
    expect(evaluateCondition(hass, condition({ operator: 'between', threshold: 10, threshold2: undefined }))).toBe(false);
  });

  it('outside is strictly exclusive of the range and order-independent', () => {
    const hass = makeHass([entity('sensor.value', '30')]);
    expect(evaluateCondition(hass, condition({ operator: 'outside', threshold: 12, threshold2: 28 }))).toBe(true);
    expect(evaluateCondition(hass, condition({ operator: 'outside', threshold: 28, threshold2: 12 }))).toBe(true);
    expect(evaluateCondition(hass, condition({ operator: 'outside', threshold: 12, threshold2: 30 }))).toBe(false);
    expect(evaluateCondition(hass, condition({ operator: 'outside', threshold: 12, threshold2: 28 })) ).toBe(true);
  });

  it('outside is false when the value is exactly on a boundary (inclusive range excluded)', () => {
    const hass = makeHass([entity('sensor.value', '28')]);
    expect(evaluateCondition(hass, condition({ operator: 'outside', threshold: 12, threshold2: 28 }))).toBe(false);
  });

  it('outside is false when threshold2 is missing', () => {
    const hass = makeHass([entity('sensor.value', '50')]);
    expect(evaluateCondition(hass, condition({ operator: 'outside', threshold: 10, threshold2: undefined }))).toBe(false);
  });
});

describe('evaluateCondition edge cases', () => {
  it('is false when the entity is missing', () => {
    const hass = makeHass([]);
    expect(evaluateCondition(hass, condition())).toBe(false);
  });

  it('is false when the entity is unavailable or unknown', () => {
    const hass = makeHass([entity('sensor.value', 'unavailable')]);
    expect(evaluateCondition(hass, condition())).toBe(false);
    const hass2 = makeHass([entity('sensor.value', 'unknown')]);
    expect(evaluateCondition(hass2, condition())).toBe(false);
  });

  it('is false when the entity state is not numeric', () => {
    const hass = makeHass([entity('sensor.value', 'not_a_number')]);
    expect(evaluateCondition(hass, condition())).toBe(false);
  });

  it('is false when the entity state is not finite', () => {
    const hass = makeHass([entity('sensor.value', 'Infinity')]);
    expect(evaluateCondition(hass, condition())).toBe(false);
  });
});

describe('evaluateAlerts', () => {
  it('marks a disabled rule as inactive even if its conditions are satisfied', () => {
    const hass = makeHass([entity('sensor.value', '20')]);
    const result = evaluateAlerts(hass, [rule({ enabled: false })]);
    expect(result[0].active).toBe(false);
  });

  it('marks a rule with no conditions as inactive', () => {
    const hass = makeHass([]);
    const result = evaluateAlerts(hass, [rule({ conditions: [] })]);
    expect(result[0].active).toBe(false);
  });

  it('with "all" logic, the rule is active only when every condition is met', () => {
    const hass = makeHass([entity('sensor.a', '5'), entity('sensor.b', '5')]);
    const rules = [
      rule({
        logic: 'all',
        conditions: [
          condition({ id: 'c1', entity_id: 'sensor.a', operator: 'gt', threshold: 1 }),
          condition({ id: 'c2', entity_id: 'sensor.b', operator: 'gt', threshold: 100 })
        ]
      })
    ];
    expect(evaluateAlerts(hass, rules)[0].active).toBe(false);

    rules[0].conditions[1] = condition({ id: 'c2', entity_id: 'sensor.b', operator: 'gt', threshold: 1 });
    expect(evaluateAlerts(hass, rules)[0].active).toBe(true);
  });

  it('with "any" logic, the rule is active when at least one condition is met', () => {
    const hass = makeHass([entity('sensor.a', '5'), entity('sensor.b', '5')]);
    const rules = [
      rule({
        logic: 'any',
        conditions: [
          condition({ id: 'c1', entity_id: 'sensor.a', operator: 'gt', threshold: 100 }),
          condition({ id: 'c2', entity_id: 'sensor.b', operator: 'gt', threshold: 1 })
        ]
      })
    ];
    expect(evaluateAlerts(hass, rules)[0].active).toBe(true);
  });

  it('is inactive when a referenced entity is missing or unavailable', () => {
    const hass = makeHass([entity('sensor.b', 'unavailable')]);
    const rules = [
      rule({
        logic: 'any',
        conditions: [
          condition({ id: 'c1', entity_id: 'sensor.missing', operator: 'gt', threshold: 1 }),
          condition({ id: 'c2', entity_id: 'sensor.b', operator: 'gt', threshold: 1 })
        ]
      })
    ];
    expect(evaluateAlerts(hass, rules)[0].active).toBe(false);
  });

  it('reproduces the "open windows" example: indoor CO2 > 1000 AND outdoor AQI < 50 AND outdoor temperature between 12 and 28', () => {
    const hass = makeHass([
      entity('sensor.indoor_co2', '1200'),
      entity('sensor.outdoor_aqi', '30'),
      entity('sensor.outdoor_temperature', '20')
    ]);
    const openWindows = rule({
      id: 'open-windows',
      name: 'Open windows',
      logic: 'all',
      conditions: [
        condition({ id: 'c1', entity_id: 'sensor.indoor_co2', operator: 'gt', threshold: 1000 }),
        condition({ id: 'c2', entity_id: 'sensor.outdoor_aqi', operator: 'lt', threshold: 50 }),
        condition({ id: 'c3', entity_id: 'sensor.outdoor_temperature', operator: 'between', threshold: 12, threshold2: 28 })
      ]
    });
    expect(evaluateAlerts(hass, [openWindows])[0].active).toBe(true);

    const hassOutOfRange = makeHass([
      entity('sensor.indoor_co2', '1200'),
      entity('sensor.outdoor_aqi', '30'),
      entity('sensor.outdoor_temperature', '5')
    ]);
    expect(evaluateAlerts(hassOutOfRange, [openWindows])[0].active).toBe(false);
  });

  it('returns per-condition met flags alongside the overall active state', () => {
    const hass = makeHass([entity('sensor.a', '5')]);
    const rules = [
      rule({
        logic: 'all',
        conditions: [condition({ id: 'c1', entity_id: 'sensor.a', operator: 'gt', threshold: 1 })]
      })
    ];
    const [result] = evaluateAlerts(hass, rules);
    expect(result.conditions).toEqual([{ id: 'c1', met: true }]);
    expect(result.id).toBe('rule-1');
    expect(result.name).toBe('Test rule');
    expect(result.message).toBe('Test message');
    expect(result.severity).toBe('warning');
  });
});
