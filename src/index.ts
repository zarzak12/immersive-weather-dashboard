import './card';
import './editor/editor';

declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
      preview?: boolean;
      documentationURL?: string;
    }>;
  }
}

window.customCards = window.customCards ?? [];
window.customCards.push({
  type: 'immersive-weather-dashboard',
  name: 'Immersive Weather Dashboard',
  description: 'Full-screen procedural weather scene rendered behind your own house photo.',
  preview: true,
  documentationURL: 'https://github.com/zarzak12/immersive-weather-dashboard'
});
