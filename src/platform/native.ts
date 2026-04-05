import type { Platform, RenderCommand, InputEvent } from '../types';

declare const __glyphis_native: {
  submitRenderCommands(packed: string): void;
  measureText(text: string, fontSize: number, fontFamily: string, fontWeight: string): { width: number; height: number };
  getViewportSize(): { width: number; height: number };
  loadImage(imageId: string, url: string): void;
  platform: 'ios' | 'android';
};

export interface NativePlatform extends Platform {
  onViewportChange(callback: () => void): void;
}

export function createNativePlatform(): NativePlatform {
  let viewportChangeCallback: (() => void) | null = null;

  (globalThis as any).__glyphis_updateViewport = () => {
    if (viewportChangeCallback) {
      viewportChangeCallback();
    }
  };

  return {
    measureText(text: string, fontSize: number, fontFamily?: string, fontWeight?: string) {
      return __glyphis_native.measureText(text, fontSize, fontFamily || '', fontWeight || '');
    },

    render(commands: RenderCommand[]) {
      __glyphis_native.submitRenderCommands(JSON.stringify(commands));
    },

    getViewport() {
      return __glyphis_native.getViewportSize();
    },

    onInput(callback: (event: InputEvent) => void) {
      (globalThis as any).__glyphis_handleTouch = (type: string, x: number, y: number) => {
        if (type === 'pointerdown' || type === 'pointerup' || type === 'pointermove') {
          callback({ type, x, y } as any);
        }
      };
    },

    loadImage(imageId: string, url: string) {
      __glyphis_native.loadImage(imageId, url);
    },

    onImageLoaded(callback: (id: string, w: number, h: number) => void) {
      (globalThis as any).__glyphis_onImageLoaded = function(id: string, w: number, h: number) {
        callback(id, w, h);
      };
    },

    onViewportChange(callback: () => void) {
      viewportChangeCallback = callback;
    },
  };
}
