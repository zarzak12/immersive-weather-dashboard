import type { MetricKey } from '../types';

export interface MetricDefinition {
  key: MetricKey;
  weatherAttribute?: string;
  deviceClasses: string[];
  domains: string[];
  keywords: string[];
  keywordRequired?: boolean;
  defaultIcon: string;
}

/**
 * Static catalog describing, for every supported metric, which weather-entity
 * attribute maps to it and which sensor device classes / keywords are acceptable
 * matches during auto-discovery.
 */
export const METRIC_CATALOG: Record<MetricKey, MetricDefinition> = {
  outdoor_temperature: {
    key: 'outdoor_temperature',
    weatherAttribute: 'temperature',
    deviceClasses: ['temperature'],
    domains: ['sensor'],
    keywords: [
      'outdoor_temperature',
      'exterior_temperature',
      'outdoor',
      'exterieur',
      'exterieure',
      'dehors',
      'outside',
      'garden',
      'jardin',
      'temperature_exterieure',
      'ext_temperature',
      'weather_temperature',
      'station_meteo',
      'meteo'
    ],
    keywordRequired: true,
    defaultIcon: 'mdi:thermometer'
  },
  apparent_temperature: {
    key: 'apparent_temperature',
    weatherAttribute: 'apparent_temperature',
    deviceClasses: ['temperature'],
    domains: ['sensor'],
    keywords: ['feels_like', 'feelslike', 'apparent', 'ressenti'],
    keywordRequired: true,
    defaultIcon: 'mdi:thermometer-lines'
  },
  humidity: {
    key: 'humidity',
    weatherAttribute: 'humidity',
    deviceClasses: ['humidity'],
    domains: ['sensor'],
    keywords: ['humidity', 'humidite'],
    defaultIcon: 'mdi:water-percent'
  },
  pressure: {
    key: 'pressure',
    weatherAttribute: 'pressure',
    deviceClasses: ['pressure', 'atmospheric_pressure'],
    domains: ['sensor'],
    keywords: ['pressure', 'pression'],
    defaultIcon: 'mdi:gauge'
  },
  wind_speed: {
    key: 'wind_speed',
    weatherAttribute: 'wind_speed',
    deviceClasses: ['wind_speed'],
    domains: ['sensor'],
    keywords: ['wind_speed', 'windspeed', 'vitesse_vent'],
    defaultIcon: 'mdi:weather-windy'
  },
  wind_bearing: {
    key: 'wind_bearing',
    weatherAttribute: 'wind_bearing',
    deviceClasses: ['wind_direction'],
    domains: ['sensor'],
    keywords: ['wind_bearing', 'wind_direction', 'direction_vent'],
    keywordRequired: true,
    defaultIcon: 'mdi:compass-outline'
  },
  wind_gust: {
    key: 'wind_gust',
    weatherAttribute: 'wind_gust_speed',
    deviceClasses: ['wind_speed'],
    domains: ['sensor'],
    keywords: ['gust', 'rafale'],
    keywordRequired: true,
    defaultIcon: 'mdi:weather-windy-variant'
  },
  precipitation: {
    key: 'precipitation',
    deviceClasses: ['precipitation', 'precipitation_intensity'],
    domains: ['sensor'],
    keywords: ['precipitation', 'rain', 'pluie', 'precipitations'],
    defaultIcon: 'mdi:weather-rainy'
  },
  precipitation_probability: {
    key: 'precipitation_probability',
    deviceClasses: ['precipitation_probability'],
    domains: ['sensor'],
    keywords: ['precipitation_probability', 'pop', 'chance_of_rain', 'probabilite'],
    defaultIcon: 'mdi:weather-pouring'
  },
  uv_index: {
    key: 'uv_index',
    weatherAttribute: 'uv_index',
    deviceClasses: ['uv_index'],
    domains: ['sensor'],
    keywords: ['uv_index', 'uv'],
    defaultIcon: 'mdi:weather-sunny-alert'
  },
  visibility: {
    key: 'visibility',
    weatherAttribute: 'visibility',
    deviceClasses: ['distance'],
    domains: ['sensor'],
    keywords: ['visibility', 'visibilite'],
    keywordRequired: true,
    defaultIcon: 'mdi:eye-outline'
  },
  dew_point: {
    key: 'dew_point',
    weatherAttribute: 'dew_point',
    deviceClasses: ['temperature'],
    domains: ['sensor'],
    keywords: ['dew_point', 'dewpoint', 'point_de_rosee'],
    keywordRequired: true,
    defaultIcon: 'mdi:thermometer-water'
  },
  cloud_coverage: {
    key: 'cloud_coverage',
    weatherAttribute: 'cloud_coverage',
    deviceClasses: [],
    domains: ['sensor'],
    keywords: ['cloud_coverage', 'cloud_cover', 'nuage'],
    defaultIcon: 'mdi:cloud-outline'
  },
  ozone: {
    key: 'ozone',
    weatherAttribute: 'ozone',
    deviceClasses: ['ozone'],
    domains: ['sensor'],
    keywords: ['ozone'],
    defaultIcon: 'mdi:molecule'
  },
  air_quality: {
    key: 'air_quality',
    deviceClasses: ['aqi'],
    domains: ['sensor', 'air_quality'],
    keywords: ['air_quality', 'aqi', 'qualite_air'],
    defaultIcon: 'mdi:air-filter'
  },
  sunrise: {
    key: 'sunrise',
    deviceClasses: ['timestamp'],
    domains: ['sensor'],
    keywords: ['sunrise', 'lever_soleil', 'lever_du_soleil'],
    keywordRequired: true,
    defaultIcon: 'mdi:weather-sunset-up'
  },
  sunset: {
    key: 'sunset',
    deviceClasses: ['timestamp'],
    domains: ['sensor'],
    keywords: ['sunset', 'coucher_soleil', 'coucher_du_soleil'],
    keywordRequired: true,
    defaultIcon: 'mdi:weather-sunset-down'
  }
};
