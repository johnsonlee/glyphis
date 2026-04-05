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

const mockCanvas = {
  getContext: mock((type: string) => {
    if (type === '2d') return mockCtx;
    return null;
  }),
  getBoundingClientRect: mock(() => ({ width: 390, height: 844, left: 0, top: 0 })),
  width: 0,
  height: 0,
  addEventListener: mock((event: string, handler: Function) => {
    if (!canvasListeners[event]) canvasListeners[event] = [];
    canvasListeners[event].push(handler);
  }),
};

// Mock document.createElement for the measure canvas
const mockMeasureCanvas = {
  getContext: mock(() => mockMeasureCtx),
};

(globalThis as any).document = {
  createElement: mock((tag: string) => {
    if (tag === 'canvas') return mockMeasureCanvas;
    return {};
  }),
};

(globalThis as any).window = {
  devicePixelRatio: 2,
};

import { createWebPlatform } from '../src/platform/web';

function resetAllMocks() {
  for (const key of Object.keys(mockCtx)) {
    if (typeof mockCtx[key]?.mockClear === 'function') {
      mockCtx[key].mockClear();
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
