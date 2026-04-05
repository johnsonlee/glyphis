import { describe, it, expect, beforeEach } from 'bun:test';
import { generateNodeRenderCommands } from '../src/react/render-commands';
import { GlyphisNode, HOST_TYPES } from '../src/react/glyphis-node';
import { setDebugMode } from '../src/render-tree';
import type { LayoutOutput } from '../src/layout';
import type { AnyRenderCommand, RectCommand, TextCommand, BorderCommand, ImageCommand, ClipCommand, OpacityCommand } from '../src/types';

function createLayoutMap(entries: [GlyphisNode, LayoutOutput][]): Map<GlyphisNode, LayoutOutput> {
  return new Map(entries);
}

describe('generateNodeRenderCommands', () => {
  beforeEach(() => {
    setDebugMode(false);
  });
  it('node with backgroundColor produces rect command', () => {
    const node = new GlyphisNode('glyphis-view', { style: { backgroundColor: '#FF0000' } });
    const layout: LayoutOutput = { x: 10, y: 20, width: 100, height: 50, children: [] };
    const layoutMap = createLayoutMap([[node, layout]]);

    const commands = generateNodeRenderCommands(node, layoutMap);
    const rects = commands.filter(c => c.type === 'rect') as RectCommand[];
    expect(rects.length).toBe(1);
    expect(rects[0].color).toBe('#FF0000');
    expect(rects[0].x).toBe(10);
    expect(rects[0].y).toBe(20);
    expect(rects[0].width).toBe(100);
    expect(rects[0].height).toBe(50);
  });

  it('node with borderWidth produces border command', () => {
    const node = new GlyphisNode('glyphis-view', {
      style: { borderWidth: 2, borderColor: '#000000' },
    });
    const layout: LayoutOutput = { x: 0, y: 0, width: 100, height: 50, children: [] };
    const layoutMap = createLayoutMap([[node, layout]]);

    const commands = generateNodeRenderCommands(node, layoutMap);
    const borders = commands.filter(c => c.type === 'border') as BorderCommand[];
    expect(borders.length).toBe(1);
    expect(borders[0].widths).toEqual([2, 2, 2, 2]);
    expect(borders[0].colors).toEqual(['#000000', '#000000', '#000000', '#000000']);
  });

  it('text leaf produces text command with parent style inheritance', () => {
    const parent = new GlyphisNode(HOST_TYPES.TEXT, {
      style: { color: '#333333', fontSize: 18, fontWeight: 'bold' },
    });
    const leaf = new GlyphisNode(HOST_TYPES.TEXT_LEAF, {}, 'Hello');
    parent.appendChild(leaf);

    const parentLayout: LayoutOutput = {
      x: 10, y: 10, width: 200, height: 30,
      children: [{ x: 0, y: 0, width: 200, height: 30, children: [] }],
    };
    const layoutMap = createLayoutMap([
      [parent, parentLayout],
      [leaf, parentLayout.children[0]],
    ]);

    const commands = generateNodeRenderCommands(parent, layoutMap);
    const texts = commands.filter(c => c.type === 'text') as TextCommand[];
    expect(texts.length).toBe(1);
    expect(texts[0].text).toBe('Hello');
    expect(texts[0].color).toBe('#333333');
    expect(texts[0].fontSize).toBe(18);
    expect(texts[0].fontWeight).toBe('bold');
    expect(texts[0].x).toBe(10);
    expect(texts[0].y).toBe(10);
  });

  it('text leaf uses default styles when parent has none', () => {
    const parent = new GlyphisNode(HOST_TYPES.TEXT, { style: {} });
    const leaf = new GlyphisNode(HOST_TYPES.TEXT_LEAF, {}, 'Default');
    parent.appendChild(leaf);

    const parentLayout: LayoutOutput = {
      x: 0, y: 0, width: 100, height: 20,
      children: [{ x: 0, y: 0, width: 100, height: 20, children: [] }],
    };
    const layoutMap = createLayoutMap([
      [parent, parentLayout],
      [leaf, parentLayout.children[0]],
    ]);

    const commands = generateNodeRenderCommands(parent, layoutMap);
    const texts = commands.filter(c => c.type === 'text') as TextCommand[];
    expect(texts[0].color).toBe('#000000');
    expect(texts[0].fontSize).toBe(14);
    expect(texts[0].fontWeight).toBe('normal');
    expect(texts[0].fontFamily).toBe('system-ui');
    expect(texts[0].textAlign).toBe('left');
  });

  it('opacity wraps commands', () => {
    const node = new GlyphisNode('glyphis-view', {
      style: { opacity: 0.5, backgroundColor: 'blue' },
    });
    const layout: LayoutOutput = { x: 0, y: 0, width: 100, height: 50, children: [] };
    const layoutMap = createLayoutMap([[node, layout]]);

    const commands = generateNodeRenderCommands(node, layoutMap);
    expect(commands[0].type).toBe('opacity');
    expect((commands[0] as OpacityCommand).opacity).toBe(0.5);
    expect(commands[commands.length - 1].type).toBe('restoreOpacity');
  });

  it('overflow hidden wraps in clip/restore', () => {
    const node = new GlyphisNode('glyphis-view', {
      style: { overflow: 'hidden', backgroundColor: '#000' },
    });
    const layout: LayoutOutput = { x: 5, y: 10, width: 100, height: 50, children: [] };
    const layoutMap = createLayoutMap([[node, layout]]);

    const commands = generateNodeRenderCommands(node, layoutMap);
    const clipIdx = commands.findIndex(c => c.type === 'clip');
    const restoreIdx = commands.findIndex(c => c.type === 'restore');
    expect(clipIdx).toBeGreaterThanOrEqual(0);
    expect(restoreIdx).toBeGreaterThan(clipIdx);

    const clip = commands[clipIdx] as ClipCommand;
    expect(clip.x).toBe(5);
    expect(clip.y).toBe(10);
    expect(clip.width).toBe(100);
    expect(clip.height).toBe(50);
  });

  it('overflow scroll also wraps in clip/restore', () => {
    const node = new GlyphisNode('glyphis-view', { style: { overflow: 'scroll' } });
    const layout: LayoutOutput = { x: 0, y: 0, width: 100, height: 50, children: [] };
    const layoutMap = createLayoutMap([[node, layout]]);

    const commands = generateNodeRenderCommands(node, layoutMap);
    expect(commands.some(c => c.type === 'clip')).toBe(true);
    expect(commands.some(c => c.type === 'restore')).toBe(true);
  });

  it('image node produces image command', () => {
    const node = new GlyphisNode(HOST_TYPES.IMAGE, {
      src: 'https://example.com/img.png',
      style: { borderRadius: 8 },
    });
    const layout: LayoutOutput = { x: 0, y: 0, width: 200, height: 150, children: [] };
    const layoutMap = createLayoutMap([[node, layout]]);

    const commands = generateNodeRenderCommands(node, layoutMap);
    const images = commands.filter(c => c.type === 'image') as ImageCommand[];
    expect(images.length).toBe(1);
    expect(images[0].src).toBe('https://example.com/img.png');
    expect(images[0].width).toBe(200);
    expect(images[0].height).toBe(150);
    expect(images[0].borderRadius).toBe(8);
  });

  it('nested nodes produce commands in correct order', () => {
    const parent = new GlyphisNode('glyphis-view', { style: { backgroundColor: 'red' } });
    const child = new GlyphisNode('glyphis-view', { style: { backgroundColor: 'blue' } });
    parent.appendChild(child);

    const parentLayout: LayoutOutput = {
      x: 0, y: 0, width: 200, height: 200,
      children: [{ x: 10, y: 10, width: 50, height: 50, children: [] }],
    };
    const layoutMap = createLayoutMap([
      [parent, parentLayout],
      [child, parentLayout.children[0]],
    ]);

    const commands = generateNodeRenderCommands(parent, layoutMap);
    const rects = commands.filter(c => c.type === 'rect') as RectCommand[];
    expect(rects.length).toBe(2);
    // Parent first, then child
    expect(rects[0].color).toBe('red');
    expect(rects[1].color).toBe('blue');
    // Child position is offset by parent
    expect(rects[1].x).toBe(10);
    expect(rects[1].y).toBe(10);
  });

  it('node without layout is skipped', () => {
    const node = new GlyphisNode('glyphis-view', { style: { backgroundColor: 'red' } });
    const layoutMap = new Map<GlyphisNode, LayoutOutput>();

    const commands = generateNodeRenderCommands(node, layoutMap);
    expect(commands).toEqual([]);
  });

  it('opacity 1 does not produce opacity commands', () => {
    const node = new GlyphisNode('glyphis-view', { style: { opacity: 1 } });
    const layout: LayoutOutput = { x: 0, y: 0, width: 100, height: 50, children: [] };
    const layoutMap = createLayoutMap([[node, layout]]);

    const commands = generateNodeRenderCommands(node, layoutMap);
    expect(commands.some(c => c.type === 'opacity')).toBe(false);
  });

  it('node without visual props produces no rect/text/image commands', () => {
    const node = new GlyphisNode('glyphis-view', { style: {} });
    const layout: LayoutOutput = { x: 0, y: 0, width: 100, height: 50, children: [] };
    const layoutMap = createLayoutMap([[node, layout]]);

    const commands = generateNodeRenderCommands(node, layoutMap);
    expect(commands.filter(c => c.type === 'rect').length).toBe(0);
    expect(commands.filter(c => c.type === 'text').length).toBe(0);
    expect(commands.filter(c => c.type === 'image').length).toBe(0);
  });
});
