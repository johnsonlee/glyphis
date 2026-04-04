import { describe, it, expect } from 'bun:test';
import { batchCommands, countDrawCalls } from '../src/renderers/command-batcher';
import type { AnyRenderCommand } from '../src/types';

describe('command batcher', () => {
  it('passes through non-rect commands unchanged', () => {
    const cmds: AnyRenderCommand[] = [
      { type: 'text', x: 0, y: 0, width: 100, text: 'hi', color: '#000', fontSize: 14, fontWeight: 'normal', fontFamily: 'sans', textAlign: 'left' },
      { type: 'clip', x: 0, y: 0, width: 100, height: 100 },
      { type: 'restore' },
    ];
    const result = batchCommands(cmds);
    expect(result).toEqual(cmds);
  });

  it('preserves rect commands', () => {
    const cmds: AnyRenderCommand[] = [
      { type: 'rect', x: 0, y: 0, width: 100, height: 50, color: '#ff0000' },
      { type: 'rect', x: 0, y: 50, width: 100, height: 50, color: '#ff0000' },
    ];
    const result = batchCommands(cmds);
    expect(result.length).toBe(2);
  });

  it('does not merge rects with different colors', () => {
    const cmds: AnyRenderCommand[] = [
      { type: 'rect', x: 0, y: 0, width: 100, height: 50, color: '#ff0000' },
      { type: 'rect', x: 0, y: 50, width: 100, height: 50, color: '#00ff00' },
    ];
    const result = batchCommands(cmds);
    expect(result.length).toBe(2);
  });

  it('does not merge rects with border radius', () => {
    const cmds: AnyRenderCommand[] = [
      { type: 'rect', x: 0, y: 0, width: 100, height: 50, color: '#ff0000', borderRadius: 10 },
      { type: 'rect', x: 0, y: 50, width: 100, height: 50, color: '#ff0000' },
    ];
    const result = batchCommands(cmds);
    expect(result.length).toBe(2);
  });

  it('handles empty commands', () => {
    expect(batchCommands([])).toEqual([]);
  });

  it('handles mixed commands', () => {
    const cmds: AnyRenderCommand[] = [
      { type: 'rect', x: 0, y: 0, width: 100, height: 50, color: '#ff0000' },
      { type: 'text', x: 0, y: 0, width: 100, text: 'hi', color: '#000', fontSize: 14, fontWeight: 'normal', fontFamily: 'sans', textAlign: 'left' },
      { type: 'rect', x: 0, y: 50, width: 100, height: 50, color: '#ff0000' },
    ];
    const result = batchCommands(cmds);
    expect(result.length).toBe(3);
  });
});

describe('countDrawCalls', () => {
  it('counts rect, text, image, border as draw calls', () => {
    const cmds: AnyRenderCommand[] = [
      { type: 'rect', x: 0, y: 0, width: 100, height: 50, color: '#ff0000' },
      { type: 'text', x: 0, y: 0, width: 100, text: 'hi', color: '#000', fontSize: 14, fontWeight: 'normal', fontFamily: 'sans', textAlign: 'left' },
      { type: 'clip', x: 0, y: 0, width: 100, height: 100 },
      { type: 'image', x: 0, y: 0, width: 100, height: 100, src: 'test.png' },
      { type: 'restore' },
      { type: 'border', x: 0, y: 0, width: 100, height: 100, widths: [1, 1, 1, 1], colors: ['#000', '#000', '#000', '#000'] },
    ];
    expect(countDrawCalls(cmds)).toBe(4);
  });

  it('returns 0 for empty commands', () => {
    expect(countDrawCalls([])).toBe(0);
  });

  it('returns 0 for only state commands', () => {
    const cmds: AnyRenderCommand[] = [
      { type: 'clip', x: 0, y: 0, width: 100, height: 100 },
      { type: 'restore' },
      { type: 'opacity', opacity: 0.5 },
      { type: 'restoreOpacity' },
    ];
    expect(countDrawCalls(cmds)).toBe(0);
  });
});
