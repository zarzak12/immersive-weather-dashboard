import type { ForecastAttribute, ForecastType, HomeAssistant } from '../types';

interface ForecastMessage {
  forecast: ForecastAttribute[];
}

interface WebSocketErrorLike {
  code?: string;
  message?: string;
}

function isUnsupportedForecastError(error: unknown): boolean {
  const wsError = error as WebSocketErrorLike | undefined;
  return wsError?.code === 'not_supported' || wsError?.code === 'unknown_command';
}

/**
 * Subscribes to live forecast updates for a weather entity using the
 * `weather/subscribe_forecast` websocket command. Returns an unsubscribe
 * function, or undefined if the entity/forecast type is not supported (this
 * is expected and handled explicitly, not a silent catch-all).
 */
export async function subscribeForecast(
  hass: HomeAssistant,
  entityId: string,
  forecastType: ForecastType,
  callback: (forecast: ForecastAttribute[]) => void
): Promise<(() => Promise<void>) | undefined> {
  try {
    return await hass.connection.subscribeMessage<ForecastMessage>((message) => callback(message.forecast ?? []), {
      type: 'weather/subscribe_forecast',
      entity_id: entityId,
      forecast_type: forecastType
    });
  } catch (error) {
    if (isUnsupportedForecastError(error)) {
      return undefined;
    }
    console.error(`[immersive-weather-dashboard] failed to subscribe to ${forecastType} forecast for ${entityId}`, error);
    return undefined;
  }
}
