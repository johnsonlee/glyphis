import { describe, it, expect, beforeEach } from 'bun:test';
import { generateRenderCommands, setDebugMode, isDebugMode, DEBUG_COLORS } from '../src/render-tree';
import type { Fiber } from '../src/types';
import type { LayoutOutput } from '../src/layout';

function createFiber(overrides: Partial<Fiber> = {}): Fiber {
  return {
    tag: 'host',
    type: 'View',
    props: {},
    key: null,
    parent: null,
    child: null,
    sibling: null,
    alternate: null,
    stateNode: null,
    effects: [],
    hooks: [],
    hookIndex: 0,
    ...overrides,
  };
}

function createLayout(x: number, y: number, width: number, height: number): LayoutOutput {
  return { x, y, width, height, children: [] };
}

describe('generateRenderCommands', () => {
  it('returns empty array for fiber with no layout', () => {
    const fiber = createFiber();
    const layoutMap = new Map<Fiber, LayoutOutput>();

    const commands = generateRenderCommands(fiber, layoutMap);
    expect(commands).toEqual([]);
  });

  it('returns empty array for fiber with no styles', () => {
    const fiber = createFiber();
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 100, 100));

    const commands = generateRenderCommands(fiber, layoutMap);
    expect(commands).toEqual([]);
  });

  it('produces rect command for fiber with backgroundColor', () => {
    const fiber = createFiber({
      props: { style: { backgroundColor: '#ff0000' } },
    });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(10, 20, 100, 50));

    const commands = generateRenderCommands(fiber, layoutMap);
    expect(commands.length).toBe(1);
    expect(commands[0].type).toBe('rect');

    const rect = commands[0] as any;
    expect(rect.x).toBe(10);
    expect(rect.y).toBe(20);
    expect(rect.width).toBe(100);
    expect(rect.height).toBe(50);
    expect(rect.color).toBe('#ff0000');
    expect(rect.borderRadius).toEqual([0, 0, 0, 0]);
  });

  it('produces rect command with border radius', () => {
    const fiber = createFiber({
      props: { style: { backgroundColor: 'blue', borderRadius: 8 } },
    });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 50, 50));

    const commands = generateRenderCommands(fiber, layoutMap);
    expect(commands.length).toBe(1);
    const rect = commands[0] as any;
    expect(rect.borderRadius).toEqual([8, 8, 8, 8]);
  });

  it('produces border command for fiber with border', () => {
    const fiber = createFiber({
      props: { style: { borderWidth: 2, borderColor: 'black' } },
    });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 100, 100));

    const commands = generateRenderCommands(fiber, layoutMap);
    expect(commands.length).toBe(1);
    expect(commands[0].type).toBe('border');

    const border = commands[0] as any;
    expect(border.widths).toEqual([2, 2, 2, 2]);
    expect(border.colors).toEqual(['black', 'black', 'black', 'black']);
  });

  it('produces border command with per-side widths', () => {
    const fiber = createFiber({
      props: {
        style: {
          borderTopWidth: 1,
          borderRightWidth: 2,
          borderBottomWidth: 3,
          borderLeftWidth: 4,
          borderColor: 'red',
        },
      },
    });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 100, 100));

    const commands = generateRenderCommands(fiber, layoutMap);
    const border = commands[0] as any;
    expect(border.widths).toEqual([1, 2, 3, 4]);
  });

  it('does not produce border command when all widths are zero', () => {
    const fiber = createFiber({
      props: { style: { borderColor: 'red' } },
    });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 100, 100));

    const commands = generateRenderCommands(fiber, layoutMap);
    expect(commands.length).toBe(0);
  });

  it('wraps commands in opacity/restoreOpacity for opacity < 1', () => {
    const fiber = createFiber({
      props: { style: { backgroundColor: 'red', opacity: 0.5 } },
    });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 100, 100));

    const commands = generateRenderCommands(fiber, layoutMap);
    expect(commands.length).toBe(3);
    expect(commands[0].type).toBe('opacity');
    expect((commands[0] as any).opacity).toBe(0.5);
    expect(commands[1].type).toBe('rect');
    expect(commands[2].type).toBe('restoreOpacity');
  });

  it('does not wrap in opacity when opacity is 1', () => {
    const fiber = createFiber({
      props: { style: { backgroundColor: 'red', opacity: 1 } },
    });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 100, 100));

    const commands = generateRenderCommands(fiber, layoutMap);
    expect(commands.every(c => c.type !== 'opacity')).toBe(true);
    expect(commands.every(c => c.type !== 'restoreOpacity')).toBe(true);
  });

  it('wraps commands in clip/restore for overflow: hidden', () => {
    const fiber = createFiber({
      props: { style: { backgroundColor: 'blue', overflow: 'hidden' } },
    });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(5, 10, 200, 300));

    const commands = generateRenderCommands(fiber, layoutMap);
    expect(commands.length).toBe(3);
    expect(commands[0].type).toBe('clip');
    expect((commands[0] as any).x).toBe(5);
    expect((commands[0] as any).y).toBe(10);
    expect(commands[1].type).toBe('rect');
    expect(commands[2].type).toBe('restore');
  });

  it('wraps commands in clip/restore for overflow: scroll', () => {
    const fiber = createFiber({
      props: { style: { backgroundColor: 'blue', overflow: 'scroll' } },
    });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 200, 300));

    const commands = generateRenderCommands(fiber, layoutMap);
    expect(commands[0].type).toBe('clip');
    expect(commands[commands.length - 1].type).toBe('restore');
  });

  it('does not clip for overflow: visible', () => {
    const fiber = createFiber({
      props: { style: { backgroundColor: 'blue', overflow: 'visible' } },
    });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 200, 300));

    const commands = generateRenderCommands(fiber, layoutMap);
    expect(commands.every(c => c.type !== 'clip')).toBe(true);
    expect(commands.every(c => c.type !== 'restore')).toBe(true);
  });

  it('produces text command for text fiber', () => {
    const parent = createFiber({
      props: { style: { color: 'red', fontSize: 18, fontWeight: 'bold' as const, fontFamily: 'Helvetica', textAlign: 'center' as const, lineHeight: 24 } },
    });
    const textFiber = createFiber({
      tag: 'text',
      type: 'text',
      parent,
      props: { nodeValue: 'Hello World' },
    });
    parent.child = textFiber;

    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(parent, createLayout(0, 0, 200, 50));
    layoutMap.set(textFiber, createLayout(0, 0, 200, 24));

    const commands = generateRenderCommands(parent, layoutMap);
    const textCmd = commands.find(c => c.type === 'text') as any;
    expect(textCmd).toBeDefined();
    expect(textCmd.text).toBe('Hello World');
    expect(textCmd.color).toBe('red');
    expect(textCmd.fontSize).toBe(18);
    expect(textCmd.fontWeight).toBe('bold');
    expect(textCmd.fontFamily).toBe('Helvetica');
    expect(textCmd.textAlign).toBe('center');
    expect(textCmd.lineHeight).toBe(24);
  });

  it('uses default text styles when parent has no style', () => {
    const parent = createFiber({ props: {} });
    const textFiber = createFiber({
      tag: 'text',
      type: 'text',
      parent,
      props: { nodeValue: 'Default' },
    });
    parent.child = textFiber;

    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(parent, createLayout(0, 0, 200, 50));
    layoutMap.set(textFiber, createLayout(0, 0, 200, 14));

    const commands = generateRenderCommands(parent, layoutMap);
    const textCmd = commands.find(c => c.type === 'text') as any;
    expect(textCmd).toBeDefined();
    expect(textCmd.color).toBe('#000000');
    expect(textCmd.fontSize).toBe(14);
    expect(textCmd.fontWeight).toBe('normal');
    expect(textCmd.fontFamily).toBe('system-ui');
    expect(textCmd.textAlign).toBe('left');
    expect(textCmd.lineHeight).toBeUndefined();
  });

  it('does not produce text command for non-text fibers', () => {
    const fiber = createFiber({
      tag: 'host',
      props: { nodeValue: 'Should not appear' },
    });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 100, 100));

    const commands = generateRenderCommands(fiber, layoutMap);
    expect(commands.every(c => c.type !== 'text')).toBe(true);
  });

  it('produces image command for Image fiber', () => {
    const fiber = createFiber({
      type: 'Image',
      props: { src: 'photo.png', style: { borderRadius: 10 } },
    });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 200, 150));

    const commands = generateRenderCommands(fiber, layoutMap);
    const imgCmd = commands.find(c => c.type === 'image') as any;
    expect(imgCmd).toBeDefined();
    expect(imgCmd.src).toBe('photo.png');
    expect(imgCmd.width).toBe(200);
    expect(imgCmd.height).toBe(150);
    expect(imgCmd.borderRadius).toBe(10);
  });

  it('does not produce image command without src', () => {
    const fiber = createFiber({ type: 'Image', props: {} });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 200, 150));

    const commands = generateRenderCommands(fiber, layoutMap);
    expect(commands.every(c => c.type !== 'image')).toBe(true);
  });

  it('produces commands in correct order: parent before children', () => {
    const child = createFiber({
      type: 'Child',
      props: { style: { backgroundColor: 'green' } },
    });
    const parent = createFiber({
      type: 'Parent',
      child,
      props: { style: { backgroundColor: 'red' } },
    });
    child.parent = parent;

    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(parent, createLayout(0, 0, 200, 200));
    layoutMap.set(child, createLayout(10, 10, 80, 80));

    const commands = generateRenderCommands(parent, layoutMap);
    expect(commands.length).toBe(2);
    expect(commands[0].type).toBe('rect');
    expect((commands[0] as any).color).toBe('red');
    expect(commands[1].type).toBe('rect');
    expect((commands[1] as any).color).toBe('green');
  });

  it('offsets child positions relative to parent', () => {
    const child = createFiber({
      type: 'Child',
      props: { style: { backgroundColor: 'green' } },
    });
    const parent = createFiber({
      type: 'Parent',
      child,
      props: {},
    });
    child.parent = parent;

    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(parent, createLayout(50, 100, 200, 200));
    layoutMap.set(child, createLayout(10, 20, 80, 80));

    const commands = generateRenderCommands(parent, layoutMap);
    const childRect = commands[0] as any;
    expect(childRect.x).toBe(60); // 50 + 10
    expect(childRect.y).toBe(120); // 100 + 20
  });

  it('handles siblings correctly', () => {
    const child1 = createFiber({
      type: 'Child1',
      props: { style: { backgroundColor: 'red' } },
    });
    const child2 = createFiber({
      type: 'Child2',
      props: { style: { backgroundColor: 'blue' } },
    });
    child1.sibling = child2;

    const parent = createFiber({ type: 'Parent', child: child1, props: {} });
    child1.parent = parent;
    child2.parent = parent;

    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(parent, createLayout(0, 0, 200, 200));
    layoutMap.set(child1, createLayout(0, 0, 100, 100));
    layoutMap.set(child2, createLayout(100, 0, 100, 100));

    const commands = generateRenderCommands(parent, layoutMap);
    expect(commands.length).toBe(2);
    expect((commands[0] as any).color).toBe('red');
    expect((commands[1] as any).color).toBe('blue');
  });

  it('handles complex nested tree with multiple styles', () => {
    const grandchild = createFiber({
      type: 'Grandchild',
      props: { style: { backgroundColor: 'yellow' } },
    });
    const child = createFiber({
      type: 'Child',
      child: grandchild,
      props: { style: { backgroundColor: 'green', opacity: 0.8 } },
    });
    grandchild.parent = child;

    const parent = createFiber({
      type: 'Parent',
      child,
      props: {
        style: {
          backgroundColor: 'red',
          borderWidth: 1,
          borderColor: 'black',
          overflow: 'hidden' as const,
        },
      },
    });
    child.parent = parent;

    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(parent, createLayout(0, 0, 300, 300));
    layoutMap.set(child, createLayout(10, 10, 280, 280));
    layoutMap.set(grandchild, createLayout(5, 5, 50, 50));

    const commands = generateRenderCommands(parent, layoutMap);

    // Expected order:
    // clip (overflow hidden)
    // rect (parent bg)
    // border (parent border)
    // opacity (child opacity)
    // rect (child bg)
    // rect (grandchild bg)
    // restoreOpacity
    // restore (clip)

    const types = commands.map(c => c.type);
    expect(types[0]).toBe('clip');
    expect(types[1]).toBe('rect'); // parent bg
    expect(types[2]).toBe('border'); // parent border
    expect(types[3]).toBe('opacity'); // child opacity
    expect(types[4]).toBe('rect'); // child bg
    expect(types[5]).toBe('rect'); // grandchild bg
    expect(types[6]).toBe('restoreOpacity');
    expect(types[7]).toBe('restore');
  });

  it('handles opacity 0 as less than 1', () => {
    const fiber = createFiber({
      props: { style: { backgroundColor: 'red', opacity: 0 } },
    });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 100, 100));

    const commands = generateRenderCommands(fiber, layoutMap);
    expect(commands[0].type).toBe('opacity');
    expect((commands[0] as any).opacity).toBe(0);
  });

  it('skips children without layout entries', () => {
    const child = createFiber({ type: 'Child', props: { style: { backgroundColor: 'green' } } });
    const parent = createFiber({
      type: 'Parent',
      child,
      props: { style: { backgroundColor: 'red' } },
    });
    child.parent = parent;

    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(parent, createLayout(0, 0, 200, 200));
    // No layout for child

    const commands = generateRenderCommands(parent, layoutMap);
    expect(commands.length).toBe(1); // Only parent's rect
    expect((commands[0] as any).color).toBe('red');
  });
});

describe('debug mode', () => {
  beforeEach(() => {
    setDebugMode(false);
  });

  it('setDebugMode and isDebugMode toggle correctly', () => {
    expect(isDebugMode()).toBe(false);
    setDebugMode(true);
    expect(isDebugMode()).toBe(true);
    setDebugMode(false);
    expect(isDebugMode()).toBe(false);
  });

  it('does not produce debug borders when debug mode is off', () => {
    setDebugMode(false);
    const fiber = createFiber({ props: {} });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 100, 100));

    const commands = generateRenderCommands(fiber, layoutMap);
    const borderCommands = commands.filter(c => c.type === 'border');
    expect(borderCommands.length).toBe(0);
  });

  it('produces debug border commands for each layout node when debug mode is on', () => {
    setDebugMode(true);

    const child = createFiber({ type: 'Child', props: {} });
    const parent = createFiber({ type: 'Parent', child, props: {} });
    child.parent = parent;

    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(parent, createLayout(0, 0, 200, 200));
    layoutMap.set(child, createLayout(10, 10, 80, 80));

    const commands = generateRenderCommands(parent, layoutMap);
    const borderCommands = commands.filter(c => c.type === 'border');
    // One debug border for parent, one for child
    expect(borderCommands.length).toBe(2);

    // All debug borders should have width 1 on all sides
    for (const cmd of borderCommands) {
      expect((cmd as any).widths).toEqual([1, 1, 1, 1]);
    }
  });

  it('cycles debug colors by depth', () => {
    setDebugMode(true);

    const grandchild = createFiber({ type: 'Grandchild', props: {} });
    const child = createFiber({ type: 'Child', child: grandchild, props: {} });
    grandchild.parent = child;
    const parent = createFiber({ type: 'Parent', child, props: {} });
    child.parent = parent;

    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(parent, createLayout(0, 0, 300, 300));
    layoutMap.set(child, createLayout(10, 10, 200, 200));
    layoutMap.set(grandchild, createLayout(5, 5, 100, 100));

    const commands = generateRenderCommands(parent, layoutMap);
    const borderCommands = commands.filter(c => c.type === 'border');
    expect(borderCommands.length).toBe(3);

    // Depth 0 -> DEBUG_COLORS[0], Depth 1 -> DEBUG_COLORS[1], Depth 2 -> DEBUG_COLORS[2]
    const parentBorder = borderCommands[0] as any;
    const childBorder = borderCommands[1] as any;
    const grandchildBorder = borderCommands[2] as any;

    expect(parentBorder.colors).toEqual([DEBUG_COLORS[0], DEBUG_COLORS[0], DEBUG_COLORS[0], DEBUG_COLORS[0]]);
    expect(childBorder.colors).toEqual([DEBUG_COLORS[1], DEBUG_COLORS[1], DEBUG_COLORS[1], DEBUG_COLORS[1]]);
    expect(grandchildBorder.colors).toEqual([DEBUG_COLORS[2], DEBUG_COLORS[2], DEBUG_COLORS[2], DEBUG_COLORS[2]]);
  });

  it('does not add debug borders for fibers without layout', () => {
    setDebugMode(true);

    const child = createFiber({ type: 'Child', props: {} });
    const parent = createFiber({ type: 'Parent', child, props: {} });
    child.parent = parent;

    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(parent, createLayout(0, 0, 200, 200));
    // No layout for child

    const commands = generateRenderCommands(parent, layoutMap);
    const borderCommands = commands.filter(c => c.type === 'border');
    // Only one debug border for parent (child has no layout)
    expect(borderCommands.length).toBe(1);
  });
});
