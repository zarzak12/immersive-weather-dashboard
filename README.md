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
- [How the image layering works](#how-the-image-layering-works)
- [Configuration reference](#configuration-reference)
- [Auto-discovery algorithm and manual overrides](#auto-discovery-algorithm-and-manual-overrides)
- [Metric / entity reference table](#metric--entity-reference-table)
- [Forecasts](#forecasts)
- [Responsiveness, performance, accessibility, privacy](#responsiveness-performance-accessibility-privacy)
- [Troubleshooting](#troubleshooting)
- [Updating and removing the card](#updating-and-removing-the-card)
- [Development](#development)
- [FAQ](#faq)
- [Limitations](#limitations)
- [AI prompt to prepare your house photo](#ai-prompt-to-prepare-your-house-photo)
- [License](#license)

## Concept

Immersive Weather Dashboard turns a single Lovelace card into a full-screen weather scene. You provide a photo of your own house with the sky cut out (real alpha transparency). The card renders a **procedural, locally computed** animated sky behind that photo: gradients for day/night, sun/moon, stars, moving clouds, rain, pouring rain, snow, mixed snow/rain, hail, fog, wind and thunderstorms with lightning. Everything is drawn with the Canvas 2D API at runtime — **no video files, no cloud rendering service, no network calls** are used to produce the animation.

The result is a dashboard/wall-panel card that feels alive and reacts to your actual weather entity and sensors, while keeping your own house recognizable in the foreground.

## Feature tour

- Full-screen immersive layout, designed for phones, tablets, desktop dashboards and wall-mounted panels.
- Procedural sky/weather engine: day/night gradient, sun, moon, twinkling stars, drifting clouds, rain, pouring rain, snow, snow+rain mix, hail, fog, wind streaks, lightning flashes for thunderstorms.
- Discreet glassmorphism panels (blurred, translucent) for the current conditions, the metrics station and the forecasts, so the scene stays visible underneath.
- Full graphical configuration — **no YAML editing is required** after installing through HACS. Every option (image, colors, opacity, metrics, forecasts…) has a UI control.
- Reliable automatic entity detection with a deterministic scoring algorithm, plus per-metric manual override.
- Live forecast subscriptions using the modern `weather/subscribe_forecast` WebSocket API (daily and hourly), with graceful handling when a weather integration does not support a given forecast type.
- Respects `prefers-reduced-motion`, pauses rendering when the card is scrolled off-screen or the browser tab is hidden, and caps the device pixel ratio to control GPU/CPU cost.
- Animation quality and intensity controls so low-power wall tablets and Raspberry Pi displays stay smooth.
- English and French interface, following `hass.locale.language`, with English fallback.

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
3. Add the card to a dashboard, open the card editor, and in the **Image & scene** tab paste the image path (`/local/house.png`) into **House image URL**.
4. Pick your **Weather entity** in the **Data source** tab, or leave it empty to let the card auto-detect the best one.
5. Adjust **Appearance** (panel opacity/blur/corner radius, accent/text colors, minimum height, density) to match your theme and screen.
6. Enable/disable **Forecasts** and choose how many hourly/daily items to display.
7. Open **Station metrics** to reorder, hide, relabel, recolor or manually re-map any of the sixteen supported metrics.
8. Optionally click **Auto-configure** once you are happy with the automatic detections, to freeze them into the saved configuration (see [Auto-discovery](#auto-discovery-algorithm-and-manual-overrides)).

## How the image layering works

The card composites three layers, back to front:

1. **Background canvas** — sky gradient, sun/moon, stars and clouds. This sits **behind** your house photo, so it becomes visible only through the transparent sky area of your PNG/WebP.
2. **Your house photo** — the opaque foreground (house, ground, vegetation…) painted over the background canvas. Anywhere the photo is opaque, the sky animation is naturally hidden; anywhere it is transparent (the cut-out sky), the animated background shows through.
3. **Foreground canvas** — rain, snow, hail, fog wisps and lightning flashes, drawn **above** your house photo. This is intentional: falling precipitation and mist realistically pass in front of a house too, not just behind it.

Because the compositing relies entirely on your image's own alpha channel, the quality of the cut-out directly determines how convincing the scene looks. A clean, precise alpha mask (no fringing, no leftover sky pixels, no over-erased antennas) is the single most important ingredient of a good result.

## Configuration reference

Everything below is configurable from the graphical editor. No YAML editing is required or expected. Home Assistant still stores the configuration internally (as it does for every card), but you never need to open or hand-edit it.

| Editor tab | Options |
| --- | --- |
| Data source | Card title, weather entity (or auto-detect) |
| Image & scene | House image URL, day/night mode (auto/day/night), animation on/off, animation quality (low/medium/high), animation intensity (0–2) |
| Appearance | Panel opacity, panel blur, panel corner radius, accent color, text color, minimum card height, aspect ratio, density (comfortable/compact) |
| Forecasts | Show/hide hourly forecast, show/hide daily forecast, number of hourly items, number of daily items |
| Station metrics | Per metric: visible, custom label, custom color, custom icon, manual entity override, and a read-only "source" indicator (manual / weather attribute / sensor / not available) |

Two dedicated actions are always available:

- **Reset defaults** — restores every option to its factory default (keeps the card type).
- **Auto-configure** — computes a fresh snapshot of the best-detected weather entity and sensors and **saves it** into the configuration after an explicit confirmation dialog. Until you click it, auto-detection stays purely runtime/adaptive and nothing is written to your configuration.

## Auto-discovery algorithm and manual overrides

For every one of the sixteen supported metrics, the card resolves a value using this strict priority order:

1. **Manual override** — the entity you picked explicitly for that metric in the editor. If it exists but is `unavailable`/`unknown`, the metric is shown as unavailable rather than silently falling through (so misconfiguration is visible).
2. **Weather entity attribute** — if the selected weather entity exposes a matching attribute (e.g. `humidity`, `pressure`, `wind_speed`, `wind_bearing`, `wind_gust_speed`, `uv_index`, `visibility`, `dew_point`, `cloud_coverage`, `ozone`, `apparent_temperature`), it is used directly.
3. **Best-scoring sensor entity** — the card scores every `sensor.*` (and `air_quality.*` for air quality) entity in your system against the metric: `+10` for a matching `device_class`, `+5` for a matching keyword in the entity ID, `+3` for a matching keyword in the friendly name. Metrics whose device class is ambiguous (for example dew point versus any temperature, gust versus average wind, or sunrise versus any timestamp) additionally require a semantic keyword. Entities that are `unavailable`/`unknown`, belong to a disallowed domain, or fail this semantic guard are rejected outright so they cannot be picked by accident. The highest-scoring entity wins; ties are broken alphabetically by entity ID for determinism.
4. **`sun.sun` entity** — used only for sunrise/sunset, reading `next_rising`/`next_setting` when no sensor was found.
5. **Not available** — if nothing qualifies, the metric is simply omitted from the station rather than showing a misleading zero.

The weather entity itself is auto-selected similarly: your configured `weather.*` entity is used if present and available; otherwise the available weather entity exposing the richest set of current station attributes is selected. Equal candidates are tie-broken alphabetically for determinism.

This algorithm runs live every time the card renders, so it naturally adapts if you add, rename or replace entities — except when you have explicitly used **Auto-configure**, which freezes the current detections into the saved configuration.

## Metric / entity reference table

| Metric | Weather attribute used | Sensor `device_class` | Typical keywords |
| --- | --- | --- | --- |
| Feels like (apparent temperature) | `apparent_temperature` | `temperature` | feels_like, apparent, ressenti |
| Humidity | `humidity` | `humidity` | humidity, humidite |
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

## Forecasts

Since forecasts are no longer exposed as weather-entity state attributes in modern Home Assistant, the card subscribes to live forecast updates using the `weather/subscribe_forecast` WebSocket command, separately for `daily` and `hourly` forecast types. If your weather integration does not support a given forecast type, the subscription attempt is handled explicitly (not silently swallowed) and that section is simply hidden — you will not see a broken loading spinner. Subscriptions are automatically renewed if you change the weather entity or forecast settings, and cleanly unsubscribed when the card is removed or leaves the dashboard.

## Responsiveness, performance, accessibility, privacy

- **Responsive** — the scene fills its container and adapts to phones, tablets, desktop cards and wall panels; panel density and font sizes adjust at small widths.
- **Performance** — animation quality/intensity are configurable; the device pixel ratio used for canvases is capped at 2 to avoid excessive GPU/CPU load on high-DPI displays; rendering pauses automatically when the card scrolls off-screen (`IntersectionObserver`) or the browser tab is hidden (`visibilitychange`).
- **Accessibility** — the renderer honors the operating system's `prefers-reduced-motion` setting: a single static frame is drawn instead of a continuous animation loop.
- **Privacy** — the card makes **no network calls of its own** at runtime beyond what your Home Assistant frontend already does (loading your configured house image and talking to your own Home Assistant instance). There is no telemetry, analytics, or third-party service involved in rendering the weather scene.

## Troubleshooting

- **The card does not appear in the picker** — make sure the Lovelace resource was registered (HACS does this automatically; for manual installs check **Settings → Dashboards → Resources**), then hard-reload the browser tab (Ctrl/Cmd+Shift+R) to bypass the cache.
- **"No weather entity found"** — either pick one explicitly in the editor or make sure at least one `weather.*` entity is available (not `unavailable`/`unknown`).
- **A metric shows nothing** — check the "source" indicator in the **Station metrics** tab: it tells you whether the value comes from a manual override, a weather attribute, or a sensor, and whether none could be found.
- **Forecasts don't show up** — your weather integration may not support the `hourly` or `daily` forecast type; this is reported as "not supported" internally rather than as an error, and the corresponding forecast row is hidden.
- **Old configuration after an update** — configurations are merged with current defaults on load, so older or partial configurations keep working; if a field looks wrong, open the editor, it will show the effective values.
- **Blank/black scene** — verify your image URL is reachable (open it directly in a browser tab); if the URL is wrong, the sky animation still renders but without your house photo.

## Updating and removing the card

- **Update** — HACS will notify you of new versions; click "Update" and reload the frontend afterwards.
- **Remove** — remove the card from your dashboards, then remove the repository from HACS (or delete the resource and the file for manual installs). No entities, automations or persistent background services are created by this card, so removal is immediate and clean.

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

## Limitations

- The renderer is **procedural and stylized**, not a photorealistic weather simulation or a licensed video/photo weather service; do not expect cinematic realism.
- Precipitation, cloud and lightning visuals are approximations driven by the weather entity's reported condition, not physically accurate simulations.
- The quality of the "see-through sky" effect depends entirely on the quality of your image's alpha cut-out.
- Extremely large/unoptimized house images can slow down the initial load of the card; see the resolution guidance below.

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
