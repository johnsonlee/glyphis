import { describe, it, expect, afterEach } from 'bun:test';
import {
  createLayoutEngine,
  setDefaultLayoutEngine,
  getDefaultLayoutEngine,
  GlyphLayoutEngine,
  YogaLayoutEngine,
} from '../src/layout/index';
import type { LayoutInput } from '../src/layout';
import type { Style } from '../src/types';

function node(style: Style, children: LayoutInput[] = []): LayoutInput {
  return { style, children };
}

describe('layout engine factory', () => {
  afterEach(() => {
    // Reset default to yoga
    setDefaultLayoutEngine('yoga');
  });

  it('should create YogaLayoutEngine by default', () => {
    const engine = createLayoutEngine();
    expect(engine).toBeInstanceOf(YogaLayoutEngine);
  });

  it('should create YogaLayoutEngine when explicitly requested', () => {
    const engine = createLayoutEngine('yoga');
    expect(engine).toBeInstanceOf(YogaLayoutEngine);
  });

  it('should create GlyphLayoutEngine when explicitly requested', () => {
    const engine = createLayoutEngine('glyph');
    expect(engine).toBeInstanceOf(GlyphLayoutEngine);
  });

  it('should respect setDefaultLayoutEngine', () => {
    setDefaultLayoutEngine('glyph');
    expect(getDefaultLayoutEngine()).toBe('glyph');
    const engine = createLayoutEngine();
    expect(engine).toBeInstanceOf(GlyphLayoutEngine);
  });

  it('should override default with explicit type', () => {
    setDefaultLayoutEngine('glyph');
    const engine = createLayoutEngine('yoga');
    expect(engine).toBeInstanceOf(YogaLayoutEngine);
  });

  describe('both engines produce reasonable results', () => {
    it('should compute basic layout with fixed dimensions', () => {
      const input = node({ width: 200, height: 100 });

      const yogaEngine = createLayoutEngine('yoga');
      const glyphEngine = createLayoutEngine('glyph');

      const yogaResult = yogaEngine.computeLayout(input, 400, 400);
      const glyphResult = glyphEngine.computeLayout(input, 400, 400);

      expect(yogaResult.width).toBe(200);
      expect(yogaResult.height).toBe(100);
      expect(glyphResult.width).toBe(200);
      expect(glyphResult.height).toBe(100);
    });

    it('should compute layout with children', () => {
      const input = node({ width: 400, height: 200 }, [
        node({ width: 100, height: 50 }),
        node({ width: 100, height: 50 }),
      ]);

      const yogaEngine = createLayoutEngine('yoga');
      const glyphEngine = createLayoutEngine('glyph');

      const yogaResult = yogaEngine.computeLayout(input, 400, 400);
      const glyphResult = glyphEngine.computeLayout(input, 400, 400);

      expect(yogaResult.children.length).toBe(2);
      expect(glyphResult.children.length).toBe(2);

      // Both engines should place first child at x=0
      expect(yogaResult.children[0].x).toBe(0);
      expect(glyphResult.children[0].x).toBe(0);

      // Both should place second child at x=100
      expect(yogaResult.children[1].x).toBe(100);
      expect(glyphResult.children[1].x).toBe(100);
    });

    it('should handle flex grow in both engines', () => {
      const input = node({ width: 400, height: 100 }, [
        node({ height: 50, flex: 1 }),
        node({ height: 50, flex: 1 }),
      ]);

      const yogaEngine = createLayoutEngine('yoga');
      const glyphEngine = createLayoutEngine('glyph');

      const yogaResult = yogaEngine.computeLayout(input, 400, 400);
      const glyphResult = glyphEngine.computeLayout(input, 400, 400);

      // Both should split evenly
      expect(Math.abs(yogaResult.children[0].width - 200)).toBeLessThanOrEqual(1);
      expect(Math.abs(glyphResult.children[0].width - 200)).toBeLessThanOrEqual(1);
    });
  });
});
