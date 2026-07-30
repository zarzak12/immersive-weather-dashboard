import type { AnimationQuality } from '../types';
import type { SceneCategory } from '../data/weather-condition';
import { clamp, createRng, randomRange } from './utils';

export interface SceneState {
  category: SceneCategory;
  isDay: boolean;
  quality: AnimationQuality;
  intensity: number;
  windSpeedKmh: number;
  windBearingDeg: number;
  reducedMotion: boolean;
  cloudCoverage: number;
  /** Current sun elevation in degrees; drives the dawn/dusk sky colouring. */
  sunElevation: number;
  /** Current sun azimuth in degrees (clockwise from north); positions the sun disc. */
  sunAzimuth: number;
}

interface QualityPreset {
  rain: number;
  snow: number;
  hail: number;
  stars: number;
  clouds: number;
}

const QUALITY_PRESETS: Record<AnimationQuality, QualityPreset> = {
  low: { rain: 50, snow: 35, hail: 25, stars: 40, clouds: 3 },
  medium: { rain: 140, snow: 80, hail: 60, stars: 90, clouds: 5 },
  high: { rain: 280, snow: 150, hail: 110, stars: 150, clouds: 7 }
};

interface SkyPalette {
  dayTop: string;
  dayBottom: string;
  nightTop: string;
  nightBottom: string;
}

/** Day/night sky gradient endpoints per weather category (blended by sun elevation). */
const SKY_PALETTES: Record<SceneCategory, SkyPalette> = {
  clear: { dayTop: '#2f8ce0', dayBottom: '#bfe4ff', nightTop: '#050818', nightBottom: '#161a35' },
  'partly-cloudy': { dayTop: '#4f9be0', dayBottom: '#bfe0f5', nightTop: '#0c1330', nightBottom: '#1c2650' },
  cloudy: { dayTop: '#8f9bb0', dayBottom: '#c3ccd8', nightTop: '#141b2c', nightBottom: '#232d42' },
  fog: { dayTop: '#c8d0d8', dayBottom: '#dfe4e8', nightTop: '#2b3440', nightBottom: '#3d4753' },
  rain: { dayTop: '#5b6b82', dayBottom: '#8a97a8', nightTop: '#0d1220', nightBottom: '#1c2436' },
  pouring: { dayTop: '#5b6b82', dayBottom: '#8a97a8', nightTop: '#0d1220', nightBottom: '#1c2436' },
  snow: { dayTop: '#aebbcc', dayBottom: '#e2e8f0', nightTop: '#1b2436', nightBottom: '#2e3850' },
  'snowy-rainy': { dayTop: '#8f9bb0', dayBottom: '#c3ccd8', nightTop: '#141b2c', nightBottom: '#232d42' },
  hail: { dayTop: '#8f9bb0', dayBottom: '#c3ccd8', nightTop: '#141b2c', nightBottom: '#232d42' },
  thunderstorm: { dayTop: '#4a5568', dayBottom: '#718096', nightTop: '#0b0f19', nightBottom: '#1a202c' },
  windy: { dayTop: '#2f8ce0', dayBottom: '#bfe4ff', nightTop: '#050818', nightBottom: '#161a35' }
};

/** How strongly the golden-hour tint shows through per category (clear skies glow most). */
const SKY_CLEARNESS: Record<SceneCategory, number> = {
  clear: 1,
  'partly-cloudy': 0.8,
  windy: 0.9,
  snow: 0.5,
  cloudy: 0.4,
  'snowy-rainy': 0.35,
  hail: 0.35,
  rain: 0.3,
  pouring: 0.25,
  fog: 0.2,
  thunderstorm: 0.15
};

const GOLDEN_TOP = '#b0648a'; // dusky rose overhead at dawn/dusk
const GOLDEN_HORIZON = '#ff7a3c'; // warm orange glow near the horizon

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(a: string, b: string, t: number): [number, number, number] {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return [Math.round(ar + (br - ar) * t), Math.round(ag + (bg - ag) * t), Math.round(ab + (bb - ab) * t)];
}

/** Tints an already-parsed RGB tuple toward a hex colour by fraction `t`. */
function tintRgb(base: [number, number, number], hex: string, t: number): [number, number, number] {
  const [hr, hg, hb] = hexToRgb(hex);
  return [
    Math.round(base[0] + (hr - base[0]) * t),
    Math.round(base[1] + (hg - base[1]) * t),
    Math.round(base[2] + (hb - base[2]) * t)
  ];
}

function rgbStr([r, g, b]: [number, number, number]): string {
  return `rgb(${r}, ${g}, ${b})`;
}

function rgbaStr([r, g, b]: [number, number, number], alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
}

interface SnowFlake {
  x: number;
  y: number;
  radius: number;
  speed: number;
  driftPhase: number;
  driftSpeed: number;
}

interface HailStone {
  x: number;
  y: number;
  radius: number;
  speed: number;
}

interface CloudPuff {
  x: number;
  y: number;
  scale: number;
  speed: number;
  opacity: number;
}

interface StarPoint {
  x: number;
  y: number;
  radius: number;
  phase: number;
}

interface WindStreak {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
}

const MAX_DPR = 2;

/**
 * Procedural weather scene renderer. Draws sky, celestial bodies and clouds on
 * a background canvas (meant to sit behind a foreground house image with a
 * transparent sky) and draws precipitation/fog/lightning on a foreground
 * canvas (meant to sit above the house image, since rain and mist fall in
 * front of the whole scene).
 */
export class SceneRenderer {
  private readonly bgCtx: CanvasRenderingContext2D;
  private readonly fgCtx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafHandle: number | undefined;
  private lastTimestamp = 0;
  private paused = false;
  private state: SceneState = {
    category: 'clear',
    isDay: true,
    quality: 'medium',
    intensity: 1,
    windSpeedKmh: 0,
    windBearingDeg: 0,
    reducedMotion: false,
    cloudCoverage: 0,
    sunElevation: 25,
    sunAzimuth: 180
  };

  private rain: RainDrop[] = [];
  private snow: SnowFlake[] = [];
  private hail: HailStone[] = [];
  private clouds: CloudPuff[] = [];
  private stars: StarPoint[] = [];
  private windStreaks: WindStreak[] = [];
  private lightningTimer = 0;
  private lightningFlash = 0;
  private elapsed = 0;

  constructor(
    private readonly backgroundCanvas: HTMLCanvasElement,
    private readonly foregroundCanvas: HTMLCanvasElement
  ) {
    const bgCtx = backgroundCanvas.getContext('2d');
    const fgCtx = foregroundCanvas.getContext('2d');
    if (!bgCtx || !fgCtx) {
      throw new Error('Canvas 2D context is not available.');
    }
    this.bgCtx = bgCtx;
    this.fgCtx = fgCtx;
  }

  resize(width: number, height: number, devicePixelRatio: number): void {
    this.width = width;
    this.height = height;
    this.dpr = clamp(devicePixelRatio, 1, MAX_DPR);
    for (const canvas of [this.backgroundCanvas, this.foregroundCanvas]) {
      canvas.width = Math.round(width * this.dpr);
      canvas.height = Math.round(height * this.dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    this.bgCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.fgCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.regenerateParticles();
    this.renderFrame(0);
  }

  setState(next: SceneState): void {
    const qualityChanged = next.quality !== this.state.quality;
    const categoryChanged = next.category !== this.state.category;
    this.state = next;
    if (qualityChanged || categoryChanged || this.stars.length === 0) {
      this.regenerateParticles();
    }
    if (this.state.reducedMotion) {
      this.stop();
      this.renderFrame(0);
    } else if (!this.paused) {
      this.start();
    }
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.stop();
    } else if (!this.state.reducedMotion) {
      this.start();
    }
  }

  start(): void {
    if (this.rafHandle !== undefined || this.paused || this.state.reducedMotion) return;
    this.lastTimestamp = performance.now();
    const loop = (timestamp: number) => {
      const dt = clamp((timestamp - this.lastTimestamp) / 1000, 0, 0.1);
      this.lastTimestamp = timestamp;
      this.elapsed += dt;
      this.renderFrame(dt);
      this.rafHandle = requestAnimationFrame(loop);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafHandle !== undefined) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = undefined;
    }
  }

  dispose(): void {
    this.paused = true;
    this.stop();
  }

  private regenerateParticles(): void {
    const preset = QUALITY_PRESETS[this.state.quality];
    const rng = createRng(Math.round(this.width * 31 + this.height * 17) || 1);
    const factor = clamp(this.state.intensity, 0, 2);

    this.stars = Array.from({ length: preset.stars }, () => ({
      x: randomRange(rng, 0, this.width),
      y: randomRange(rng, 0, this.height * 0.6),
      radius: randomRange(rng, 0.4, 1.6),
      phase: randomRange(rng, 0, Math.PI * 2)
    }));

    this.clouds = Array.from({ length: preset.clouds }, () => ({
      x: randomRange(rng, -0.2 * this.width, this.width),
      y: randomRange(rng, this.height * 0.05, this.height * 0.4),
      scale: randomRange(rng, 0.6, 1.6),
      speed: randomRange(rng, 4, 12),
      opacity: randomRange(rng, 0.35, 0.75)
    }));

    const rainCount = Math.round(preset.rain * factor);
    this.rain = Array.from({ length: rainCount }, () => ({
      x: randomRange(rng, 0, this.width),
      y: randomRange(rng, 0, this.height),
      length: randomRange(rng, 10, 22),
      speed: randomRange(rng, 500, 900),
      opacity: randomRange(rng, 0.25, 0.6)
    }));

    const snowCount = Math.round(preset.snow * factor);
    this.snow = Array.from({ length: snowCount }, () => ({
      x: randomRange(rng, 0, this.width),
      y: randomRange(rng, 0, this.height),
      radius: randomRange(rng, 1.5, 4),
      speed: randomRange(rng, 30, 90),
      driftPhase: randomRange(rng, 0, Math.PI * 2),
      driftSpeed: randomRange(rng, 0.5, 1.5)
    }));

    const hailCount = Math.round(preset.hail * factor);
    this.hail = Array.from({ length: hailCount }, () => ({
      x: randomRange(rng, 0, this.width),
      y: randomRange(rng, 0, this.height),
      radius: randomRange(rng, 2, 4),
      speed: randomRange(rng, 400, 700)
    }));

    this.windStreaks = Array.from({ length: Math.round(30 * factor) }, () => ({
      x: randomRange(rng, 0, this.width),
      y: randomRange(rng, 0, this.height),
      length: randomRange(rng, 20, 60),
      speed: randomRange(rng, 200, 420),
      opacity: randomRange(rng, 0.1, 0.3)
    }));
  }

  private renderFrame(dt: number): void {
    if (this.width === 0 || this.height === 0) return;
    this.bgCtx.clearRect(0, 0, this.width, this.height);
    this.fgCtx.clearRect(0, 0, this.width, this.height);

    this.drawSky();
    this.drawCelestial();
    this.drawClouds(dt);
    this.drawPrecipitationAndAtmosphere(dt);
    this.drawLightning(dt);
  }

  private drawSky(): void {
    const ctx = this.bgCtx;
    const [top, bottom] = this.skyColors();
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Computes the sky gradient endpoints. Blends the night and day palettes
   * across the civil-twilight window (±6°) and layers a warm golden-hour tint
   * that peaks as the sun crosses the horizon (dawn and dusk).
   */
  private skyColors(): [string, string] {
    const { category, sunElevation } = this.state;
    const palette = SKY_PALETTES[category] ?? SKY_PALETTES.clear;

    const dayness = clamp((sunElevation + 6) / 12, 0, 1);
    let top = mixRgb(palette.nightTop, palette.dayTop, dayness);
    let bottom = mixRgb(palette.nightBottom, palette.dayBottom, dayness);

    const golden = clamp(1 - Math.abs(sunElevation) / 8, 0, 1) * (SKY_CLEARNESS[category] ?? 1);
    if (golden > 0) {
      top = tintRgb(top, GOLDEN_TOP, golden * 0.5);
      bottom = tintRgb(bottom, GOLDEN_HORIZON, golden * 0.9);
    }

    return [rgbStr(top), rgbStr(bottom)];
  }

  private drawCelestial(): void {
    const { isDay, category } = this.state;
    if (category === 'thunderstorm' || category === 'fog' || category === 'pouring') return;
    const ctx = this.bgCtx;
    const cx = this.width * 0.78;
    const cy = this.height * 0.22;
    const radius = Math.min(this.width, this.height) * 0.07;

    if (isDay) {
      // Place the sun by its real elevation/azimuth so it sits low and warm at
      // sunrise/sunset and high and bright at midday.
      const el = clamp(this.state.sunElevation, 0, 90);
      const bodyX = this.width * clamp((this.state.sunAzimuth - 45) / 270, 0, 1);
      const bodyY = this.height * (0.62 - clamp(el / 60, 0, 1) * 0.46);
      const warm = clamp(1 - el / 12, 0, 1);
      const glowRgb = mixRgb('#fff4d6', '#ff9a4a', warm);
      const sunRgb = mixRgb('#fff6d8', '#ff8a3c', warm);
      const glow = ctx.createRadialGradient(bodyX, bodyY, 0, bodyX, bodyY, radius * 4);
      glow.addColorStop(0, rgbaStr(glowRgb, 0.9));
      glow.addColorStop(1, rgbaStr(glowRgb, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.beginPath();
      ctx.fillStyle = rgbStr(sunRgb);
      ctx.arc(bodyX, bodyY, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      if (category !== 'cloudy' && category !== 'snowy-rainy') {
        for (const star of this.stars) {
          const twinkle = 0.5 + 0.5 * Math.sin(this.elapsed * 2 + star.phase);
          ctx.globalAlpha = clamp(twinkle, 0.2, 1) * (1 - this.state.cloudCoverage / 150);
          ctx.beginPath();
          ctx.fillStyle = '#ffffff';
          ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 3);
      glow.addColorStop(0, 'rgba(226, 232, 240, 0.5)');
      glow.addColorStop(1, 'rgba(226, 232, 240, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.beginPath();
      ctx.fillStyle = '#e8edf5';
      ctx.arc(cx, cy, radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawClouds(dt: number): void {
    const { category } = this.state;
    if (category === 'clear') return;
    const ctx = this.bgCtx;
    const windFactor = 1 + clamp(this.state.windSpeedKmh, 0, 60) / 60;

    for (const cloud of this.clouds) {
      if (!this.state.reducedMotion) {
        cloud.x += cloud.speed * windFactor * dt;
        if (cloud.x > this.width + 150) cloud.x = -150;
      }
      const puffRadius = 46 * cloud.scale;
      const gradient = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, puffRadius * 2.2);
      gradient.addColorStop(0, `rgba(230, 234, 240, ${cloud.opacity})`);
      gradient.addColorStop(1, 'rgba(230, 234, 240, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, puffRadius * 2.2, puffRadius * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawPrecipitationAndAtmosphere(dt: number): void {
    const { category } = this.state;
    const ctx = this.fgCtx;
    const windAngle = ((this.state.windBearingDeg + 180) * Math.PI) / 180;
    const windDrift = Math.sin(windAngle) * clamp(this.state.windSpeedKmh, 0, 80) * 1.5;

    if (category === 'rain' || category === 'pouring' || category === 'snowy-rainy' || category === 'thunderstorm') {
      ctx.strokeStyle = 'rgba(190, 210, 235, 0.55)';
      ctx.lineWidth = category === 'pouring' ? 1.6 : 1;
      for (const drop of this.rain) {
        if (!this.state.reducedMotion) {
          drop.y += drop.speed * dt;
          drop.x += windDrift * dt * 0.4;
          if (drop.y > this.height) {
            drop.y = -20;
            drop.x = Math.random() * this.width;
          }
          if (drop.x > this.width) drop.x = 0;
          if (drop.x < 0) drop.x = this.width;
        }
        ctx.globalAlpha = drop.opacity;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - windDrift * 0.02, drop.y + drop.length);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (category === 'snow' || category === 'snowy-rainy') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (const flake of this.snow) {
        if (!this.state.reducedMotion) {
          flake.y += flake.speed * dt;
          flake.x += Math.sin(this.elapsed * flake.driftSpeed + flake.driftPhase) * 20 * dt + windDrift * dt * 0.2;
          if (flake.y > this.height) {
            flake.y = -10;
            flake.x = Math.random() * this.width;
          }
        }
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (category === 'hail') {
      ctx.fillStyle = 'rgba(220, 230, 240, 0.9)';
      for (const stone of this.hail) {
        if (!this.state.reducedMotion) {
          stone.y += stone.speed * dt;
          if (stone.y > this.height) {
            stone.y = -10;
            stone.x = Math.random() * this.width;
          }
        }
        ctx.beginPath();
        ctx.arc(stone.x, stone.y, stone.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (category === 'fog') {
      for (let i = 0; i < 3; i += 1) {
        const offset = (this.elapsed * (8 + i * 4)) % (this.width + 300);
        const gradient = ctx.createLinearGradient(offset - 300, 0, offset, 0);
        gradient.addColorStop(0, 'rgba(230, 235, 240, 0)');
        gradient.addColorStop(0.5, `rgba(230, 235, 240, ${0.18 - i * 0.04})`);
        gradient.addColorStop(1, 'rgba(230, 235, 240, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, this.height * (0.4 + i * 0.15), this.width, this.height * 0.35);
      }
    }

    if (category === 'windy') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
      for (const streak of this.windStreaks) {
        if (!this.state.reducedMotion) {
          streak.x += streak.speed * dt;
          if (streak.x > this.width + 60) streak.x = -60;
        }
        ctx.globalAlpha = streak.opacity;
        ctx.beginPath();
        ctx.moveTo(streak.x, streak.y);
        ctx.lineTo(streak.x + streak.length, streak.y + streak.length * 0.08);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawLightning(dt: number): void {
    if (this.state.category !== 'thunderstorm') {
      this.lightningFlash = 0;
      return;
    }
    if (!this.state.reducedMotion) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = randomRange(Math.random, 2.5, 7);
        this.lightningFlash = 1;
      }
      if (this.lightningFlash > 0) {
        this.lightningFlash = clamp(this.lightningFlash - dt * 2.5, 0, 1);
      }
    }
    if (this.lightningFlash > 0) {
      const ctx = this.fgCtx;
      ctx.fillStyle = `rgba(255, 255, 255, ${this.lightningFlash * 0.45})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }
}
