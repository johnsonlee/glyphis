import { describe, test, expect, beforeEach, mock } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock the __glyphis_native bridge before importing the module under test
// ---------------------------------------------------------------------------

const mockSubmitRenderCommands = mock(function () {});
const mockMeasureText = mock(function () { return { width: 50, height: 20 }; });
const mockGetViewportSize = mock(function () { return { width: 390, height: 844 }; });
const mockLoadImage = mock(function (_id: string, _url: string) {});
const mockShowTextInput = mock(function (
  _inputId: string, _x: number, _y: number, _w: number, _h: number,
  _value: string, _placeholder: string, _fontSize: number,
  _color: string, _phColor: string,
  _kbType: string, _retKey: string,
  _secure: boolean, _multiline: boolean, _maxLen: number
) {});
const mockUpdateTextInput = mock(function (_inputId: string, _x: number, _y: number, _w: number, _h: number) {});
const mockHideTextInput = mock(function (_inputId: string) {});

(globalThis as any).__glyphis_native = {
  submitRenderCommands: mockSubmitRenderCommands,
  measureText: mockMeasureText,
  getViewportSize: mockGetViewportSize,
  loadImage: mockLoadImage,
  showTextInput: mockShowTextInput,
  updateTextInput: mockUpdateTextInput,
  hideTextInput: mockHideTextInput,
  platform: 'ios' as const,
};

import { createNativePlatform } from '../src/platform/native';

beforeEach(function () {
  mockSubmitRenderCommands.mockReset();
  mockMeasureText.mockReset();
  mockMeasureText.mockReturnValue({ width: 50, height: 20 });
  mockGetViewportSize.mockReset();
  mockGetViewportSize.mockReturnValue({ width: 390, height: 844 });
  mockLoadImage.mockReset();
  mockShowTextInput.mockReset();
  mockUpdateTextInput.mockReset();
  mockHideTextInput.mockReset();
  // Clean up globals
  delete (globalThis as any).__glyphis_handleTouch;
  delete (globalThis as any).__glyphis_updateViewport;
  delete (globalThis as any).__glyphis_onImageLoaded;
  delete (globalThis as any).__glyphis_onTextChange;
  delete (globalThis as any).__glyphis_onTextSubmit;
  delete (globalThis as any).__glyphis_onTextFocus;
  delete (globalThis as any).__glyphis_onTextBlur;
});

// ---------------------------------------------------------------------------
// createNativePlatform shape
// ---------------------------------------------------------------------------

describe('createNativePlatform', () => {
  test('returns object with Platform methods and onViewportChange', () => {
    const platform = createNativePlatform();
    expect(typeof platform.measureText).toBe('function');
    expect(typeof platform.render).toBe('function');
    expect(typeof platform.getViewport).toBe('function');
    expect(typeof platform.onInput).toBe('function');
    expect(typeof platform.onViewportChange).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// measureText
// ---------------------------------------------------------------------------

describe('measureText', () => {
  test('delegates to __glyphis_native.measureText', () => {
    const platform = createNativePlatform();
    const result = platform.measureText('Hello', 16, 'Arial', 'bold');
    expect(mockMeasureText).toHaveBeenCalledWith('Hello', 16, 'Arial', 'bold');
    expect(result).toEqual({ width: 50, height: 20 });
  });

  test('passes empty strings for undefined fontFamily/fontWeight', () => {
    const platform = createNativePlatform();
    platform.measureText('Test', 14);
    expect(mockMeasureText).toHaveBeenCalledWith('Test', 14, '', '');
  });

  test('passes empty string for undefined fontWeight only', () => {
    const platform = createNativePlatform();
    platform.measureText('Test', 14, 'Helvetica');
    expect(mockMeasureText).toHaveBeenCalledWith('Test', 14, 'Helvetica', '');
  });
});

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

describe('render', () => {
  test('passes commands array to submitRenderCommands', () => {
    const platform = createNativePlatform();
    const commands = [
      { type: 'rect' as const, x: 0, y: 0, width: 100, height: 50, color: '#ff0000' },
      { type: 'text' as const, x: 10, y: 10, text: 'Hello', color: '#000000', fontSize: 16 },
    ];
    platform.render(commands);

    expect(mockSubmitRenderCommands).toHaveBeenCalledTimes(1);
    const arg = mockSubmitRenderCommands.mock.calls[0][0];
    expect(arg).toEqual(commands);
  });

  test('empty commands array', () => {
    const platform = createNativePlatform();
    platform.render([]);
    expect(mockSubmitRenderCommands).toHaveBeenCalledWith([]);
  });
});

// ---------------------------------------------------------------------------
// getViewport
// ---------------------------------------------------------------------------

describe('getViewport', () => {
  test('delegates to __glyphis_native.getViewportSize', () => {
    const platform = createNativePlatform();
    const result = platform.getViewport();
    expect(mockGetViewportSize).toHaveBeenCalled();
    expect(result).toEqual({ width: 390, height: 844 });
  });
});

// ---------------------------------------------------------------------------
// onInput
// ---------------------------------------------------------------------------

describe('onInput', () => {
  test('registers __glyphis_handleTouch global', () => {
    const platform = createNativePlatform();
    const callback = mock(() => {});
    platform.onInput(callback);

    expect(typeof (globalThis as any).__glyphis_handleTouch).toBe('function');
  });

  test('__glyphis_handleTouch dispatches pointerdown event', () => {
    const platform = createNativePlatform();
    const callback = mock(() => {});
    platform.onInput(callback);

    (globalThis as any).__glyphis_handleTouch('pointerdown', 100, 200);
    expect(callback).toHaveBeenCalledWith({ type: 'pointerdown', x: 100, y: 200 });
  });

  test('__glyphis_handleTouch dispatches pointerup event', () => {
    const platform = createNativePlatform();
    const callback = mock(() => {});
    platform.onInput(callback);

    (globalThis as any).__glyphis_handleTouch('pointerup', 150, 250);
    expect(callback).toHaveBeenCalledWith({ type: 'pointerup', x: 150, y: 250 });
  });

  test('__glyphis_handleTouch dispatches pointermove', () => {
    const platform = createNativePlatform();
    const callback = mock(() => {});
    platform.onInput(callback);

    (globalThis as any).__glyphis_handleTouch('pointermove', 100, 200);
    expect(callback).toHaveBeenCalledWith({ type: 'pointermove', x: 100, y: 200 });
  });

  test('__glyphis_handleTouch ignores non-pointer types', () => {
    const platform = createNativePlatform();
    const callback = mock(() => {});
    platform.onInput(callback);

    (globalThis as any).__glyphis_handleTouch('click', 100, 200);
    expect(callback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// onViewportChange
// ---------------------------------------------------------------------------

describe('onViewportChange', () => {
  test('callback is called when __glyphis_updateViewport fires', () => {
    const platform = createNativePlatform();
    const callback = mock(() => {});
    platform.onViewportChange(callback);

    // Trigger the viewport update
    (globalThis as any).__glyphis_updateViewport();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('__glyphis_updateViewport does not throw when no callback registered', () => {
    const platform = createNativePlatform();
    // __glyphis_updateViewport is registered in createNativePlatform, but no
    // onViewportChange callback set. Should not throw.
    expect(() => {
      (globalThis as any).__glyphis_updateViewport();
    }).not.toThrow();
  });

  test('multiple viewport change events', () => {
    const platform = createNativePlatform();
    const callback = mock(() => {});
    platform.onViewportChange(callback);

    (globalThis as any).__glyphis_updateViewport();
    (globalThis as any).__glyphis_updateViewport();
    (globalThis as any).__glyphis_updateViewport();
    expect(callback).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// loadImage
// ---------------------------------------------------------------------------

describe('loadImage', () => {
  test('delegates to __glyphis_native.loadImage', () => {
    var platform = createNativePlatform();
    platform.loadImage('img-1', 'https://example.com/photo.jpg');
    expect(mockLoadImage).toHaveBeenCalledWith('img-1', 'https://example.com/photo.jpg');
  });
});

// ---------------------------------------------------------------------------
// onImageLoaded
// ---------------------------------------------------------------------------

describe('onImageLoaded', () => {
  test('registers __glyphis_onImageLoaded global', () => {
    var platform = createNativePlatform();
    var callback = mock(function () {});
    platform.onImageLoaded(callback);

    expect(typeof (globalThis as any).__glyphis_onImageLoaded).toBe('function');
  });

  test('__glyphis_onImageLoaded dispatches to callback', () => {
    var platform = createNativePlatform();
    var callback = mock(function () {});
    platform.onImageLoaded(callback);

    (globalThis as any).__glyphis_onImageLoaded('img-1', 800, 600);
    expect(callback).toHaveBeenCalledWith('img-1', 800, 600);
  });

  test('__glyphis_onImageLoaded with multiple images', () => {
    var platform = createNativePlatform();
    var results: Array<{ id: string; w: number; h: number }> = [];
    platform.onImageLoaded(function (id: string, w: number, h: number) {
      results.push({ id: id, w: w, h: h });
    });

    (globalThis as any).__glyphis_onImageLoaded('img-a', 100, 50);
    (globalThis as any).__glyphis_onImageLoaded('img-b', 200, 150);

    expect(results.length).toBe(2);
    expect(results[0]).toEqual({ id: 'img-a', w: 100, h: 50 });
    expect(results[1]).toEqual({ id: 'img-b', w: 200, h: 150 });
  });
});

// ---------------------------------------------------------------------------
// showTextInput
// ---------------------------------------------------------------------------

describe('showTextInput', function () {
  test('calls __glyphis_native.showTextInput with individual args', function () {
    var platform = createNativePlatform();
    var config = {
      inputId: 'native-ti-1',
      x: 10, y: 20, width: 200, height: 40,
      value: 'hello',
      placeholder: 'Type',
      fontSize: 16,
      color: '#000000',
      placeholderColor: '#999999',
      keyboardType: 'default',
      returnKeyType: 'done',
      secureTextEntry: false,
      multiline: false,
      maxLength: 0,
    };
    platform.showTextInput(config);

    expect(mockShowTextInput).toHaveBeenCalledTimes(1);
    expect(mockShowTextInput).toHaveBeenCalledWith(
      'native-ti-1', 10, 20, 200, 40,
      'hello', 'Type', 16,
      '#000000', '#999999',
      'default', 'done',
      false, false, 0
    );
  });
});

// ---------------------------------------------------------------------------
// updateTextInput
// ---------------------------------------------------------------------------

describe('updateTextInput', function () {
  test('calls __glyphis_native.updateTextInput with individual args', function () {
    var platform = createNativePlatform();
    platform.updateTextInput('native-ti-1', { x: 50, y: 60, width: 200, height: 40 });

    expect(mockUpdateTextInput).toHaveBeenCalledTimes(1);
    expect(mockUpdateTextInput).toHaveBeenCalledWith('native-ti-1', 50, 60, 200, 40);
  });

  test('passes -1 for omitted position fields', function () {
    var platform = createNativePlatform();
    platform.updateTextInput('native-ti-1', { value: 'updated' });

    expect(mockUpdateTextInput).toHaveBeenCalledTimes(1);
    expect(mockUpdateTextInput).toHaveBeenCalledWith('native-ti-1', -1, -1, -1, -1);
  });
});

// ---------------------------------------------------------------------------
// hideTextInput
// ---------------------------------------------------------------------------

describe('hideTextInput', function () {
  test('calls __glyphis_native.hideTextInput', function () {
    var platform = createNativePlatform();
    platform.hideTextInput('native-ti-1');
    expect(mockHideTextInput).toHaveBeenCalledWith('native-ti-1');
  });
});

// ---------------------------------------------------------------------------
// Text input event callbacks
// ---------------------------------------------------------------------------

describe('text input events via onInput', function () {
  test('__glyphis_onTextChange dispatches textchange event', function () {
    var platform = createNativePlatform();
    var receivedEvent: any = null;
    platform.onInput(function (event: any) { receivedEvent = event; });

    expect(typeof (globalThis as any).__glyphis_onTextChange).toBe('function');
    (globalThis as any).__glyphis_onTextChange('input-abc', 'new text');

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent.type).toBe('textchange');
    expect(receivedEvent.inputId).toBe('input-abc');
    expect(receivedEvent.text).toBe('new text');
  });

  test('__glyphis_onTextSubmit dispatches textsubmit event', function () {
    var platform = createNativePlatform();
    var receivedEvent: any = null;
    platform.onInput(function (event: any) { receivedEvent = event; });

    expect(typeof (globalThis as any).__glyphis_onTextSubmit).toBe('function');
    (globalThis as any).__glyphis_onTextSubmit('input-abc');

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent.type).toBe('textsubmit');
    expect(receivedEvent.inputId).toBe('input-abc');
  });

  test('__glyphis_onTextFocus dispatches textfocus event', function () {
    var platform = createNativePlatform();
    var receivedEvent: any = null;
    platform.onInput(function (event: any) { receivedEvent = event; });

    expect(typeof (globalThis as any).__glyphis_onTextFocus).toBe('function');
    (globalThis as any).__glyphis_onTextFocus('input-abc');

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent.type).toBe('textfocus');
    expect(receivedEvent.inputId).toBe('input-abc');
  });

  test('__glyphis_onTextBlur dispatches textblur event', function () {
    var platform = createNativePlatform();
    var receivedEvent: any = null;
    platform.onInput(function (event: any) { receivedEvent = event; });

    expect(typeof (globalThis as any).__glyphis_onTextBlur).toBe('function');
    (globalThis as any).__glyphis_onTextBlur('input-abc');

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent.type).toBe('textblur');
    expect(receivedEvent.inputId).toBe('input-abc');
  });
});
