# Immersive Weather Dashboard

**A full-screen, procedurally animated weather scene for Home Assistant — your own house photo, live sky and weather rendered locally behind it, configured entirely through a graphical editor.**

🇫🇷 [Lire ce document en français](README.fr.md)

---

## Table of contents

- [Concept](#concept)
- [Feature tour](#feature-tour)
- [Requirements](#requirements)
- [Installation](#installation)
  - [HACS (recommended)](#hacs-recommended)
  - [Manual installation](#manual-installation)
- [Visual setup, step by step](#visual-setup-step-by-step)
- [Layout: scene viewport and information area](#layout-scene-viewport-and-information-area)
- [How the image layering works](#how-the-image-layering-works)
- [Configuration reference](#configuration-reference)
- [Auto-discovery algorithm and manual overrides](#auto-discovery-algorithm-and-manual-overrides)
- [Entity mapping tab and outdoor station overrides (e.g. an ESP32 weather station)](#entity-mapping-tab-and-outdoor-station-overrides-eg-an-esp32-weather-station)
- [Metric / entity reference table](#metric--entity-reference-table)
- [Environment zones (unlimited indoor/outdoor rooms and air quality)](#environment-zones-unlimited-indooroutdoor-rooms-and-air-quality)
- [Visual alert / recommendation rules](#visual-alert--recommendation-rules)
- [Comfort analysis (condensation risk)](#comfort-analysis-condensation-risk)
- [Forecasts](#forecasts)
- [Responsiveness, performance, accessibility, privacy](#responsiveness-performance-accessibility-privacy)
- [Troubleshooting](#troubleshooting)
- [Updating and removing the card](#updating-and-removing-the-card)
- [Migration and configuration compatibility](#migration-and-configuration-compatibility)
- [Development](#development)
- [FAQ](#faq)
- [Limitations](#limitations)
- [AI prompt to prepare your house photo](#ai-prompt-to-prepare-your-house-photo)
- [License](#license)

## Concept

Immersive Weather Dashboard turns a single Lovelace card into a full-screen weather scene. You provide a photo of your own house with the sky cut out (real alpha transparency). The card renders a **procedural, locally computed** animated sky behind that photo: gradients for day/night, sun/moon, stars, moving clouds, rain, pouring rain, snow, mixed snow/rain, hail, fog, wind and thunderstorms with lightning. Everything is drawn with the Canvas 2D API at runtime — **no video files, no cloud rendering service, no network calls** are used to produce the animation.

The result is a dashboard/wall-panel card that feels alive and reacts to your actual weather entity and sensors, while keeping your own house recognizable in the foreground.

<img width="804" height="4093" alt="image" src="https://github.com/user-attachments/assets/87d0b55d-3d57-4685-ab1d-4589704f819d" />


## Feature tour

- Full-screen immersive layout, designed for phones, tablets, desktop dashboards and wall-mounted panels. By default the animated **scene stays a compact, unobstructed viewport at the top** of the card, with all metrics, zones, alerts and forecasts flowing naturally below it — nothing overlaps the house photo or the sky.
- **Responsive information area** — when the card is given width (for example stretched toward full width in a **Sections** dashboard), the panels below the scene flow into a **multi-column masonry layout** instead of one long vertical band, and collapse back to a single column on phones. The column count follows the card's actual rendered width, not the browser window.
- Procedural sky/weather engine: day/night gradient, sun, moon, twinkling stars, drifting clouds, rain, pouring rain, snow, snow+rain mix, hail, fog, wind streaks, lightning flashes for thunderstorms.
- Discreet glassmorphism panels (blurred, translucent) for the current conditions, the outdoor station, environment zones, alerts and the forecasts, so the scene stays visible underneath and the information underneath stays fully readable.
- Full graphical configuration — **no YAML editing is required** after installing through HACS. Every option (image, colors, opacity, metrics, environment zones, alert rules, forecasts…) has a UI control.
- Reliable automatic entity detection with a deterministic scoring algorithm that **rejects sensors whose `device_class` is explicitly incompatible** with the metric (so, for example, an "apparent power" sensor can never be mistaken for "feels like" temperature just because both mention "apparent"), plus a dedicated **Entity mapping** tab for manual overrides — ideal for wiring up a real outdoor weather station (e.g. an ESP32-based one) to override provider-supplied outdoor temperature/humidity/pressure.
- **Unlimited environment zones** — add as many indoor and/or outdoor zones as you like (bedrooms, living room, garage, greenhouse…), each with its own manually-mapped temperature, humidity and air-quality (AQI, CO₂, PM2.5, PM10, VOC) entities.
- **Visual, display-only alert/recommendation rules** — build your own multi-condition recommendations (e.g. "Open the windows") from any numeric entities, shown prominently at the top of the information area. These are purely visual and only evaluated while the card is on screen; the card never calls Home Assistant services or fires notifications.
- Live forecast subscriptions using the modern `weather/subscribe_forecast` WebSocket API (daily and hourly), with graceful handling when a weather integration does not support a given forecast type.
- Respects `prefers-reduced-motion`, pauses rendering when the card is scrolled off-screen or the browser tab is hidden, and caps the device pixel ratio to control GPU/CPU cost.
- Animation quality and intensity controls so low-power wall tablets and Raspberry Pi displays stay smooth.
- English and French interface, following `hass.locale.language`, with English fallback.
- Optional **Comfort analysis** — an educational, display-only condensation risk panel (disabled by default). Computes dew point (Magnus formula), absolute humidity (g/m³), and condensation margin from outdoor readings and the selected indoor zone; shows fixed safe/warning/critical risk bands; supports an optional glazing or surface temperature sensor, or a configurable glazing-factor fallback estimate (default 0.15, explicitly labeled as an estimate). It renders as two tiles (**Outdoor conditions** and **Home & comfort**) that take part in the responsive layout. Technical values carry **educational tooltips**, revealed by hovering, keyboard-focusing or tapping the value itself — with no separate "?" button cluttering the display.
- Optional **Sun path tile** — a horizon-to-horizon arc of the sun's daily trajectory with sunrise, solar noon and sunset, the live sun position, plus azimuth, elevation, day length and (hemisphere-aware) season, computed locally from your Home Assistant location.
- Optional **Moon tile** — a moon-phase disc showing the current illumination (waxing/waning, crescent → gibbous), the phase name and illuminated percentage, moonrise/moonset, azimuth and elevation, computed locally.
- **Dawn and dusk in the sky** — in automatic day/night mode the procedural sky transitions through warm sunrise/sunset colours based on the sun's real elevation, and the sun disc sits low and golden near the horizon at dawn and dusk. Celestial positions and the sky refresh continuously, not only on Home Assistant state changes.

## Requirements

- Home Assistant **2024.8** or newer (uses the modern Lovelace custom card lifecycle and the `weather/subscribe_forecast` WebSocket command introduced in HA core's forecast rework).
- [HACS](https://hacs.xyz/) if you want one-click installation and updates (manual installation is also fully supported, see below).
- At least one `weather.*` entity. Sensor entities are optional but recommended for a complete metrics station.
- Your own house photo with a transparent sky (see [AI prompt](#ai-prompt-to-prepare-your-house-photo) below to help you produce one).

## Installation

### HACS (recommended)

[![Open the repository in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=zarzak12&repository=immersive-weather-dashboard&category=plugin)

1. In Home Assistant, open **HACS → Frontend**.
2. Click the **⋮** menu → **Custom repositories**.
3. Add `https://github.com/zarzak12/immersive-weather-dashboard`, category **Dashboard** (Lovelace plugin). The button above can open this repository directly in HACS.
4. Search for **Immersive Weather Dashboard** in HACS and click **Download**.
5. Reload the frontend (HACS usually prompts you; otherwise clear your browser cache — see [Troubleshooting](#troubleshooting)).
6. Add a new card to any dashboard, search for **Immersive Weather Dashboard** in the card picker, and configure it with the graphical editor.

HACS installs the single bundled file `dist/immersive-weather-dashboard.js` and registers the Lovelace resource automatically.

### Manual installation

1. Download `immersive-weather-dashboard.js` from the [latest release](https://github.com/zarzak12/immersive-weather-dashboard/releases/latest) (or build it yourself, see [Development](#development)).
2. Copy it to `config/www/immersive-weather-dashboard.js` in your Home Assistant installation.
3. In **Settings → Dashboards → ⋮ → Resources**, add a resource:
   - URL: `/local/immersive-weather-dashboard.js`
   - Resource type: **JavaScript module**
4. Reload the frontend and add the card from the card picker as above.

## Visual setup, step by step

1. Prepare your house photo with a transparent sky (PNG or WebP, real alpha channel — see the [AI prompt](#ai-prompt-to-prepare-your-house-photo)).
2. Upload the file to `config/www/` (for example `config/www/house.png`), so it is reachable at `/local/house.png`, or host it on any HTTPS URL you control.
3. Add the card to a dashboard, open the card editor, and in the **Image & scene** tab paste the image path (`/local/house.png`) into **House image URL**. If the house looks zoomed, select **Show the entire image**, then adjust zoom and horizontal/vertical position. For a 4:3 photo, a 4/3 scene aspect ratio gives the closest framing.
4. Pick your **Weather entity** in the **Data source** tab, or leave it empty to let the card auto-detect the best one.
5. Adjust **Appearance** (panel opacity/blur/corner radius, accent/text colors, scene minimum height, scene aspect ratio, density) to match your theme and screen — these now size the top **scene viewport only**, not the whole card (see [Layout](#layout-scene-viewport-and-information-area)).
6. Enable/disable **Forecasts** and choose how many hourly/daily items to display.
7. Open **Station metrics** to reorder, hide, relabel, recolor or restyle any of the seventeen supported metrics (including the new **outdoor temperature**).
8. Open **Entity mapping / Association des entités** to see, for every metric, exactly which entity or weather attribute the card resolved, and to type a manual override — this is where you point the card at your own outdoor weather station (e.g. an ESP32) instead of your weather provider (see [Entity mapping tab](#entity-mapping-tab-and-outdoor-station-overrides-eg-an-esp32-weather-station)).
9. Open **Environment / Environnement** to add any number of indoor/outdoor zones (bedroom, living room, garage…) and manually map their temperature/humidity/air-quality entities.
10. Open **Alerts / Alertes** to build your own visual recommendation rules (for example "Open the windows") from any numeric entities (see [Visual alert rules](#visual-alert--recommendation-rules)).
11. Optionally click **Auto-configure** once you are happy with the automatic detections, to freeze them into the saved configuration (see [Auto-discovery](#auto-discovery-algorithm-and-manual-overrides)).
12. Optionally open **Comfort / Confort** to enable the comfort panel: choose an indoor reference zone, optionally map a glazing or surface temperature sensor, and adjust the comfort ranges, ventilation delta, cooling delta and glazing factor (see [Comfort analysis](#comfort-analysis-condensation-risk)).

## Layout: scene viewport and information area

Starting with v1.0.1, the card is split into two clearly separated regions, stacked vertically in normal document flow:

1. **The scene** — a fixed-height viewport at the top containing only the animated sky/weather canvases, your house photo, and a small title/current-condition summary overlay. `Appearance → Minimum height` and `Appearance → Aspect ratio` size **this viewport only**. The scene never grows to accommodate other content and nothing else is drawn on top of it, so your house photo and the animation stay fully visible.
2. **The information area** — a normal-flow section below the scene containing, in order: active alert recommendations, the outdoor station metrics, environment zone cards, and forecasts. This area has **no forced height or clipping**: the card grows naturally to fit however much information you have configured, and Home Assistant's Sections view is told to honor that natural height (no more forced 8-row minimum). Forecast rows may scroll horizontally on narrow screens, but the rest of the information area is never hidden or cut off.

On a card wide enough — for example when stretched toward full width in a **Sections** dashboard — the information area no longer stacks into a single tall band. Its panels (the outdoor station, the two optional Comfort tiles, the environment zones and the forecasts) flow into a **responsive multi-column masonry layout**, sitting side by side. The number of columns follows the card's *actual rendered width* rather than the browser window, so it adapts correctly even in a narrow slot on a large screen, and collapses back to a single column on phones and narrow cards. Active alert recommendations and validation notices always span the full width.

This directly replaces the v1.0 behavior, where every panel was absolutely positioned on top of the scene (covering most of the house/sky) inside a height-constrained `.scene` element. If you are upgrading from v1.0, expect the card to look different immediately after updating — taller overall, but with an unobstructed scene and fully readable information beneath it — see [Migration and configuration compatibility](#migration-and-configuration-compatibility).

## How the image layering works

The card composites three layers, back to front:

1. **Background canvas** — sky gradient, sun/moon, stars and clouds. This sits **behind** your house photo, so it becomes visible only through the transparent sky area of your PNG/WebP.
2. **Your house photo** — the opaque foreground (house, ground, vegetation…) painted over the background canvas. Anywhere the photo is opaque, the sky animation is naturally hidden; anywhere it is transparent (the cut-out sky), the animated background shows through. The visual editor can fill the scene (cropping if ratios differ) or preserve the whole image, with independent 50–200% zoom and horizontal/vertical positioning.
3. **Foreground canvas** — rain, snow, hail, fog wisps and lightning flashes, drawn **above** your house photo. This is intentional: falling precipitation and mist realistically pass in front of a house too, not just behind it.

Because the compositing relies entirely on your image's own alpha channel, the quality of the cut-out directly determines how convincing the scene looks. A clean, precise alpha mask (no fringing, no leftover sky pixels, no over-erased antennas) is the single most important ingredient of a good result.

## Configuration reference

Everything below is configurable from the graphical editor. No YAML editing is required or expected. Home Assistant still stores the configuration internally (as it does for every card), but you never need to open or hand-edit it.

| Editor tab | Options |
| --- | --- |
| Data source | Card title, weather entity (or auto-detect) |
| Entity mapping / Association des entités | For every outdoor station metric: resolved source type, the exact resolved entity ID (or weather attribute), a searchable manual entity override, and a clear-override control |
| Image & scene | House image URL, fill/whole-image fitting, zoom (50–200%), horizontal/vertical position, framing reset, day/night mode, animation quality and intensity |
| Appearance | Panel opacity, panel blur, panel corner radius, accent color, text color, scene minimum height, scene aspect ratio, density (comfortable/compact) |
| Forecasts | Show/hide hourly forecast, show/hide daily forecast, number of hourly items, number of daily items |
| Station metrics | Per metric: visible, custom label, custom color, custom icon, and a read-only "source" indicator (manual / weather attribute / sensor / not available) — manual entity overrides now live in the **Entity mapping** tab |
| Environment / Environnement | Add/remove/reorder an unlimited number of zones; per zone: name, indoor/outdoor kind, visibility, manual entity mapping for temperature, humidity, AQI, CO₂, PM2.5, PM10 and VOC |
| Alerts / Alertes | Add/remove visual recommendation rules; per rule: name, message, severity, all/any logic, enabled toggle, and one or more numeric conditions (entity, operator, threshold(s)) |
| Comfort / Confort | Enable/disable the comfort panel; indoor zone selector (or first visible indoor zone when none selected); optional glazing/surface temperature sensor mapping; indoor temperature/RH ranges; glazing factor (default 0.15, range 0.0–1.0); ventilation absolute-humidity delta (default 2.0 g/m³, range 0.0–20.0 g/m³); cooling temperature delta |
| Sun path / Course du soleil | Enable/disable the sun-path tile (arc, sunrise/solar noon/sunset, azimuth, elevation, day length, season) |
| Moon / Lune | Enable/disable the moon tile (phase disc, illumination, moonrise/moonset, azimuth, elevation) |

Two dedicated actions are always available:

- **Reset defaults** — restores every option to its factory default (keeps the card type).
- **Auto-configure** — computes a fresh snapshot of the best-detected weather entity and sensors and **saves it** into the configuration after an explicit confirmation dialog. Until you click it, auto-detection stays purely runtime/adaptive and nothing is written to your configuration.

## Auto-discovery algorithm and manual overrides

For every one of the seventeen supported metrics, the card resolves a value using this strict priority order:

1. **Manual override** — the entity you picked explicitly for that metric (in the **Entity mapping** tab). If it exists but is `unavailable`/`unknown`, the metric is shown as unavailable rather than silently falling through (so misconfiguration is visible); if the entity ID does not exist at all, the editor surfaces a validation notice instead of silently ignoring it.
2. **Weather entity attribute** — if the selected weather entity exposes a matching attribute (e.g. `temperature`, `humidity`, `pressure`, `wind_speed`, `wind_bearing`, `wind_gust_speed`, `uv_index`, `visibility`, `dew_point`, `cloud_coverage`, `ozone`, `apparent_temperature`), it is used directly.
3. **Best-scoring sensor entity** — the card scores every `sensor.*` (and `air_quality.*` for air quality) entity in your system against the metric: `+10` for a matching `device_class`, `+5` for a matching keyword in the entity ID, `+3` for a matching keyword in the friendly name. **An entity that declares a `device_class` which is not one of the metric's accepted classes is rejected outright**, even if its ID or friendly name happens to contain a matching keyword — this specifically prevents, for example, an "apparent power" sensor (`device_class: apparent_power`, reporting VA) from ever being picked for "feels like" temperature just because both mention "apparent". Metrics whose device class is ambiguous (for example dew point versus any temperature, gust versus average wind, or sunrise versus any timestamp) additionally require a semantic keyword. Entities that are `unavailable`/`unknown`, belong to a disallowed domain, or fail these guards are rejected outright so they cannot be picked by accident. The highest-scoring entity wins; ties are broken alphabetically by entity ID for determinism.
4. **`sun.sun` entity** — used only for sunrise/sunset, reading `next_rising`/`next_setting` when no sensor was found.
5. **Not available** — if nothing qualifies, the metric is simply omitted from the station rather than showing a misleading zero.

The weather entity itself is auto-selected similarly: your configured `weather.*` entity is used if present and available; otherwise the available weather entity exposing the richest set of current station attributes is selected. Equal candidates are tie-broken alphabetically for determinism.

This algorithm runs live every time the card renders, so it naturally adapts if you add, rename or replace entities — except when you have explicitly used **Auto-configure**, which freezes the current detections into the saved configuration.

## Entity mapping tab and outdoor station overrides (e.g. an ESP32 weather station)

The **Entity mapping / Association des entités** editor tab is the single, obvious place to see and control exactly which entity feeds each outdoor station metric. For every metric it shows:

- the metric's label;
- the **resolved source type** (manual override / weather attribute / sensor / not available);
- the **exact currently resolved entity ID** (or the weather attribute name, when that's the source);
- a text input with a searchable, typeable suggestion list (`<datalist>`) of compatible entities — showing friendly names and units where available — so you can either pick a suggestion or type any valid entity ID by hand;
- a **Clear override** button to remove a manual mapping and fall back to auto-detection.

A manual override here always takes priority over auto-detection. If you type an entity ID that does not exist in your Home Assistant instance, the tab shows a validation notice instead of silently ignoring your input.

**Example: overriding outdoor temperature/humidity/pressure with a real ESP32 weather station**

1. Make sure your ESP32 station's readings are available as Home Assistant sensor entities (e.g. via ESPHome, MQTT or Tasmota), for example `sensor.esp32_outdoor_temperature`, `sensor.esp32_outdoor_humidity`, `sensor.esp32_outdoor_pressure`.
2. Open the card editor → **Entity mapping / Association des entités**.
3. Find **Outdoor temperature**, type or pick `sensor.esp32_outdoor_temperature` in its override field, then click/tab away to confirm — the row updates to show it as the resolved source.
4. Repeat for **Outdoor humidity** and **Pressure** with your ESP32 humidity/pressure sensors.
5. The current-condition summary at the top of the scene and the outdoor station metric both immediately reflect your ESP32 readings instead of your weather provider's data; if your ESP32 sensor becomes unavailable, the card falls back to the weather-provider value automatically.

Entity override inputs update on change/blur, not on every keystroke, so you can type a full entity ID without the card fighting your typing.

## Metric / entity reference table

| Metric | Weather attribute used | Sensor `device_class` | Typical keywords |
| --- | --- | --- | --- |
| Outdoor temperature | `temperature` | `temperature` | outdoor, exterieur, dehors, temperature |
| Feels like (apparent temperature) | `apparent_temperature` | `temperature` | feels_like, apparent, ressenti |
| Outdoor humidity | `humidity` | `humidity` | humidity, humidite |
| Pressure | `pressure` | `pressure`, `atmospheric_pressure` | pressure, pression |
| Wind speed | `wind_speed` | `wind_speed` | wind_speed, vitesse_vent |
| Wind direction | `wind_bearing` | — | wind_bearing, wind_direction |
| Gusts | `wind_gust_speed` | `wind_speed` | gust, rafale |
| Precipitation | — | `precipitation` | precipitation, rain, pluie |
| Chance of rain | — | `precipitation_probability` | pop, chance_of_rain |
| UV index | `uv_index` | — | uv_index, uv |
| Visibility | `visibility` | — | visibility, visibilite |
| Dew point | `dew_point` | `temperature` | dew_point, point_de_rosee |
| Cloud cover | `cloud_coverage` | — | cloud_coverage, nuage |
| Ozone | `ozone` | `ozone` | ozone |
| Air quality | — | `aqi` | air_quality, aqi |
| Sunrise | `sun.sun` `next_rising` (fallback) | `timestamp` | sunrise, lever_soleil |
| Sunset | `sun.sun` `next_setting` (fallback) | `timestamp` | sunset, coucher_soleil |

## Environment zones (unlimited indoor/outdoor rooms and air quality)

Beyond the single outdoor station, the **Environment / Environnement** tab lets you define **any number of environment zones** — for example "Bedroom", "Living room", "Garage", "Greenhouse" or a second outdoor location. Each zone is entirely manually configured (no auto-detection is attempted for room assignment, since only you know which sensor belongs to which room):

- a stable name you choose;
- a kind: **indoor** or **outdoor**;
- a visibility toggle (hide a zone from the rendered card without deleting its configuration);
- manual entity mappings, each with a searchable/typeable entity input, for: **temperature**, **humidity**, **AQI**, **CO₂**, **PM2.5**, **PM10** and **VOC** — map only the ones relevant to that zone, the rest are simply omitted.

Visible zones render as responsive cards below the outdoor station, each showing the zone name/type and every configured value with a localized label, icon and unit. If a configured entity is missing or unavailable, its row visibly shows an em dash (`—`) and a validation notice, rather than silently disappearing — so misconfiguration is always visible, never hidden.

This is how the card supports, for example, tracking both indoor CO₂/AQI in a bedroom and outdoor AQI/PM2.5 at the same time, or comparing temperature/humidity across several rooms.

## Visual alert / recommendation rules

The **Alerts / Alertes** tab lets you build your own **display-only visual recommendations**, evaluated live from any numeric entities in your system — for example a reminder to open the windows when indoor air quality would benefit from it. Each rule has:

- a name and a recommendation message shown to you when the rule is active;
- a severity: **info**, **warning** or **critical** (each rendered with a distinct color/icon);
- a logic: **all** conditions must be met, or **any** one of them;
- an enabled/disabled toggle;
- one or more numeric conditions, each with an entity ID, an operator (`>`, `≥`, `<`, `≤`, `=`, **between**, **outside**) and one or two threshold values.

**Example: "Open the windows"**

| Condition | Entity | Operator | Threshold(s) |
| --- | --- | --- | --- |
| Indoor CO₂ is high | `sensor.bedroom_co2` | greater than (`gt`) | 1000 ppm |
| Outdoor air quality is good | `sensor.outdoor_aqi` | less than (`lt`) | 50 |
| Outdoor temperature is comfortable | `sensor.esp32_outdoor_temperature` | between | 12 and 28 |

With logic set to **all**, this rule becomes active — and shows a prominent recommendation at the top of the information area — only when every one of those three conditions is simultaneously true. This example is **documented here only**; the card does not ship it as an active default, because entity IDs are specific to your own installation. Build your own rules from your own entities in the **Alerts** tab.

**Important limitations, by design:**

- Alerts are **purely visual recommendations** rendered inside the card. They never call a Home Assistant service, never trigger a notification, and never run an automation.
- A rule is only ever evaluated **while this Lovelace card is actually rendered on screen** (open dashboard, visible tab). A Lovelace card has no background process, so there is no way for it to notify you when it isn't displayed — use a proper Home Assistant automation/notification if you need alerts to reach you when you're not looking at the dashboard.
- A rule referencing a missing, unavailable or non-numeric entity, or with no conditions, or that is disabled, is always treated as inactive rather than throwing an error or showing stale data.
- `between` is inclusive of both thresholds; `outside` is strictly exclusive of the range between them.

Since forecasts are no longer exposed as weather-entity state attributes in modern Home Assistant, the card subscribes to live forecast updates using the `weather/subscribe_forecast` WebSocket command, separately for `daily` and `hourly` forecast types. If your weather integration does not support a given forecast type, the subscription attempt is handled explicitly (not silently swallowed) and that section is simply hidden — you will not see a broken loading spinner. Subscriptions are automatically renewed if you change the weather entity or forecast settings, and cleanly unsubscribed when the card is removed or leaves the dashboard.

## Comfort analysis (condensation risk)

The **Comfort / Confort** tab adds an optional, display-only condensation risk analysis. It is **disabled by default** (`comfort.enabled: false`) and produces no display unless explicitly enabled — no YAML editing is required. When enabled it renders as two independent tiles — **Outdoor conditions** and **Home & comfort** — which participate in the responsive multi-column layout, so on a wide card they can sit side by side and on a narrow card they stack.

### Inputs

Two pairs of readings are required:

- **Outdoor temperature and relative humidity** — resolved from the same sources as the outdoor station metrics (auto-detected or manually overridden in the **Entity mapping** tab).
- **Indoor temperature and relative humidity** — taken from the zone explicitly selected in the **Comfort** tab, or, when none is selected, from the first visible indoor environment zone. Missing readings are marked unavailable rather than inferred.

### Computed values

All calculations run locally in the browser from current sensor readings:

- **Dew point (°C / °F)** — computed from outdoor temperature and relative humidity using the Magnus formula.
- **Absolute humidity (g/m³)** — computed for both indoor and outdoor air from their respective temperature and relative humidity values.
- **Outdoor saturation distance (°C / °F)** — `outdoor_temp − dew_point`; a large positive value indicates the outdoor air is far from saturation.

### Ventilation assessment

Ventilation is assessed using **absolute humidity** (not relative humidity), because absolute humidity represents the actual mass of water vapor present regardless of air temperature. Ventilation is considered beneficial when the outdoor absolute humidity is lower than the indoor value by at least a configurable delta (default: **2.0 g/m³**, configurable from 0.0 to 20.0 g/m³).

### Cooling assessment

A separate cooling check evaluates whether opening windows would cool the space, based on configurable indoor and outdoor temperature thresholds.

### Glazing / surface temperature (optional sensor or estimate)

You may optionally map a **glazing or surface temperature sensor** (e.g. a contact thermometer on a window pane) in the Comfort tab. When mapped and available, that sensor reading is used directly as the surface temperature for the condensation margin calculation.

When no sensor is mapped or the mapped sensor is unavailable, the card computes an **estimated surface temperature**: `indoor_temp + (outdoor_temp − indoor_temp) × glazing_factor`, where the glazing factor defaults to **0.15** and is configurable (range: 0.0–1.0). Indicative center-pane factors are 0.08–0.12 for high-performance glazing, 0.14–0.20 for modern double glazing, 0.25–0.40 for older double glazing and 0.60–0.75 for single glazing. Frames, pane edges, wind and installation can differ greatly. This is a simplified thermal model — the display explicitly labels the result as an **estimate, not a measurement**; use a surface sensor for reliable assessment.

### Condensation margin and risk bands

The **condensation margin** is `surface_temp − dew_point`. Three fixed bands are applied:

| Margin | Band |
| --- | --- |
| ≤ 0 °C | 🔴 Critical — condensation likely |
| > 0 °C and ≤ 3 °C | 🟡 Warning — surface near dew point |
| > 3 °C | 🟢 Safe — positive condensation margin |

### °F support and unavailable behavior

All displayed temperatures are converted to °F when your Home Assistant locale uses imperial units; internal calculations always use °C. When a required reading is unavailable, the card clearly marks that data as unavailable and hides only the calculations that depend on it.

The compact temperature, humidity and pressure cards also show a plain-language status. Pressure bands use the value converted to hPa (`< 1000` low, `1000–1025` normal, `> 1025` high). These weather bands are only meaningful for **sea-level-corrected pressure**; raw station pressure depends strongly on altitude.

### Educational tooltips

Every station metric, environment zone reading and computed comfort value carries an educational tooltip explaining what the value means and, where applicable, how it is derived. There is **no separate "?" button**: the value tile/row is itself the tooltip trigger, which keeps the display uncluttered. A subtle dotted underline under the label marks the values that carry an explanation. Tooltips are triggered by:

- **Hover** — mouse pointer over the value
- **Keyboard focus** — Tab to the value (each is focusable); the explanation appears on focus
- **Touch / tap** — tap the value on touch screens

Tooltips convey explanatory information only. The Comfort analysis makes **no scientific or safety-precision claims** — it is an informational display tool, not a certified measurement instrument or professional advice of any kind.

## Sun path and Moon tiles

Two optional, display-only celestial tiles can be enabled from the editor; both are **disabled by default**. They compute everything **locally in the browser** from your Home Assistant instance's latitude/longitude (**Settings → System → General**) — no network calls and no external astronomy service. If your location is not set, the tile shows a short prompt instead. Both tiles take part in the responsive masonry layout, so on a wide card they sit beside the other panels, and their live values refresh continuously.

### Sun path (Sun path tab)

Renders a horizon-to-horizon **arc of today's solar trajectory** (sampled from a NOAA solar-position algorithm), with:

- **sunrise**, **solar noon** and **sunset** times marked under the arc;
- the **current sun position** shown live on the arc, with a guide line down to the horizon;
- a readout of the current **azimuth** (with compass point), **elevation**, **day length** and **season** (flipped for the southern hemisphere).

Polar day and polar night are detected and labeled explicitly.

### Moon (Moon tab)

Shows a **moon-phase disc** rendered from the current illuminated fraction — waxing or waning, from thin crescent through gibbous, and mirrored for the southern hemisphere — plus:

- the **phase name** (new moon, waxing crescent, first quarter, …) and the **illuminated percentage**;
- **moonrise** and **moonset** times (or an "always up / always down" note near the poles);
- the current **azimuth** and **elevation**.

The moon's position, illumination and rise/set are computed with the standard low-precision Meeus / SunCalc formulas.

Like the comfort values, the technical readouts (azimuth, elevation, phase, illumination) carry **educational tooltips** revealed by hovering, keyboard-focusing or tapping the value itself.

## Responsiveness, performance, accessibility, privacy

- **Responsive** — the scene viewport fills its container and adapts to phones, tablets, desktop cards and wall panels; on narrow/mobile screens the entire scene is shown first, followed by the full information area — nothing is hidden, only forecast rows may scroll horizontally. Panel density and font sizes adjust at small widths. On a card wide enough (e.g. stretched in a Sections dashboard) the information panels lay out as **responsive masonry columns** instead of one tall band; the column count tracks the card's real rendered width (not the viewport), so it works even in a narrow slot on a large screen and collapses to a single column on narrow cards.
- **Performance** — animation quality/intensity are configurable; the device pixel ratio used for canvases is capped at 2 to avoid excessive GPU/CPU load on high-DPI displays; rendering pauses automatically when the card scrolls off-screen (`IntersectionObserver`) or the browser tab is hidden (`visibilitychange`). The renderer's `ResizeObserver` stays attached to the scene viewport, so resizing/reconnecting the card (e.g. switching dashboards) keeps the animation correctly sized.
- **Accessibility** — the renderer honors the operating system's `prefers-reduced-motion` setting: a single static frame is drawn instead of a continuous animation loop. Educational tooltips across the station, environment and comfort panels are fully keyboard-reachable — each value is focusable via Tab and reveals its explanation on focus (`aria-describedby`) — and respond to touch/tap, with no pointer-only interactions.
- **Privacy** — the card makes **no network calls of its own** at runtime beyond what your Home Assistant frontend already does (loading your configured house image and talking to your own Home Assistant instance). There is no telemetry, analytics, or third-party service involved in rendering the weather scene. Alert rules are evaluated **entirely locally in the browser**, only while the card is rendered — nothing is sent anywhere and no Home Assistant service/notification is ever triggered by them.

## Troubleshooting

- **The card does not appear in the picker** — make sure the Lovelace resource was registered (HACS does this automatically; for manual installs check **Settings → Dashboards → Resources**), then hard-reload the browser tab (Ctrl/Cmd+Shift+R) to bypass the cache.
- **"No weather entity found"** — either pick one explicitly in the editor or make sure at least one `weather.*` entity is available (not `unavailable`/`unknown`).
- **A metric shows nothing** — open the **Entity mapping** tab: it shows, for every metric, the exact resolved entity/attribute and the resolution source (manual override / weather attribute / sensor / not available).
- **A metric auto-matched the wrong entity** (for example a power/energy sensor being picked up for a temperature-like metric because its name contains a matching keyword) — this class of bug is specifically guarded against: an entity whose `device_class` is set and does not match the metric's accepted device classes is now always rejected, regardless of keyword matches in its ID or friendly name. If you still see an incorrect auto-match, open **Entity mapping**, check the entity ID shown as "resolved", and set an explicit manual override there — manual overrides always win over auto-detection.
- **Environment zone row shows an em dash (—)** — the entity mapped to that row in the **Environment** tab is missing or unavailable; check the zone's validation notice and fix the entity ID or the sensor itself.
- **An alert never appears** — make sure the rule is enabled, has at least one condition, and that every referenced entity is available and reporting a numeric state; for **all** logic every condition must be true simultaneously, for **any** logic only one needs to be. Remember alerts are only evaluated while the card is actually on screen.
- **Forecasts don't show up** — your weather integration may not support the `hourly` or `daily` forecast type; this is reported as "not supported" internally rather than as an error, and the corresponding forecast row is hidden.
- **Old configuration after an update** — configurations are merged with current defaults on load, so older or partial configurations keep working; if a field looks wrong, open the editor, it will show the effective values. See [Migration and configuration compatibility](#migration-and-configuration-compatibility).
- **Blank/black scene** — verify your image URL is reachable (open it directly in a browser tab); if the URL is wrong, the sky animation still renders but without your house photo.
- **The card looks taller than before after updating** — this is expected: as of v1.0.1 the information area grows naturally below the scene instead of being clipped on top of it. See [Layout](#layout-scene-viewport-and-information-area).

## Updating and removing the card

- **Update** — HACS will notify you of new versions; click "Update" and reload the frontend afterwards.
- **Remove** — remove the card from your dashboards, then remove the repository from HACS (or delete the resource and the file for manual installs). No entities, automations or persistent background services are created by this card, so removal is immediate and clean.

## Migration and configuration compatibility

Upgrading from v1.0.0 is **safe and requires no manual configuration changes**:

- Existing configurations continue to work as-is; every new field (`environment_zones`, `alerts`, the outdoor temperature metric, per-metric manual mapping) is merged with safe defaults (`[]` for zones/alerts) if absent from your saved YAML/config.
- The previously existing `humidity` metric key and its manual override are preserved unchanged — it is now labeled "Outdoor humidity" in the UI, but the underlying entity mapping and config key are untouched.
- Visually, the card will look different immediately after updating: the scene becomes a smaller, unobstructed top viewport, and all metrics/forecasts move into a natural-flow information area below it that can make the overall card taller. `Appearance → Minimum height`/`Aspect ratio` now size the scene only; if your card looks too short or too tall, revisit those two settings.
- No entity mapping is lost: any manual overrides you had configured for existing metrics keep working and are now edited from the new **Entity mapping** tab instead of the old inline selects on the **Station metrics** tab.
- `environment_zones` and `alerts` start empty; nothing is auto-populated on your behalf, since zone/room assignment and alert thresholds are inherently specific to your home and are always manually configured.
- `comfort.enabled` defaults to `false`; the comfort panel is never shown automatically and must be explicitly enabled in the **Comfort** tab — existing configurations without this section continue to work with the panel hidden.

## Development

```bash
npm install       # install dependencies
npm run typecheck # strict TypeScript type-checking
npm test          # run the vitest unit test suite
npm run build     # type-check then produce dist/immersive-weather-dashboard.js
npm run dev       # rebuild on file changes
```

The project is plain TypeScript + [Lit](https://lit.dev/) + [Vite](https://vitejs.dev/), bundled as a single IIFE with no runtime CDN dependency. Releases are built by the `release.yml` GitHub Actions workflow when you push a `vX.Y.Z` tag; it attaches `dist/immersive-weather-dashboard.js` to the GitHub release and validates the result with the official HACS action. The build output is intentionally **not** committed to the repository — only produced by CI/local builds — to keep the source tree clean.

### First publication and releases

1. Create the public GitHub repository `zarzak12/immersive-weather-dashboard`, give it a short description, enable Issues, and add topics such as `home-assistant`, `hacs`, `lovelace` and `weather`.
2. Push the source to its `main` branch.
3. Publish the first release by pushing a semantic version tag:

```bash
git tag v1.0.0
git push origin main
git push origin v1.0.0
```

The release workflow builds and attaches the exact file expected by `hacs.json`. Wait for the **Release** workflow to finish successfully before adding the repository to HACS. For later versions, update `package.json`, commit the change, and push a new `vX.Y.Z` tag; never move or reuse an existing release tag.

## FAQ

**Do I need to write YAML?** No. Every option is available in the graphical editor, both for adding the card and for editing it afterwards.

**Does this card call any external weather or AI service at runtime?** No. All animation is computed locally with the Canvas 2D API. The only network activity is Home Assistant loading your configured house image and the normal Home Assistant frontend/WebSocket traffic.

**Can I use it without a house photo?** Yes — leave the image URL empty and you get a full-screen animated sky/weather scene with no foreground image.

**Which weather integrations are supported?** Any integration that provides a standard `weather.*` entity. Forecast support depends on whether that integration implements the `hourly`/`daily` forecast WebSocket subscriptions.

**Will alert rules send me a notification if I'm not looking at the dashboard?** No. Alerts are visual, display-only recommendations rendered inside the card and evaluated only while it is on screen; a Lovelace card cannot run in the background, so it never calls a Home Assistant service or notification. Use a Home Assistant automation if you need to be notified elsewhere.

**Can I use my own weather station (e.g. ESP32) instead of provider data?** Yes — map its sensor entities to the outdoor metrics (temperature, humidity, pressure…) in the **Entity mapping** tab; manual overrides always take priority over the weather provider.

## Limitations

- The renderer is **procedural and stylized**, not a photorealistic weather simulation or a licensed video/photo weather service; do not expect cinematic realism.
- Precipitation, cloud and lightning visuals are approximations driven by the weather entity's reported condition, not physically accurate simulations.
- The quality of the "see-through sky" effect depends entirely on the quality of your image's alpha cut-out.
- Extremely large/unoptimized house images can slow down the initial load of the card; see the resolution guidance below.
- Environment zone and alert entity mappings are **intentionally manual** — the card does not attempt to guess which sensor belongs to which room, since that assignment is inherently specific to your home.
- Alert rules are **display-only**: they never trigger Home Assistant notifications, services or automations, and are only evaluated while the card is actually rendered on screen.

## AI prompt to prepare your house photo

You can use an AI image editing tool (or a background-removal tool, see the fallback note) to turn your own house photo into the transparent-sky foreground layer this card expects. Copy the prompt below into your tool of choice.

> ⚠️ **Only use a photo you own or have the right to edit and display.** Uploading a personal photo to a third-party AI service sends that image to that provider — check their data retention and training policies before uploading, and consider whether the photo reveals sensitive details (house number, license plates, faces of people, exact location) that you'd rather blur out first.

### Ready-to-copy prompt

```
Edit this photo of my house. Keep the house, ground, driveway, vegetation and every
foreground object exactly as they are: same geometry, same perspective, same materials,
same lighting on the subject, fully photorealistic — do not repaint or restyle anything
except the sky. Remove ONLY the sky, all the way down to the exact silhouette of the
roofline, chimneys, antennas and any tree branches that cross it. Replace the removed sky
with genuine, fully transparent alpha (RGBA alpha = 0) — not white, not black, not a
checkerboard pattern, not a flat color standing in for transparency. Preserve fine, thin
details such as antennas, aerials, chimney pots, wires and thin branches with clean,
anti-aliased edges; do not blur or simplify them away. Do not add clouds, sun, stars,
lightning, extra lighting, reflections, watermarks or any text. Output a lossless PNG or
WebP file with a real alpha channel, at the original resolution and aspect ratio, with no
cropping, stretching or re-composition.
```

### Negative prompt

```
sky, clouds, sun, moon, stars, haze, lens flare, gradient background, solid color
background, white background, black background, checkerboard pattern baked into pixels,
added drop shadow, extra buildings, people, cars, text, watermark, logo, blurred edges,
jpeg artifacts, altered geometry, altered perspective, cartoon style, painting style,
low resolution, upscaling artifacts
```

### Verification checklist (do this before uploading the result)

- [ ] Zoom in at 300–400% on the roofline, chimney and any tree branches: the alpha edge should be clean and anti-aliased, not a hard white or black fringe.
- [ ] Open the file in an editor/viewer that renders a checkerboard for transparency (e.g. GIMP, Photoshop, Affinity Photo, or your OS file preview): the entire former-sky area must show the checkerboard, not a flat color pretending to be transparent.
- [ ] Thin objects (antenna, aerial, chimney pot, wires, thin branches) are still visible and were not "eaten" by the sky removal.
- [ ] Resolution and aspect ratio match the original photo — no unwanted cropping or stretching.
- [ ] No new sky, clouds, sun, stars, lighting or text was added by the tool.
- [ ] The file is saved as PNG (24/32-bit, with alpha) or WebP (lossless, with alpha) — **never JPEG**, which cannot store transparency at all.

### If your AI tool cannot output real alpha transparency

Some AI image generators only ever produce a flattened image — a solid color, a checkerboard *drawn as pixels*, or a generic "sky" background — even if you ask for transparency. If that happens:

1. Use the AI output as a *rough guide* for where the sky/roofline boundary is.
2. Run the original photo through a dedicated background-removal tool (for example the open-source [`rembg`](https://github.com/danielgatis/rembg) command line tool, or the built-in tools of GIMP/Photoshop/Affinity Photo/Photopea) to manually or automatically mask out the sky.
3. Clean up the mask by hand around thin details (antennas, branches) for a crisp result.
4. Export as PNG or WebP with a genuine alpha channel and re-verify with the checklist above.

Do not present a flattened/faked-transparency image as if it had real alpha — the card relies on genuine per-pixel alpha to composite the animated sky correctly.

### Recommended resolution and file size

- Use at least the native resolution of your target screen (e.g. 1920×1080 for a Full HD wall panel), and avoid exceeding roughly 3000 px on the longest side — higher resolutions rarely add visible detail on a dashboard but slow down loading.
- Prefer lossless WebP or optimized PNG (run it through a tool like `oxipng` or `pngquant` in lossless/near-lossless mode) to keep the file under a few megabytes without damaging the alpha edges.
- Keep the original aspect ratio; the card uses `object-fit: cover` so mismatched ratios will crop rather than stretch.

## License

Released under the [MIT License](LICENSE).
