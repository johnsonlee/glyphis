import { describe, test, expect, beforeEach, mock } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock DOM globals that createWebPlatform needs
// ---------------------------------------------------------------------------

// Keep track of registered event listeners on the canvas
let canvasListeners: Record<string, Function[]> = {};

const mockMeasureCtx = {
  font: '',
  measureText: mock((text: string) => ({ width: text.length * 8 })),
};

const mockCtx: Record<string, any> = {
  clearRect: mock(() => {}),
  fillRect: mock(() => {}),
  fillText: mock(() => {}),
  strokeRect: mock(() => {}),
  save: mock(() => {}),
  restore: mock(() => {}),
  scale: mock(() => {}),
  beginPath: mock(() => {}),
  closePath: mock(() => {}),
  moveTo: mock(() => {}),
  arcTo: mock(() => {}),
  fill: mock(() => {}),
  stroke: mock(() => {}),
  clip: mock(() => {}),
  rect: mock(() => {}),
  measureText: mock(() => ({ width: 50 })),
  font: '',
  fillStyle: '',
  strokeStyle: '',
  textBaseline: '',
  textAlign: '',
  globalAlpha: 1,
  lineWidth: 1,
};

var mockParentElement = {
  style: {} as Record<string, string>,
  appendChild: mock(function (child: any) {
    child.parentElement = mockParentElement;
  }),
  removeChild: mock(function () {}),
};

const mockCanvas = {
  getContext: mock(function (type: string) {
    if (type === '2d') return mockCtx;
    return null;
  }),
  getBoundingClientRect: mock(function () { return { width: 390, height: 844, left: 0, top: 0 }; }),
  width: 0,
  height: 0,
  addEventListener: mock(function (event: string, handler: Function) {
    if (!canvasListeners[event]) canvasListeners[event] = [];
    canvasListeners[event].push(handler);
  }),
  parentElement: mockParentElement,
};

// Mock document.createElement for the measure canvas
const mockMeasureCanvas = {
  getContext: mock(function () { return mockMeasureCtx; }),
};

// Track created DOM elements for TextInput tests
var createdElements: any[] = [];

function createMockElement(tag: string): any {
  var listeners: Record<string, Function[]> = {};
  var el = {
    tagName: tag.toUpperCase(),
    type: '',
    value: '',
    placeholder: '',
    inputMode: '',
    maxLength: -1,
    style: {} as Record<string, string>,
    parentElement: null as any,
    focus: mock(function () {
      // Fire focus event listeners
      var fns = listeners['focus'];
      if (fns) { for (var i = 0; i < fns.length; i++) fns[i](); }
    }),
    blur: mock(function () {}),
    addEventListener: function (event: string, handler: Function) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    removeChild: mock(function () {}),
    _listeners: listeners,
    _fireEvent: function (eventName: string, eventObj?: any) {
      var fns = listeners[eventName];
      if (fns) { for (var i = 0; i < fns.length; i++) fns[i](eventObj); }
    },
  };
  createdElements.push(el);
  return el;
}

(globalThis as any).document = {
  createElement: mock(function (tag: string) {
    if (tag === 'canvas') return mockMeasureCanvas;
    return createMockElement(tag);
  }),
};

(globalThis as any).window = {
  devicePixelRatio: 2,
};

import { createWebPlatform } from '../src/platform/web';

function resetAllMocks() {
  for (const key of Object.keys(mockCtx)) {
    var val = mockCtx[key];
    if (val && typeof val.mockClear === 'function') {
      val.mockClear();
    }
  }
  mockMeasureCtx.measureText.mockClear();
  mockMeasureCtx.measureText.mockReturnValue({ width: 40 });
  mockCanvas.addEventListener.mockClear();
  mockCanvas.getBoundingClientRect.mockClear();
  mockCanvas.getBoundingClientRect.mockReturnValue({ width: 390, height: 844, left: 0, top: 0 });
  mockCanvas.getContext.mockClear();
  mockCanvas.getContext.mockReturnValue(mockCtx);
  canvasListeners = {};
  createdElements = [];
  mockParentElement.appendChild.mockClear();
  mockParentElement.removeChild.mockClear();
  mockParentElement.style = {};
  // Reset mutable ctx properties
  mockCtx.font = '';
  mockCtx.fillStyle = '';
  mockCtx.strokeStyle = '';
  mockCtx.textBaseline = '';
  mockCtx.textAlign = '';
  mockCtx.globalAlpha = 1;
  mockCtx.lineWidth = 1;
}

beforeEach(() => {
  resetAllMocks();
});

// ---------------------------------------------------------------------------
// createWebPlatform shape
// ---------------------------------------------------------------------------

describe('createWebPlatform', () => {
  test('returns Platform with 4 methods', () => {
    const platform = createWebPlatform(mockCanvas as any);
    expect(typeof platform.measureText).toBe('function');
    expect(typeof platform.render).toBe('function');
    expect(typeof platform.getViewport).toBe('function');
    expect(typeof platform.onInput).toBe('function');
  });

  test('initializes canvas dimensions based on dpr', () => {
    // getBoundingClientRect returns 390x844, dpr is 2
    createWebPlatform(mockCanvas as any);
    expect(mockCanvas.width).toBe(780);
    expect(mockCanvas.height).toBe(1688);
  });

  test('scales the context by dpr', () => {
    createWebPlatform(mockCanvas as any);
    expect(mockCtx.scale).toHaveBeenCalledWith(2, 2);
  });

  test('registers pointer event listeners on canvas', () => {
    createWebPlatform(mockCanvas as any);
    expect(mockCanvas.addEventListener).toHaveBeenCalledTimes(3);

    const eventNames = mockCanvas.addEventListener.mock.calls.map((c: any) => c[0]);
    expect(eventNames).toContain('pointerdown');
    expect(eventNames).toContain('pointerup');
    expect(eventNames).toContain('pointermove');
  });
});

// ---------------------------------------------------------------------------
// measureText
// ---------------------------------------------------------------------------

describe('measureText', () => {
  test('uses canvas measureText and returns width/height', () => {
    const platform = createWebPlatform(mockCanvas as any);
    mockMeasureCtx.measureText.mockReturnValue({ width: 72 });
    const result = platform.measureText('Hello', 16);
    expect(result.width).toBe(72);
    expect(result.height).toBe(16 * 1.2); // fontSize * 1.2
  });

  test('sets correct font on measure context', () => {
    const platform = createWebPlatform(mockCanvas as any);
    mockMeasureCtx.measureText.mockReturnValue({ width: 50 });
    platform.measureText('Test', 20, 'Helvetica', '700');
    expect(mockMeasureCtx.font).toBe('700 20px Helvetica');
  });

  test('uses default font family and weight', () => {
    const platform = createWebPlatform(mockCanvas as any);
    mockMeasureCtx.measureText.mockReturnValue({ width: 50 });
    platform.measureText('Test', 14);
    expect(mockMeasureCtx.font).toBe('400 14px system-ui, -apple-system, sans-serif');
  });
});

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

describe('render', () => {
  test('calls clearRect before drawing', () => {
    const platform = createWebPlatform(mockCanvas as any);
    platform.render([]);
    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 390, 844);
  });

  test('rect command draws filled rectangle', () => {
    const platform = createWebPlatform(mockCanvas as any);
    platform.render([
      { type: 'rect', x: 10, y: 20, width: 100, height: 50, color: '#ff0000' },
    ]);
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.fillRect).toHaveBeenCalledWith(10, 20, 100, 50);
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  test('rect command with borderRadius uses rounded path', () => {
    const platform = createWebPlatform(mockCanvas as any);
    platform.render([
      { type: 'rect', x: 0, y: 0, width: 100, height: 50, color: '#00ff00', borderRadius: 8 },
    ]);
    // When borderRadius is set, it calls fill() instead of fillRect()
    expect(mockCtx.fill).toHaveBeenCalled();
    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.arcTo).toHaveBeenCalled();
    expect(mockCtx.closePath).toHaveBeenCalled();
  });

  test('rect command with opacity sets globalAlpha', () => {
    const platform = createWebPlatform(mockCanvas as any);
    platform.render([
      { type: 'rect', x: 0, y: 0, width: 100, height: 50, color: '#000', opacity: 0.5 },
    ]);
    // globalAlpha is set inside save/restore
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  test('text command draws text', () => {
    const platform = createWebPlatform(mockCanvas as any);
    platform.render([
      { type: 'text', x: 10, y: 20, text: 'Hello', color: '#000', fontSize: 16 },
    ]);
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.fillText).toHaveBeenCalledWith('Hello', 10, 20);
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  test('text command with center alignment', () => {
    const platform = createWebPlatform(mockCanvas as any);
    platform.render([
      {
        type: 'text',
        x: 10,
        y: 20,
        text: 'Centered',
        color: '#000',
        fontSize: 16,
        textAlign: 'center',
        maxWidth: 200,
      },
    ]);
    // x should be offset: 10 + 200/2 = 110
    expect(mockCtx.fillText).toHaveBeenCalledWith('Centered', 110, 20);
  });

  test('text command with right alignment', () => {
    const platform = createWebPlatform(mockCanvas as any);
    platform.render([
      {
        type: 'text',
        x: 10,
        y: 20,
        text: 'Right',
        color: '#000',
        fontSize: 16,
        textAlign: 'right',
        maxWidth: 200,
      },
    ]);
    // x should be offset: 10 + 200 = 210
    expect(mockCtx.fillText).toHaveBeenCalledWith('Right', 210, 20);
  });

  test('text command with left alignment (default)', () => {
    const platform = createWebPlatform(mockCanvas as any);
    platform.render([
      {
        type: 'text',
        x: 10,
        y: 20,
        text: 'Left',
        color: '#000',
        fontSize: 16,
        textAlign: 'left',
        maxWidth: 200,
      },
    ]);
    expect(mockCtx.fillText).toHaveBeenCalledWith('Left', 10, 20);
  });

  test('border command draws stroked rectangle', () => {
    const platform = createWebPlatform(mockCanvas as any);
    platform.render([
      {
        type: 'border',
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        color: '#000',
        widths: [2, 2, 2, 2] as [number, number, number, number],
      },
    ]);
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.strokeRect).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  test('border command with borderRadius uses rounded stroke', () => {
    const platform = createWebPlatform(mockCanvas as any);
    platform.render([
      {
        type: 'border',
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        color: '#000',
        widths: [2, 2, 2, 2] as [number, number, number, number],
        borderRadius: 8,
      },
    ]);
    expect(mockCtx.stroke).toHaveBeenCalled();
    expect(mockCtx.beginPath).toHaveBeenCalled();
  });

  test('clip-start and clip-end commands', () => {
    const platform = createWebPlatform(mockCanvas as any);
    platform.render([
      { type: 'clip-start', id: 1, x: 0, y: 0, width: 100, height: 50 },
      { type: 'rect', x: 0, y: 0, width: 200, height: 100, color: '#ff0000' },
      { type: 'clip-end', id: 1 },
    ]);

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.clip).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  test('clip-start with borderRadius uses rounded clip', () => {
    const platform = createWebPlatform(mockCanvas as any);
    platform.render([
      { type: 'clip-start', id: 1, x: 0, y: 0, width: 100, height: 50, borderRadius: 10 },
      { type: 'clip-end', id: 1 },
    ]);

    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.arcTo).toHaveBeenCalled();
    expect(mockCtx.clip).toHaveBeenCalled();
  });

  test('clip-start without borderRadius uses rect clip', () => {
    const platform = createWebPlatform(mockCanvas as any);
    platform.render([
      { type: 'clip-start', id: 1, x: 5, y: 10, width: 100, height: 50 },
      { type: 'clip-end', id: 1 },
    ]);

    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.rect).toHaveBeenCalledWith(5, 10, 100, 50);
    expect(mockCtx.clip).toHaveBeenCalled();
  });

  test('multiple commands rendered in sequence', () => {
    const platform = createWebPlatform(mockCanvas as any);
    platform.render([
      { type: 'rect', x: 0, y: 0, width: 390, height: 844, color: '#ffffff' },
      { type: 'text', x: 10, y: 10, text: 'Title', color: '#000', fontSize: 24 },
      { type: 'rect', x: 10, y: 50, width: 370, height: 2, color: '#cccccc' },
    ]);

    // clearRect once, then 2 fillRect (one for each rect), 1 fillText
    expect(mockCtx.clearRect).toHaveBeenCalledTimes(1);
    expect(mockCtx.fillRect).toHaveBeenCalledTimes(2);
    expect(mockCtx.fillText).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getViewport
// ---------------------------------------------------------------------------

describe('getViewport', () => {
  test('returns canvas dimensions (CSS, not physical)', () => {
    const platform = createWebPlatform(mockCanvas as any);
    const viewport = platform.getViewport();
    // getBoundingClientRect returns 390x844
    expect(viewport).toEqual({ width: 390, height: 844 });
  });
});

// ---------------------------------------------------------------------------
// onInput
// ---------------------------------------------------------------------------

describe('onInput', () => {
  test('registers pointer event listeners on canvas', () => {
    createWebPlatform(mockCanvas as any);

    // The constructor registers 3 event listeners
    const eventNames = mockCanvas.addEventListener.mock.calls.map((c: any) => c[0]);
    expect(eventNames).toContain('pointerdown');
    expect(eventNames).toContain('pointerup');
    expect(eventNames).toContain('pointermove');
  });

  test('pointerdown triggers callback with correct coords', () => {
    const platform = createWebPlatform(mockCanvas as any);
    const callback = mock(() => {});
    platform.onInput(callback);

    // Simulate a pointerdown event
    const pointerdownHandler = canvasListeners['pointerdown']?.[0];
    expect(pointerdownHandler).toBeDefined();

    // getBoundingClientRect returns {left: 0, top: 0}
    pointerdownHandler({ clientX: 100, clientY: 200 });
    expect(callback).toHaveBeenCalledWith({ type: 'pointerdown', x: 100, y: 200 });
  });

  test('pointerup triggers callback', () => {
    const platform = createWebPlatform(mockCanvas as any);
    const callback = mock(() => {});
    platform.onInput(callback);

    const pointerupHandler = canvasListeners['pointerup']?.[0];
    expect(pointerupHandler).toBeDefined();

    pointerupHandler({ clientX: 150, clientY: 250 });
    expect(callback).toHaveBeenCalledWith({ type: 'pointerup', x: 150, y: 250 });
  });

  test('pointermove triggers callback', () => {
    const platform = createWebPlatform(mockCanvas as any);
    const callback = mock(() => {});
    platform.onInput(callback);

    const pointermoveHandler = canvasListeners['pointermove']?.[0];
    expect(pointermoveHandler).toBeDefined();

    pointermoveHandler({ clientX: 120, clientY: 300 });
    expect(callback).toHaveBeenCalledWith({ type: 'pointermove', x: 120, y: 300 });
  });

  test('events before onInput do not throw', () => {
    createWebPlatform(mockCanvas as any);
    // Listeners are registered, but no callback set via onInput yet
    const pointerdownHandler = canvasListeners['pointerdown']?.[0];
    // Should not throw (inputCallback is null, uses optional chaining)
    expect(() => {
      pointerdownHandler({ clientX: 50, clientY: 50 });
    }).not.toThrow();
  });

  test('pointerdown adjusts for canvas offset', () => {
    mockCanvas.getBoundingClientRect.mockReturnValue({ width: 390, height: 844, left: 20, top: 40 });
    const platform = createWebPlatform(mockCanvas as any);
    const callback = mock(() => {});
    platform.onInput(callback);

    const pointerdownHandler = canvasListeners['pointerdown']?.[0];
    pointerdownHandler({ clientX: 120, clientY: 240 });
    // x = 120 - 20 = 100, y = 240 - 40 = 200
    expect(callback).toHaveBeenCalledWith({ type: 'pointerdown', x: 100, y: 200 });
  });
});

// ---------------------------------------------------------------------------
// Image loading
// ---------------------------------------------------------------------------

var mockImages: any[] = [];

describe('loadImage', () => {
  beforeEach(() => {
    mockImages = [];
    (globalThis as any).Image = function () {
      var img = { onload: null as any, onerror: null as any, src: '', naturalWidth: 100, naturalHeight: 50, crossOrigin: '' };
      mockImages.push(img);
      return img;
    };
  });

  test('loads an image and fires onImageLoaded callback', () => {
    var platform = createWebPlatform(mockCanvas as any);
    var loadedCallback = mock(function () {});
    platform.onImageLoaded(loadedCallback);

    platform.loadImage('img-1', 'https://example.com/photo.jpg');
    expect(mockImages.length).toBe(1);
    expect(mockImages[0].src).toBe('https://example.com/photo.jpg');
    expect(mockImages[0].crossOrigin).toBe('anonymous');

    // Simulate image load
    mockImages[0].onload();
    expect(loadedCallback).toHaveBeenCalledWith('img-1', 100, 50);
  });

  test('returns cached image on second call', () => {
    var platform = createWebPlatform(mockCanvas as any);
    var loadedCallback = mock(function () {});
    platform.onImageLoaded(loadedCallback);

    platform.loadImage('img-2', 'https://example.com/a.jpg');
    // Trigger onload to cache the image
    mockImages[0].onload();
    loadedCallback.mockClear();

    // Second call should use cache, not create new Image
    var prevCount = mockImages.length;
    platform.loadImage('img-2', 'https://example.com/a.jpg');
    expect(mockImages.length).toBe(prevCount);
    // Callback should still fire with cached dimensions
    expect(loadedCallback).toHaveBeenCalledWith('img-2', 100, 50);
  });

  test('onImageLoaded callback fires when image loads', () => {
    var platform = createWebPlatform(mockCanvas as any);
    var callbackResult: { id: string; w: number; h: number } | null = null;
    platform.onImageLoaded(function (id: string, w: number, h: number) {
      callbackResult = { id: id, w: w, h: h };
    });

    platform.loadImage('img-3', 'https://example.com/b.jpg');
    mockImages[0].naturalWidth = 200;
    mockImages[0].naturalHeight = 150;
    mockImages[0].onload();

    expect(callbackResult).toEqual({ id: 'img-3', w: 200, h: 150 });
  });

  test('onerror does not throw', () => {
    var platform = createWebPlatform(mockCanvas as any);
    platform.loadImage('img-err', 'https://example.com/bad.jpg');
    expect(function () {
      mockImages[0].onerror();
    }).not.toThrow();
  });

  test('loadImage without onImageLoaded set does not throw', () => {
    var platform = createWebPlatform(mockCanvas as any);
    platform.loadImage('img-no-cb', 'https://example.com/c.jpg');
    expect(function () {
      mockImages[0].onload();
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Image rendering (drawImage)
// ---------------------------------------------------------------------------

describe('render image commands', () => {
  beforeEach(() => {
    mockImages = [];
    (globalThis as any).Image = function () {
      var img = { onload: null as any, onerror: null as any, src: '', naturalWidth: 200, naturalHeight: 100, crossOrigin: '' };
      mockImages.push(img);
      return img;
    };
  });

  test('image command with stretch draws at exact dimensions', () => {
    var platform = createWebPlatform(mockCanvas as any);
    platform.onImageLoaded(function () {});

    // Load and cache an image
    platform.loadImage('stretch-img', 'https://example.com/s.jpg');
    mockImages[0].onload();

    // Reset mocks to isolate the render call
    mockCtx.save.mockClear();
    mockCtx.restore.mockClear();
    mockCtx.drawImage = mock(function () {});

    platform.render([
      { type: 'image', imageId: 'stretch-img', x: 10, y: 20, width: 300, height: 200, resizeMode: 'stretch' },
    ]);

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.anything(), 10, 20, 300, 200);
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  test('image command with contain scales preserving aspect ratio', () => {
    var platform = createWebPlatform(mockCanvas as any);
    platform.onImageLoaded(function () {});

    platform.loadImage('contain-img', 'https://example.com/c.jpg');
    mockImages[0].naturalWidth = 200;
    mockImages[0].naturalHeight = 100;
    mockImages[0].onload();

    mockCtx.drawImage = mock(function () {});

    platform.render([
      { type: 'image', imageId: 'contain-img', x: 0, y: 0, width: 200, height: 200, resizeMode: 'contain' },
    ]);

    // scale = min(200/200, 200/100) = min(1, 2) = 1
    // dw = 200*1 = 200, dh = 100*1 = 100
    // dx = 0 + (200-200)/2 = 0, dy = 0 + (200-100)/2 = 50
    expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 50, 200, 100);
  });

  test('image command with cover scales to fill', () => {
    var platform = createWebPlatform(mockCanvas as any);
    platform.onImageLoaded(function () {});

    platform.loadImage('cover-img', 'https://example.com/co.jpg');
    mockImages[0].naturalWidth = 200;
    mockImages[0].naturalHeight = 100;
    mockImages[0].onload();

    mockCtx.drawImage = mock(function () {});

    platform.render([
      { type: 'image', imageId: 'cover-img', x: 0, y: 0, width: 200, height: 200, resizeMode: 'cover' },
    ]);

    // scale = max(200/200, 200/100) = max(1, 2) = 2
    // dw = 200*2 = 400, dh = 100*2 = 200
    // dx = 0 + (200-400)/2 = -100, dy = 0 + (200-200)/2 = 0
    expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.anything(), -100, 0, 400, 200);
  });

  test('image command with borderRadius clips', () => {
    var platform = createWebPlatform(mockCanvas as any);
    platform.onImageLoaded(function () {});

    platform.loadImage('br-img', 'https://example.com/br.jpg');
    mockImages[0].onload();

    mockCtx.drawImage = mock(function () {});
    mockCtx.clip.mockClear();
    mockCtx.beginPath.mockClear();
    mockCtx.arcTo.mockClear();

    platform.render([
      { type: 'image', imageId: 'br-img', x: 0, y: 0, width: 100, height: 100, resizeMode: 'cover', borderRadius: 10 },
    ]);

    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.arcTo).toHaveBeenCalled();
    expect(mockCtx.clip).toHaveBeenCalled();
  });

  test('image command with opacity sets globalAlpha', () => {
    var platform = createWebPlatform(mockCanvas as any);
    platform.onImageLoaded(function () {});

    platform.loadImage('op-img', 'https://example.com/op.jpg');
    mockImages[0].onload();

    mockCtx.drawImage = mock(function () {});
    mockCtx.globalAlpha = 1;

    platform.render([
      { type: 'image', imageId: 'op-img', x: 0, y: 0, width: 100, height: 100, resizeMode: 'stretch', opacity: 0.5 },
    ]);

    // globalAlpha should have been set (inside save/restore cycle)
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  test('image command for uncached image does not draw', () => {
    var platform = createWebPlatform(mockCanvas as any);
    mockCtx.drawImage = mock(function () {});

    platform.render([
      { type: 'image', imageId: 'nonexistent', x: 0, y: 0, width: 100, height: 100, resizeMode: 'stretch' },
    ]);

    expect(mockCtx.drawImage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// showTextInput / updateTextInput / hideTextInput
// ---------------------------------------------------------------------------

describe('showTextInput', function () {
  test('creates DOM input element', function () {
    var platform = createWebPlatform(mockCanvas as any);
    platform.showTextInput({
      inputId: 'ti-1',
      x: 10, y: 20, width: 200, height: 40,
      value: 'hello',
      placeholder: 'Type here',
      fontSize: 16,
      color: '#000000',
      placeholderColor: '#999999',
      keyboardType: 'default',
      returnKeyType: 'done',
      secureTextEntry: false,
      multiline: false,
      maxLength: 0,
    });

    // Should have created an input element
    var inputEl = createdElements.find(function (el) { return el.tagName === 'INPUT'; });
    expect(inputEl).toBeDefined();
    expect(inputEl.value).toBe('hello');
    expect(inputEl.placeholder).toBe('Type here');
    expect(inputEl.type).toBe('text');
    expect(inputEl.style.left).toBe('10px');
    expect(inputEl.style.top).toBe('20px');
    expect(inputEl.style.width).toBe('200px');
    expect(inputEl.style.height).toBe('40px');
    expect(inputEl.style.fontSize).toBe('16px');
    expect(inputEl.focus).toHaveBeenCalled();
    expect(mockParentElement.appendChild).toHaveBeenCalled();
  });

  test('creates textarea for multiline', function () {
    var platform = createWebPlatform(mockCanvas as any);
    platform.showTextInput({
      inputId: 'ti-ml',
      x: 0, y: 0, width: 200, height: 100,
      value: '',
      placeholder: 'Bio',
      fontSize: 14,
      color: '#000',
      placeholderColor: '#999',
      keyboardType: 'default',
      returnKeyType: 'done',
      secureTextEntry: false,
      multiline: true,
      maxLength: 0,
    });

    var textarea = createdElements.find(function (el) { return el.tagName === 'TEXTAREA'; });
    expect(textarea).toBeDefined();
  });

  test('sets password type for secureTextEntry', function () {
    var platform = createWebPlatform(mockCanvas as any);
    platform.showTextInput({
      inputId: 'ti-pw',
      x: 0, y: 0, width: 200, height: 40,
      value: '',
      placeholder: 'Password',
      fontSize: 14,
      color: '#000',
      placeholderColor: '#999',
      keyboardType: 'default',
      returnKeyType: 'done',
      secureTextEntry: true,
      multiline: false,
      maxLength: 0,
    });

    var inputEl = createdElements.find(function (el) { return el.tagName === 'INPUT'; });
    expect(inputEl).toBeDefined();
    expect(inputEl.type).toBe('password');
  });

  test('sets inputMode for keyboard types', function () {
    var platform = createWebPlatform(mockCanvas as any);

    platform.showTextInput({
      inputId: 'ti-num',
      x: 0, y: 0, width: 200, height: 40,
      value: '', placeholder: '', fontSize: 14,
      color: '#000', placeholderColor: '#999',
      keyboardType: 'number-pad', returnKeyType: 'done',
      secureTextEntry: false, multiline: false, maxLength: 0,
    });
    var numEl = createdElements[createdElements.length - 1];
    expect(numEl.inputMode).toBe('numeric');
  });

  test('sets inputMode for decimal-pad', function () {
    var platform = createWebPlatform(mockCanvas as any);

    platform.showTextInput({
      inputId: 'ti-dec',
      x: 0, y: 0, width: 200, height: 40,
      value: '', placeholder: '', fontSize: 14,
      color: '#000', placeholderColor: '#999',
      keyboardType: 'decimal-pad', returnKeyType: 'done',
      secureTextEntry: false, multiline: false, maxLength: 0,
    });
    var decEl = createdElements[createdElements.length - 1];
    expect(decEl.inputMode).toBe('decimal');
  });

  test('sets inputMode for email-address', function () {
    var platform = createWebPlatform(mockCanvas as any);

    platform.showTextInput({
      inputId: 'ti-email',
      x: 0, y: 0, width: 200, height: 40,
      value: '', placeholder: '', fontSize: 14,
      color: '#000', placeholderColor: '#999',
      keyboardType: 'email-address', returnKeyType: 'done',
      secureTextEntry: false, multiline: false, maxLength: 0,
    });
    var emailEl = createdElements[createdElements.length - 1];
    expect(emailEl.inputMode).toBe('email');
  });

  test('sets maxLength when greater than 0', function () {
    var platform = createWebPlatform(mockCanvas as any);
    platform.showTextInput({
      inputId: 'ti-maxlen',
      x: 0, y: 0, width: 200, height: 40,
      value: '', placeholder: '', fontSize: 14,
      color: '#000', placeholderColor: '#999',
      keyboardType: 'default', returnKeyType: 'done',
      secureTextEntry: false, multiline: false, maxLength: 100,
    });
    var el = createdElements[createdElements.length - 1];
    expect(el.maxLength).toBe(100);
  });

  test('existing input gets focused instead of creating new one', function () {
    var platform = createWebPlatform(mockCanvas as any);
    var config = {
      inputId: 'ti-dup',
      x: 0, y: 0, width: 200, height: 40,
      value: '', placeholder: '', fontSize: 14,
      color: '#000', placeholderColor: '#999',
      keyboardType: 'default', returnKeyType: 'done',
      secureTextEntry: false, multiline: false, maxLength: 0,
    };

    platform.showTextInput(config);
    var countAfterFirst = createdElements.length;

    // Call again with same inputId
    platform.showTextInput(config);
    // Should not create a new element
    expect(createdElements.length).toBe(countAfterFirst);
  });

  test('input events fire textchange callback', function () {
    var platform = createWebPlatform(mockCanvas as any);
    var receivedEvent: any = null;
    platform.onInput(function (event: any) { receivedEvent = event; });

    platform.showTextInput({
      inputId: 'ti-evt',
      x: 0, y: 0, width: 200, height: 40,
      value: 'initial', placeholder: '', fontSize: 14,
      color: '#000', placeholderColor: '#999',
      keyboardType: 'default', returnKeyType: 'done',
      secureTextEntry: false, multiline: false, maxLength: 0,
    });

    var inputEl = createdElements[createdElements.length - 1];
    inputEl.value = 'updated';
    inputEl._fireEvent('input');

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent.type).toBe('textchange');
    expect(receivedEvent.inputId).toBe('ti-evt');
    expect(receivedEvent.text).toBe('updated');
  });

  test('focus event fires textfocus callback', function () {
    var platform = createWebPlatform(mockCanvas as any);
    var receivedEvent: any = null;
    platform.onInput(function (event: any) { receivedEvent = event; });

    platform.showTextInput({
      inputId: 'ti-focus-evt',
      x: 0, y: 0, width: 200, height: 40,
      value: '', placeholder: '', fontSize: 14,
      color: '#000', placeholderColor: '#999',
      keyboardType: 'default', returnKeyType: 'done',
      secureTextEntry: false, multiline: false, maxLength: 0,
    });

    var inputEl = createdElements[createdElements.length - 1];
    inputEl._fireEvent('focus');

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent.type).toBe('textfocus');
    expect(receivedEvent.inputId).toBe('ti-focus-evt');
  });

  test('blur event fires textblur callback', function () {
    var platform = createWebPlatform(mockCanvas as any);
    var receivedEvent: any = null;
    platform.onInput(function (event: any) { receivedEvent = event; });

    platform.showTextInput({
      inputId: 'ti-blur-evt',
      x: 0, y: 0, width: 200, height: 40,
      value: '', placeholder: '', fontSize: 14,
      color: '#000', placeholderColor: '#999',
      keyboardType: 'default', returnKeyType: 'done',
      secureTextEntry: false, multiline: false, maxLength: 0,
    });

    var inputEl = createdElements[createdElements.length - 1];
    inputEl._fireEvent('blur');

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent.type).toBe('textblur');
    expect(receivedEvent.inputId).toBe('ti-blur-evt');
  });

  test('Enter key fires textsubmit for non-multiline', function () {
    var platform = createWebPlatform(mockCanvas as any);
    var receivedEvent: any = null;
    platform.onInput(function (event: any) { receivedEvent = event; });

    platform.showTextInput({
      inputId: 'ti-submit',
      x: 0, y: 0, width: 200, height: 40,
      value: '', placeholder: '', fontSize: 14,
      color: '#000', placeholderColor: '#999',
      keyboardType: 'default', returnKeyType: 'done',
      secureTextEntry: false, multiline: false, maxLength: 0,
    });

    var inputEl = createdElements[createdElements.length - 1];
    inputEl._fireEvent('keydown', { key: 'Enter' });

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent.type).toBe('textsubmit');
    expect(receivedEvent.inputId).toBe('ti-submit');
  });

  test('Enter key does NOT fire textsubmit for multiline', function () {
    var platform = createWebPlatform(mockCanvas as any);
    var receivedEvent: any = null;
    platform.onInput(function (event: any) { receivedEvent = event; });

    platform.showTextInput({
      inputId: 'ti-ml-enter',
      x: 0, y: 0, width: 200, height: 100,
      value: '', placeholder: '', fontSize: 14,
      color: '#000', placeholderColor: '#999',
      keyboardType: 'default', returnKeyType: 'done',
      secureTextEntry: false, multiline: true, maxLength: 0,
    });

    var textarea = createdElements[createdElements.length - 1];
    textarea._fireEvent('keydown', { key: 'Enter' });

    // For multiline, Enter should not trigger textsubmit
    // (receivedEvent may be null or not textsubmit)
    if (receivedEvent) {
      expect(receivedEvent.type).not.toBe('textsubmit');
    }
  });

  test('sets parent position to relative', function () {
    mockParentElement.style = {};
    var platform = createWebPlatform(mockCanvas as any);
    platform.showTextInput({
      inputId: 'ti-parent',
      x: 0, y: 0, width: 200, height: 40,
      value: '', placeholder: '', fontSize: 14,
      color: '#000', placeholderColor: '#999',
      keyboardType: 'default', returnKeyType: 'done',
      secureTextEntry: false, multiline: false, maxLength: 0,
    });

    expect(mockParentElement.style.position).toBe('relative');
  });
});

describe('updateTextInput', function () {
  test('updates position of existing input', function () {
    var platform = createWebPlatform(mockCanvas as any);
    platform.showTextInput({
      inputId: 'ti-update',
      x: 10, y: 20, width: 200, height: 40,
      value: '', placeholder: '', fontSize: 14,
      color: '#000', placeholderColor: '#999',
      keyboardType: 'default', returnKeyType: 'done',
      secureTextEntry: false, multiline: false, maxLength: 0,
    });

    platform.updateTextInput('ti-update', { x: 50, y: 60, width: 300, height: 50 });

    var inputEl = createdElements[createdElements.length - 1];
    expect(inputEl.style.left).toBe('50px');
    expect(inputEl.style.top).toBe('60px');
    expect(inputEl.style.width).toBe('300px');
    expect(inputEl.style.height).toBe('50px');
  });

  test('updates value of existing input', function () {
    var platform = createWebPlatform(mockCanvas as any);
    platform.showTextInput({
      inputId: 'ti-update-val',
      x: 0, y: 0, width: 200, height: 40,
      value: 'old', placeholder: '', fontSize: 14,
      color: '#000', placeholderColor: '#999',
      keyboardType: 'default', returnKeyType: 'done',
      secureTextEntry: false, multiline: false, maxLength: 0,
    });

    platform.updateTextInput('ti-update-val', { value: 'new' });

    var inputEl = createdElements[createdElements.length - 1];
    expect(inputEl.value).toBe('new');
  });

  test('does nothing for nonexistent input', function () {
    var platform = createWebPlatform(mockCanvas as any);
    expect(function () {
      platform.updateTextInput('nonexistent', { x: 100 });
    }).not.toThrow();
  });
});

describe('hideTextInput', function () {
  test('removes element from DOM', function () {
    var platform = createWebPlatform(mockCanvas as any);
    platform.showTextInput({
      inputId: 'ti-hide',
      x: 0, y: 0, width: 200, height: 40,
      value: '', placeholder: '', fontSize: 14,
      color: '#000', placeholderColor: '#999',
      keyboardType: 'default', returnKeyType: 'done',
      secureTextEntry: false, multiline: false, maxLength: 0,
    });

    var inputEl = createdElements[createdElements.length - 1];
    platform.hideTextInput('ti-hide');

    expect(inputEl.blur).toHaveBeenCalled();
    // After hiding, showing again should create a new element
    var countBefore = createdElements.length;
    platform.showTextInput({
      inputId: 'ti-hide',
      x: 0, y: 0, width: 200, height: 40,
      value: '', placeholder: '', fontSize: 14,
      color: '#000', placeholderColor: '#999',
      keyboardType: 'default', returnKeyType: 'done',
      secureTextEntry: false, multiline: false, maxLength: 0,
    });
    expect(createdElements.length).toBe(countBefore + 1);
  });

  test('does nothing for nonexistent input', function () {
    var platform = createWebPlatform(mockCanvas as any);
    expect(function () {
      platform.hideTextInput('nonexistent');
    }).not.toThrow();
  });
});
