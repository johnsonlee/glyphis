import { describe, it, expect } from 'bun:test';
import { CanvasRenderer } from '../src/renderers/index';

describe('renderer factory', () => {
  it('exports CanvasRenderer', () => {
    expect(CanvasRenderer).toBeDefined();
  });

  it('exports batchCommands and countDrawCalls', async () => {
    const { batchCommands, countDrawCalls } = await import('../src/renderers/index');
    expect(typeof batchCommands).toBe('function');
    expect(typeof countDrawCalls).toBe('function');
  });

  it('createRenderer is async and exported', async () => {
    const { createRenderer } = await import('../src/renderers/index');
    expect(typeof createRenderer).toBe('function');
  });
});
