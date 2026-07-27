import type { HomeAssistant, SceneMode } from '../types';

export type SceneCategory =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'pouring'
  | 'snow'
  | 'snowy-rainy'
  | 'hail'
  | 'thunderstorm'
  | 'windy';

const CONDITION_TO_SCENE: Record<string, SceneCategory> = {
  'clear-night': 'clear',
  sunny: 'clear',
  partlycloudy: 'partly-cloudy',
  cloudy: 'cloudy',
  fog: 'fog',
  rainy: 'rain',
  pouring: 'pouring',
  snowy: 'snow',
  'snowy-rainy': 'snowy-rainy',
  hail: 'hail',
  lightning: 'thunderstorm',
  'lightning-rainy': 'thunderstorm',
  windy: 'windy',
  'windy-variant': 'windy',
  exceptional: 'cloudy'
};

/** Maps a Home Assistant weather condition string to the internal scene category used by the renderer. */
export function conditionToScene(condition: string | undefined): SceneCategory {
  if (!condition) return 'clear';
  return CONDITION_TO_SCENE[condition] ?? 'cloudy';
}

/** True when the condition explicitly represents night-time (e.g. "clear-night"). */
export function isExplicitNightCondition(condition: string | undefined): boolean {
  return condition === 'clear-night';
}

/**
 * Determines whether the scene should render as daytime, honoring a forced
 * scene mode, the `sun.sun` entity state, and falling back to local wall-clock
 * hours when the sun entity is unavailable.
 */
export function isDaytime(hass: HomeAssistant | undefined, sceneMode: SceneMode, condition?: string): boolean {
  if (sceneMode === 'day') return true;
  if (sceneMode === 'night') return false;
  if (isExplicitNightCondition(condition)) return false;

  const sun = hass?.states['sun.sun'];
  if (sun && sun.state !== 'unavailable' && sun.state !== 'unknown') {
    return sun.state === 'above_horizon';
  }

  const hour = new Date().getHours();
  return hour >= 7 && hour < 20;
}
