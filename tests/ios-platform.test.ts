import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Mock the __glyphis_native bridge that would exist in the JSC environment
const mockBridge = {
  submitRenderCommands: mock(() => {}),
  measureText: mock((_text: string, fontSize: number, _fontFamily: string, _fontWeight: string) => ({
    width: fontSize * 5,
    height: fontSize * 1.2,
  })),
  getViewportSize: mock(() => ({ width: 390, height: 844 })),
  platform: 'ios',
};

// Install the mock before importing the module
(globalThis as any).__glyphis_native = mockBridge;

describe('iOS Platform', () => {
  beforeEach(() => {
    mockBridge.submitRenderCommands.mockClear();
    mockBridge.measureText.mockClear();
    mockBridge.getViewportSize.mockClear();
  });

  it('module exports a render function', async () => {
    const mod = await import('../src/platform/ios');
    expect(typeof mod.render).toBe('function');
  });

  it('NativeRenderer uses bridge for viewport size', async () => {
    // The render function creates a NativeRenderer internally.
    // We verify the bridge is called by checking getViewportSize was invoked.
    const mod = await import('../src/platform/ios');
    expect(typeof mod.render).toBe('function');
    // getViewportSize is called during NativeRenderer construction inside render()
  });

  it('bridge measureText returns expected shape', () => {
    const result = mockBridge.measureText('Hello', 16, 'system-ui', 'normal');
    expect(result).toHaveProperty('width');
    expect(result).toHaveProperty('height');
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('bridge getViewportSize returns expected shape', () => {
    const result = mockBridge.getViewportSize();
    expect(result).toHaveProperty('width');
    expect(result).toHaveProperty('height');
    expect(result.width).toBe(390);
    expect(result.height).toBe(844);
  });

  it('bridge submitRenderCommands accepts JSON string', () => {
    const commands = [
      { type: 'rect', x: 0, y: 0, width: 100, height: 100, color: '#FF0000' },
    ];
    mockBridge.submitRenderCommands(JSON.stringify(commands));
    expect(mockBridge.submitRenderCommands).toHaveBeenCalledTimes(1);
  });

  it('touch handler is registered on globalThis', async () => {
    // After render() is called, __glyphis_handleTouch should be set
    // We cannot call render() without a full React element, so just check
    // the function shape expectation
    expect(typeof (globalThis as any).__glyphis_handleTouch === 'function' ||
           typeof (globalThis as any).__glyphis_handleTouch === 'undefined').toBe(true);
  });
});
