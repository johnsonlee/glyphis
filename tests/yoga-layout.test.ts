import { describe, it, expect } from 'bun:test';
import { YogaLayoutEngine } from '../src/layout/yoga-layout';
import type { LayoutInput } from '../src/layout';
import type { Style } from '../src/types';

function node(
  style: Style,
  children: LayoutInput[] = [],
  extras?: { text?: string; measureText?: (text: string, style: Style) => { width: number; height: number } },
): LayoutInput {
  return { style, children, ...extras };
}

function expectApprox(actual: number, expected: number, tolerance = 0.5) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe('YogaLayoutEngine', () => {
  const engine = new YogaLayoutEngine();

  // 1. Basic dimensions
  describe('basic dimensions', () => {
    it('should apply fixed width and height', () => {
      const result = engine.computeLayout(node({ width: 200, height: 100 }), 400, 400);
      expect(result.width).toBe(200);
      expect(result.height).toBe(100);
    });

    it('should resolve percentage width and height', () => {
      const result = engine.computeLayout(node({ width: '50%', height: '25%' }), 400, 800);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('should auto-size to fit children', () => {
      const result = engine.computeLayout(
        node({}, [
          node({ width: 50, height: 30 }),
          node({ width: 70, height: 40 }),
        ]),
        400,
        400,
      );
      expect(result.children.length).toBe(2);
    });

    it('should auto-size to zero for empty node with no dimensions', () => {
      const result = engine.computeLayout(node({}), 400, 400);
      expect(result.width).toBeGreaterThanOrEqual(0);
      expect(result.height).toBeGreaterThanOrEqual(0);
    });
  });

  // 2. Flex direction
  describe('flex direction', () => {
    it('should lay out children in a row (default)', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 100 }, [
          node({ width: 100, height: 50 }),
          node({ width: 100, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].x).toBe(0);
      expect(result.children[1].x).toBe(100);
    });

    it('should lay out children in a column', () => {
      const result = engine.computeLayout(
        node({ width: 200, height: 400, flexDirection: 'column' }, [
          node({ width: 100, height: 50 }),
          node({ width: 100, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].y).toBe(0);
      expect(result.children[1].y).toBe(50);
    });

    it('should lay out children in row-reverse', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 100, flexDirection: 'row-reverse' }, [
          node({ width: 100, height: 50 }),
          node({ width: 100, height: 50 }),
        ]),
        400,
        400,
      );
      // In row-reverse, first child is at the right end
      expect(result.children[0].x).toBeGreaterThan(result.children[1].x);
    });

    it('should lay out children in column-reverse', () => {
      const result = engine.computeLayout(
        node({ width: 200, height: 400, flexDirection: 'column-reverse' }, [
          node({ width: 100, height: 50 }),
          node({ width: 100, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].y).toBeGreaterThan(result.children[1].y);
    });
  });

  // 3. Justify content
  describe('justify content', () => {
    it('should justify flex-start (default)', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 100, justifyContent: 'flex-start' }, [
          node({ width: 100, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].x).toBe(0);
    });

    it('should justify flex-end', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 100, justifyContent: 'flex-end' }, [
          node({ width: 100, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].x).toBe(300);
    });

    it('should justify center', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 100, justifyContent: 'center' }, [
          node({ width: 100, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].x).toBe(150);
    });

    it('should justify space-between', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 100, justifyContent: 'space-between' }, [
          node({ width: 100, height: 50 }),
          node({ width: 100, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].x).toBe(0);
      expect(result.children[1].x).toBe(300);
    });

    it('should justify space-around', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 100, justifyContent: 'space-around' }, [
          node({ width: 100, height: 50 }),
          node({ width: 100, height: 50 }),
        ]),
        400,
        400,
      );
      // space-around: equal space around each item
      const space = (400 - 200) / 4; // 50
      expectApprox(result.children[0].x, space);
      expectApprox(result.children[1].x, 100 + 3 * space);
    });

    it('should justify space-evenly', () => {
      const result = engine.computeLayout(
        node({ width: 300, height: 100, justifyContent: 'space-evenly' }, [
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50 }),
        ]),
        400,
        400,
      );
      // space-evenly: equal gaps (3 gaps for 2 items)
      const gap = (300 - 100) / 3;
      expectApprox(result.children[0].x, gap);
      expectApprox(result.children[1].x, 2 * gap + 50);
    });
  });

  // 4. Align items
  describe('align items', () => {
    it('should align items flex-start', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 200, alignItems: 'flex-start' }, [
          node({ width: 100, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].y).toBe(0);
    });

    it('should align items flex-end', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 200, alignItems: 'flex-end' }, [
          node({ width: 100, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].y).toBe(150);
    });

    it('should align items center', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 200, alignItems: 'center' }, [
          node({ width: 100, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].y).toBe(75);
    });

    it('should align items stretch', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 200, alignItems: 'stretch' }, [
          node({ width: 100 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].height).toBe(200);
    });
  });

  // 5. Align self
  describe('align self', () => {
    it('should override parent alignItems', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 200, alignItems: 'flex-start' }, [
          node({ width: 100, height: 50 }),
          node({ width: 100, height: 50, alignSelf: 'flex-end' }),
        ]),
        400,
        400,
      );
      expect(result.children[0].y).toBe(0);
      expect(result.children[1].y).toBe(150);
    });

    it('should support align self center', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 200, alignItems: 'flex-start' }, [
          node({ width: 100, height: 50, alignSelf: 'center' }),
        ]),
        400,
        400,
      );
      expect(result.children[0].y).toBe(75);
    });
  });

  // 6. Flex grow
  describe('flex grow', () => {
    it('should distribute extra space with flex grow', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 100 }, [
          node({ width: 100, height: 50, flexGrow: 1 }),
          node({ width: 100, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].width).toBe(300);
      expect(result.children[1].width).toBe(100);
    });

    it('should distribute proportionally with multiple flex grow', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 100 }, [
          node({ height: 50, flexGrow: 1 }),
          node({ height: 50, flexGrow: 3 }),
        ]),
        400,
        400,
      );
      expectApprox(result.children[0].width, 100);
      expectApprox(result.children[1].width, 300);
    });
  });

  // 7. Flex shrink
  describe('flex shrink', () => {
    it('should shrink items when overflowing', () => {
      const result = engine.computeLayout(
        node({ width: 200, height: 100 }, [
          node({ width: 150, height: 50, flexShrink: 1 }),
          node({ width: 150, height: 50, flexShrink: 1 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].width).toBeLessThan(150);
      expect(result.children[1].width).toBeLessThan(150);
      expectApprox(result.children[0].width + result.children[1].width, 200);
    });
  });

  // 8. Flex basis
  describe('flex basis', () => {
    it('should use explicit flex basis', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 100 }, [
          node({ height: 50, flexBasis: 200, flexGrow: 1 }),
          node({ height: 50, flexBasis: 100, flexGrow: 1 }),
        ]),
        400,
        400,
      );
      // Both grow equally from their flex basis
      expectApprox(result.children[0].width, 250);
      expectApprox(result.children[1].width, 150);
    });

    it('should handle auto flex basis', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 100 }, [
          node({ width: 100, height: 50, flexBasis: 'auto', flexGrow: 1 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].width).toBe(400);
    });
  });

  // 9. Flex shorthand
  describe('flex shorthand', () => {
    it('should handle flex: 1', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 100 }, [
          node({ height: 50, flex: 1 }),
          node({ height: 50, flex: 1 }),
        ]),
        400,
        400,
      );
      expectApprox(result.children[0].width, 200);
      expectApprox(result.children[1].width, 200);
    });
  });

  // 10. Padding
  describe('padding', () => {
    it('should apply uniform padding', () => {
      const result = engine.computeLayout(
        node({ width: 200, height: 200, padding: 20 }, [
          node({ width: 50, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].x).toBe(20);
      expect(result.children[0].y).toBe(20);
    });

    it('should apply per-side padding', () => {
      const result = engine.computeLayout(
        node({ width: 200, height: 200, paddingTop: 10, paddingLeft: 30 }, [
          node({ width: 50, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].x).toBe(30);
      expect(result.children[0].y).toBe(10);
    });

    it('should apply horizontal and vertical padding', () => {
      const result = engine.computeLayout(
        node({ width: 200, height: 200, paddingHorizontal: 15, paddingVertical: 25 }, [
          node({ width: 50, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].x).toBe(15);
      expect(result.children[0].y).toBe(25);
    });
  });

  // 11. Margin
  describe('margin', () => {
    it('should apply uniform margin', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 400 }, [
          node({ width: 100, height: 100, margin: 10 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].x).toBe(10);
      expect(result.children[0].y).toBe(10);
    });

    it('should apply per-side margin', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 400 }, [
          node({ width: 100, height: 100, marginLeft: 20, marginTop: 30 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].x).toBe(20);
      expect(result.children[0].y).toBe(30);
    });
  });

  // 12. Border width
  describe('border width', () => {
    it('should affect content area like padding', () => {
      const result = engine.computeLayout(
        node({ width: 200, height: 200, borderWidth: 5 }, [
          node({ width: 50, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].x).toBe(5);
      expect(result.children[0].y).toBe(5);
    });
  });

  // 13. Gap
  describe('gap', () => {
    it('should apply gap between row children', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 100, gap: 20 }, [
          node({ width: 100, height: 50 }),
          node({ width: 100, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].x).toBe(0);
      expect(result.children[1].x).toBe(120);
    });

    it('should apply column gap', () => {
      const result = engine.computeLayout(
        node({ width: 200, height: 400, flexDirection: 'column', rowGap: 15 }, [
          node({ width: 100, height: 50 }),
          node({ width: 100, height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].y).toBe(0);
      expect(result.children[1].y).toBe(65);
    });
  });

  // 14. Position absolute
  describe('position absolute', () => {
    it('should position absolute children with offsets', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 400 }, [
          node({ width: 100, height: 100, position: 'absolute', top: 10, left: 20 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].x).toBe(20);
      expect(result.children[0].y).toBe(10);
    });

    it('should position with right and bottom offsets', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 400 }, [
          node({ width: 100, height: 100, position: 'absolute', right: 10, bottom: 20 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].x).toBe(290);
      expect(result.children[0].y).toBe(280);
    });
  });

  // 15. Min/max constraints
  describe('min/max constraints', () => {
    it('should clamp width with maxWidth', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 100 }, [
          node({ height: 50, flexGrow: 1, maxWidth: 200 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].width).toBe(200);
    });

    it('should clamp width with minWidth', () => {
      const result = engine.computeLayout(
        node({ width: 100, height: 100 }, [
          node({ width: 10, height: 50, minWidth: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].width).toBe(50);
    });
  });

  // 16. Display none
  describe('display none', () => {
    it('should skip display none nodes', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 100 }, [
          node({ width: 100, height: 50 }),
          node({ width: 100, height: 50, display: 'none' }),
          node({ width: 100, height: 50 }),
        ]),
        400,
        400,
      );
      // Second child should have zero dimensions
      expect(result.children[1].width).toBe(0);
      expect(result.children[1].height).toBe(0);
      // Third child should be positioned after first, not after hidden
      expect(result.children[2].x).toBe(100);
    });
  });

  // 17. Nested layouts
  describe('nested layouts', () => {
    it('should handle nested flex containers', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 400, flexDirection: 'column' }, [
          node({ height: 100, flexDirection: 'row' }, [
            node({ width: 50, height: 50 }),
            node({ width: 50, height: 50 }),
          ]),
          node({ height: 100 }),
        ]),
        400,
        400,
      );
      expect(result.children.length).toBe(2);
      expect(result.children[0].children.length).toBe(2);
      expect(result.children[0].children[0].x).toBe(0);
      expect(result.children[0].children[1].x).toBe(50);
    });
  });

  // 18. Text measurement
  describe('text measurement', () => {
    it('should use measureText for leaf text nodes', () => {
      const measureText = (_text: string, _style: Style) => ({
        width: 80,
        height: 20,
      });

      const result = engine.computeLayout(
        node({ width: 400, height: 100, alignItems: 'flex-start' }, [
          node({}, [], { text: 'Hello', measureText }),
        ]),
        400,
        400,
      );
      expectApprox(result.children[0].width, 80);
      expectApprox(result.children[0].height, 20);
    });
  });

  // 19. Percentage dimensions
  describe('percentage dimensions', () => {
    it('should resolve percentage width', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 400 }, [
          node({ width: '50%', height: 50 }),
        ]),
        400,
        400,
      );
      expect(result.children[0].width).toBe(200);
    });

    it('should resolve percentage height', () => {
      const result = engine.computeLayout(
        node({ width: 400, height: 400 }, [
          node({ width: 50, height: '25%' }),
        ]),
        400,
        400,
      );
      expect(result.children[0].height).toBe(100);
    });
  });

  // 20. Flex wrap
  describe('flex wrap', () => {
    it('should wrap items to next line', () => {
      const result = engine.computeLayout(
        node({ width: 200, height: 400, flexWrap: 'wrap' }, [
          node({ width: 120, height: 50 }),
          node({ width: 120, height: 50 }),
        ]),
        400,
        400,
      );
      // Second item should wrap to next line
      expect(result.children[1].y).toBeGreaterThan(0);
    });

    it('should not wrap in nowrap mode', () => {
      const result = engine.computeLayout(
        node({ width: 200, height: 400, flexWrap: 'nowrap' }, [
          node({ width: 120, height: 50 }),
          node({ width: 120, height: 50 }),
        ]),
        400,
        400,
      );
      // Both items should be on the same line (y = 0)
      expect(result.children[0].y).toBe(0);
      expect(result.children[1].y).toBe(0);
    });
  });

  // Dispose
  describe('dispose', () => {
    it('should not throw on dispose', () => {
      const e = new YogaLayoutEngine();
      expect(() => e.dispose()).not.toThrow();
    });
  });
});
