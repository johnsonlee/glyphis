import type { Platform, RenderCommand, InputEvent, TextInputConfig } from '../types';

declare const __glyphis_native: {
  submitRenderCommands(commands: any): void;
  measureText(text: string, fontSize: number, fontFamily: string, fontWeight: string): { width: number; height: number };
  getViewportSize(): { width: number; height: number };
  loadImage(imageId: string, url: string): void;
  showTextInput(
    inputId: string, x: number, y: number, width: number, height: number,
    value: string, placeholder: string, fontSize: number,
    color: string, placeholderColor: string,
    keyboardType: string, returnKeyType: string,
    secureTextEntry: boolean, multiline: boolean, maxLength: number
  ): void;
  updateTextInput(inputId: string, x: number, y: number, width: number, height: number): void;
  hideTextInput(inputId: string): void;
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
      __glyphis_native.submitRenderCommands(commands);
    },

    getViewport() {
      return __glyphis_native.getViewportSize();
    },

    onInput(callback: (event: InputEvent) => void) {
      (globalThis as any).__glyphis_handleTouch = function(type: string, x: number, y: number) {
        if (type === 'pointerdown' || type === 'pointerup' || type === 'pointermove') {
          callback({ type: type, x: x, y: y } as any);
        }
      };
      (globalThis as any).__glyphis_onTextChange = function(inputId: string, text: string) {
        callback({ type: 'textchange', inputId: inputId, text: text });
      };
      (globalThis as any).__glyphis_onTextSubmit = function(inputId: string) {
        callback({ type: 'textsubmit', inputId: inputId });
      };
      (globalThis as any).__glyphis_onTextFocus = function(inputId: string) {
        callback({ type: 'textfocus', inputId: inputId });
      };
      (globalThis as any).__glyphis_onTextBlur = function(inputId: string) {
        callback({ type: 'textblur', inputId: inputId });
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

    showTextInput(config: TextInputConfig) {
      __glyphis_native.showTextInput(
        config.inputId, config.x, config.y, config.width, config.height,
        config.value, config.placeholder, config.fontSize,
        config.color, config.placeholderColor,
        config.keyboardType, config.returnKeyType,
        config.secureTextEntry, config.multiline, config.maxLength
      );
    },

    updateTextInput(inputId: string, config: Partial<TextInputConfig>) {
      __glyphis_native.updateTextInput(
        inputId,
        config.x != null ? config.x : -1,
        config.y != null ? config.y : -1,
        config.width != null ? config.width : -1,
        config.height != null ? config.height : -1
      );
    },

    hideTextInput(inputId: string) {
      __glyphis_native.hideTextInput(inputId);
    },

    onViewportChange(callback: () => void) {
      viewportChangeCallback = callback;
    },
  };
}
