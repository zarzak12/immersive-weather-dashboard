import { afterEach, describe, expect, it, vi } from 'vitest';
import { SceneRenderer, type SceneState } from '../src/rendering/scene-renderer';

const animatedState: SceneState = {
  category: 'clear',
  isDay: true,
  quality: 'low',
  intensity: 1,
  windSpeedKmh: 0,
  windBearingDeg: 0,
  reducedMotion: false,
  cloudCoverage: 0
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SceneRenderer motion lifecycle', () => {
  it('stops an active frame loop in reduced-motion mode and restarts when animation is restored', () => {
    const requestFrame = vi.fn(() => 42);
    const cancelFrame = vi.fn();
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelFrame);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);

    const renderer = new SceneRenderer(document.createElement('canvas'), document.createElement('canvas'));
    renderer.setState(animatedState);
    renderer.start();

    renderer.setState({ ...animatedState, reducedMotion: true });
    expect(cancelFrame).toHaveBeenCalledWith(42);

    renderer.setState(animatedState);
    expect(requestFrame).toHaveBeenCalledTimes(2);
  });
});
