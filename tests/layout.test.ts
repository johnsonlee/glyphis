import { describe, it, expect } from 'bun:test';
import { computeLayout, type LayoutInput } from '../src/layout';
import type { Style } from '../src/types';

function node(style: Style, children: LayoutInput[] = [], extras?: { text?: string; measureText?: (text: string, style: Style) => { width: number; height: number } }): LayoutInput {
  return { style, children, ...extras };
}

function expectApprox(actual: number, expected: number, tolerance = 0.5) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe('computeLayout', () => {
  // ─── 1. Basic dimensions ───────────────────────────────────────
  describe('basic dimensions', () => {
    it('should apply fixed width and height', () => {
      const result = computeLayout(node({ width: 200, height: 100 }), 400, 400);
      expect(result.width).toBe(200);
      expect(result.height).toBe(100);
    });

    it('should resolve percentage width and height', () => {
      const result = computeLayout(node({ width: '50%', height: '25%' }), 400, 800);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('should auto-size to fit children in row direction', () => {
      const result = computeLayout(
        node({}, [
          node({ width: 50, height: 30 }),
          node({ width: 70, height: 40 }),
        ]),
        400, 400
      );
      // Auto width should wrap content
      expect(result.children.length).toBe(2);
    });

    it('should auto-size to zero for empty node with no dimensions', () => {
      const result = computeLayout(node({}), 400, 400);
      // With no children and auto sizing, the node should have only padding/border
      expect(result.width).toBeGreaterThanOrEqual(0);
      expect(result.height).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── 2. Flex direction ─────────────────────────────────────────
  describe('flex direction', () => {
    it('should lay out children in a row (default)', () => {
      const result = computeLayout(
        node({ width: 300, height: 100 }, [
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50 }),
        ]),
        300, 100
      );
      expect(result.children[0].x).toBe(0);
      expect(result.children[1].x).toBe(50);
    });

    it('should lay out children in a column', () => {
      const result = computeLayout(
        node({ width: 100, height: 300, flexDirection: 'column' }, [
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50 }),
        ]),
        100, 300
      );
      expect(result.children[0].y).toBe(0);
      expect(result.children[1].y).toBe(50);
    });

    it('should reverse row children positions with row-reverse', () => {
      const result = computeLayout(
        node({ width: 300, height: 100, flexDirection: 'row-reverse' }, [
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50 }),
        ]),
        300, 100
      );
      // First child should be on the right side
      expect(result.children[0].x).toBeGreaterThan(result.children[1].x);
    });

    it('should reverse column children positions with column-reverse', () => {
      const result = computeLayout(
        node({ width: 100, height: 300, flexDirection: 'column-reverse' }, [
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50 }),
        ]),
        100, 300
      );
      // First child should be below second child
      expect(result.children[0].y).toBeGreaterThan(result.children[1].y);
    });
  });

  // ─── 3. Justify content ────────────────────────────────────────
  describe('justify content', () => {
    const container = (jc: Style['justifyContent']) =>
      node({ width: 300, height: 100, justifyContent: jc }, [
        node({ width: 50, height: 50 }),
        node({ width: 50, height: 50 }),
      ]);

    it('flex-start: children at start', () => {
      const result = computeLayout(container('flex-start'), 300, 100);
      expect(result.children[0].x).toBe(0);
      expect(result.children[1].x).toBe(50);
    });

    it('flex-end: children at end', () => {
      const result = computeLayout(container('flex-end'), 300, 100);
      // Free space = 300 - 100 = 200
      expect(result.children[0].x).toBe(200);
      expect(result.children[1].x).toBe(250);
    });

    it('center: children centered', () => {
      const result = computeLayout(container('center'), 300, 100);
      expect(result.children[0].x).toBe(100);
      expect(result.children[1].x).toBe(150);
    });

    it('space-between: children at edges with space between', () => {
      const result = computeLayout(container('space-between'), 300, 100);
      expect(result.children[0].x).toBe(0);
      expect(result.children[1].x).toBe(250);
    });

    it('space-around: equal space around each child', () => {
      const result = computeLayout(container('space-around'), 300, 100);
      // Free = 200, space per item = 100, half = 50
      expectApprox(result.children[0].x, 50);
      expectApprox(result.children[1].x, 200);
    });

    it('space-evenly: equal space including edges', () => {
      const result = computeLayout(container('space-evenly'), 300, 100);
      // Free = 200, slots = 3, space = 66.67
      const space = 200 / 3;
      expectApprox(result.children[0].x, space, 1);
      expectApprox(result.children[1].x, space + 50 + space, 1);
    });

    it('justify content with three children', () => {
      const result = computeLayout(
        node({ width: 300, height: 100, justifyContent: 'space-between' }, [
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50 }),
        ]),
        300, 100
      );
      expect(result.children[0].x).toBe(0);
      expectApprox(result.children[1].x, 125, 1);
      expect(result.children[2].x).toBe(250);
    });

    it('justify content with single child space-between', () => {
      const result = computeLayout(
        node({ width: 300, height: 100, justifyContent: 'space-between' }, [
          node({ width: 50, height: 50 }),
        ]),
        300, 100
      );
      expect(result.children[0].x).toBe(0);
    });
  });

  // ─── 4. Align items ───────────────────────────────────────────
  describe('align items', () => {
    const container = (ai: Style['alignItems']) =>
      node({ width: 300, height: 100, alignItems: ai }, [
        node({ width: 50, height: 30 }),
      ]);

    it('flex-start: child at cross start', () => {
      const result = computeLayout(container('flex-start'), 300, 100);
      expect(result.children[0].y).toBe(0);
    });

    it('flex-end: child at cross end', () => {
      const result = computeLayout(container('flex-end'), 300, 100);
      expect(result.children[0].y).toBe(70); // 100 - 30
    });

    it('center: child centered on cross axis', () => {
      const result = computeLayout(container('center'), 300, 100);
      expect(result.children[0].y).toBe(35); // (100 - 30) / 2
    });

    it('stretch: child stretched to cross size', () => {
      const result = computeLayout(container('stretch'), 300, 100);
      expect(result.children[0].y).toBe(0);
      expect(result.children[0].height).toBe(100);
    });
  });

  // ─── 5. Align self ─────────────────────────────────────────────
  describe('align self', () => {
    it('should override parent alignItems', () => {
      const result = computeLayout(
        node({ width: 300, height: 100, alignItems: 'flex-start' }, [
          node({ width: 50, height: 30 }),
          node({ width: 50, height: 30, alignSelf: 'flex-end' }),
        ]),
        300, 100
      );
      expect(result.children[0].y).toBe(0);
      expect(result.children[1].y).toBe(70);
    });

    it('alignSelf center should center the item', () => {
      const result = computeLayout(
        node({ width: 300, height: 100, alignItems: 'flex-start' }, [
          node({ width: 50, height: 30, alignSelf: 'center' }),
        ]),
        300, 100
      );
      expect(result.children[0].y).toBe(35);
    });

    it('alignSelf stretch should stretch the item', () => {
      const result = computeLayout(
        node({ width: 300, height: 100, alignItems: 'flex-start' }, [
          node({ width: 50, height: 30, alignSelf: 'stretch' }),
        ]),
        300, 100
      );
      expect(result.children[0].height).toBe(100);
    });

    it('alignSelf auto should use parent alignItems', () => {
      const result = computeLayout(
        node({ width: 300, height: 100, alignItems: 'center' }, [
          node({ width: 50, height: 30, alignSelf: 'auto' }),
        ]),
        300, 100
      );
      expect(result.children[0].y).toBe(35);
    });
  });

  // ─── 6. Flex grow ──────────────────────────────────────────────
  describe('flex grow', () => {
    it('should distribute remaining space to single flex-grow child', () => {
      const result = computeLayout(
        node({ width: 300, height: 100 }, [
          node({ width: 50, height: 50 }),
          node({ flexGrow: 1, height: 50 }),
        ]),
        300, 100
      );
      expect(result.children[1].width).toBe(250);
    });

    it('should distribute remaining space proportionally', () => {
      const result = computeLayout(
        node({ width: 300, height: 100 }, [
          node({ flexGrow: 1, height: 50 }),
          node({ flexGrow: 2, height: 50 }),
        ]),
        300, 100
      );
      expect(result.children[0].width).toBe(100);
      expect(result.children[1].width).toBe(200);
    });

    it('should not grow items with flexGrow: 0', () => {
      const result = computeLayout(
        node({ width: 300, height: 100 }, [
          node({ width: 50, height: 50, flexGrow: 0 }),
          node({ flexGrow: 1, height: 50 }),
        ]),
        300, 100
      );
      expect(result.children[0].width).toBe(50);
      expect(result.children[1].width).toBe(250);
    });
  });

  // ─── 7. Flex shrink ────────────────────────────────────────────
  describe('flex shrink', () => {
    it('should shrink items proportionally when they overflow', () => {
      const result = computeLayout(
        node({ width: 200, height: 100 }, [
          node({ width: 150, height: 50, flexShrink: 1 }),
          node({ width: 150, height: 50, flexShrink: 1 }),
        ]),
        200, 100
      );
      // Total = 300, available = 200, overflow = 100
      // Each shrinks by 50
      expect(result.children[0].width).toBe(100);
      expect(result.children[1].width).toBe(100);
    });

    it('should respect different shrink values', () => {
      const result = computeLayout(
        node({ width: 200, height: 100 }, [
          node({ width: 150, height: 50, flexShrink: 1 }),
          node({ width: 150, height: 50, flexShrink: 3 }),
        ]),
        200, 100
      );
      // overflow = 100, total weighted = 1*150 + 3*150 = 600
      // first shrinks by 100 * 150/600 = 25, second by 100 * 450/600 = 75
      expect(result.children[0].width).toBe(125);
      expect(result.children[1].width).toBe(75);
    });

    it('should not shrink items with flexShrink: 0', () => {
      const result = computeLayout(
        node({ width: 200, height: 100 }, [
          node({ width: 150, height: 50, flexShrink: 0 }),
          node({ width: 150, height: 50, flexShrink: 1 }),
        ]),
        200, 100
      );
      expect(result.children[0].width).toBe(150);
      // Second should shrink but is limited by available space logic
    });
  });

  // ─── 8. Flex basis ─────────────────────────────────────────────
  describe('flex basis', () => {
    it('should use explicit flex basis as initial size', () => {
      const result = computeLayout(
        node({ width: 300, height: 100 }, [
          node({ flexBasis: 100, flexGrow: 1, height: 50 }),
          node({ flexBasis: 100, flexGrow: 1, height: 50 }),
        ]),
        300, 100
      );
      // Each starts at 100, remaining = 100, split evenly
      expect(result.children[0].width).toBe(150);
      expect(result.children[1].width).toBe(150);
    });

    it('should use auto basis (falls back to width)', () => {
      const result = computeLayout(
        node({ width: 300, height: 100 }, [
          node({ flexBasis: 'auto', width: 80, flexGrow: 1, height: 50 }),
          node({ flexBasis: 'auto', width: 80, flexGrow: 1, height: 50 }),
        ]),
        300, 100
      );
      // Each starts at 80, remaining = 140, split evenly
      expect(result.children[0].width).toBe(150);
      expect(result.children[1].width).toBe(150);
    });
  });

  // ─── 9. flex shorthand ─────────────────────────────────────────
  describe('flex shorthand', () => {
    it('flex: 1 should mean grow=1, shrink=1, basis=0', () => {
      const result = computeLayout(
        node({ width: 300, height: 100 }, [
          node({ flex: 1, height: 50 }),
          node({ flex: 1, height: 50 }),
        ]),
        300, 100
      );
      expect(result.children[0].width).toBe(150);
      expect(result.children[1].width).toBe(150);
    });

    it('flex: 2 should take twice the space of flex: 1', () => {
      const result = computeLayout(
        node({ width: 300, height: 100 }, [
          node({ flex: 1, height: 50 }),
          node({ flex: 2, height: 50 }),
        ]),
        300, 100
      );
      expect(result.children[0].width).toBe(100);
      expect(result.children[1].width).toBe(200);
    });
  });

  // ─── 10. Flex wrap ─────────────────────────────────────────────
  describe('flex wrap', () => {
    it('nowrap (default): all children on one line', () => {
      const result = computeLayout(
        node({ width: 200, height: 200 }, [
          node({ width: 100, height: 50 }),
          node({ width: 100, height: 50 }),
          node({ width: 100, height: 50 }),
        ]),
        200, 200
      );
      // All on same line (they may shrink)
      expect(result.children[0].y).toBe(result.children[1].y);
      expect(result.children[1].y).toBe(result.children[2].y);
    });

    it('wrap: children wrap to new lines', () => {
      const result = computeLayout(
        node({ width: 200, height: 200, flexWrap: 'wrap', alignItems: 'flex-start', alignContent: 'flex-start' }, [
          node({ width: 100, height: 50 }),
          node({ width: 100, height: 50 }),
          node({ width: 100, height: 50 }),
        ]),
        200, 200
      );
      // First two on line 1, third on line 2
      expect(result.children[0].y).toBe(0);
      expect(result.children[1].y).toBe(0);
      expect(result.children[2].y).toBe(50);
    });

    it('wrap-reverse: lines in reverse cross order', () => {
      const result = computeLayout(
        node({ width: 200, height: 200, flexWrap: 'wrap-reverse', alignItems: 'flex-start' }, [
          node({ width: 100, height: 50 }),
          node({ width: 100, height: 50 }),
          node({ width: 100, height: 50 }),
        ]),
        200, 200
      );
      // With wrap-reverse, first line should be at the bottom
      expect(result.children[0].y).toBeGreaterThan(result.children[2].y);
    });
  });

  // ─── 11. Align content ─────────────────────────────────────────
  describe('align content', () => {
    const wrappedContainer = (ac: Style['alignContent']) =>
      node({ width: 200, height: 200, flexWrap: 'wrap', alignContent: ac, alignItems: 'flex-start' }, [
        node({ width: 100, height: 40 }),
        node({ width: 100, height: 40 }),
        node({ width: 100, height: 40 }),
      ]);

    it('flex-start: lines at cross start', () => {
      const result = computeLayout(wrappedContainer('flex-start'), 200, 200);
      expect(result.children[0].y).toBe(0);
      expect(result.children[2].y).toBe(40);
    });

    it('flex-end: lines at cross end', () => {
      const result = computeLayout(wrappedContainer('flex-end'), 200, 200);
      // Two lines of 40, total = 80, free = 120
      expect(result.children[0].y).toBe(120);
    });

    it('center: lines centered', () => {
      const result = computeLayout(wrappedContainer('center'), 200, 200);
      // Free = 120, offset = 60
      expect(result.children[0].y).toBe(60);
    });

    it('space-between: lines spread to edges', () => {
      const result = computeLayout(wrappedContainer('space-between'), 200, 200);
      expect(result.children[0].y).toBe(0);
      // Second line: free = 120, between 2 lines = 120
      expect(result.children[2].y).toBe(160);
    });

    it('space-around: equal space around lines', () => {
      const result = computeLayout(wrappedContainer('space-around'), 200, 200);
      // Free = 120, per line = 60, half = 30
      expectApprox(result.children[0].y, 30);
    });

    it('stretch: lines stretched equally', () => {
      const result = computeLayout(wrappedContainer('stretch'), 200, 200);
      // Lines should be taller
      expect(result.children[0].y).toBe(0);
    });
  });

  // ─── 12. Padding ───────────────────────────────────────────────
  describe('padding', () => {
    it('uniform padding', () => {
      const result = computeLayout(
        node({ width: 200, height: 200, padding: 20 }, [
          node({ width: 50, height: 50 }),
        ]),
        200, 200
      );
      expect(result.children[0].x).toBe(20);
      expect(result.children[0].y).toBe(20);
    });

    it('per-side padding', () => {
      const result = computeLayout(
        node({ width: 200, height: 200, paddingLeft: 10, paddingTop: 20, paddingRight: 30, paddingBottom: 40 }, [
          node({ width: 50, height: 50 }),
        ]),
        200, 200
      );
      expect(result.children[0].x).toBe(10);
      expect(result.children[0].y).toBe(20);
    });

    it('horizontal/vertical padding', () => {
      const result = computeLayout(
        node({ width: 200, height: 200, paddingHorizontal: 15, paddingVertical: 25 }, [
          node({ width: 50, height: 50 }),
        ]),
        200, 200
      );
      expect(result.children[0].x).toBe(15);
      expect(result.children[0].y).toBe(25);
    });

    it('padding reduces content area for flex sizing', () => {
      const result = computeLayout(
        node({ width: 200, height: 100, padding: 20 }, [
          node({ flex: 1, height: 50 }),
        ]),
        200, 100
      );
      // Content width = 200 - 40 = 160
      expect(result.children[0].width).toBe(160);
    });
  });

  // ─── 13. Margin ────────────────────────────────────────────────
  describe('margin', () => {
    it('uniform margin offsets child', () => {
      const result = computeLayout(
        node({ width: 300, height: 100 }, [
          node({ width: 50, height: 50, margin: 10 }),
        ]),
        300, 100
      );
      expect(result.children[0].x).toBe(10);
      expect(result.children[0].y).toBe(10);
    });

    it('per-side margins', () => {
      const result = computeLayout(
        node({ width: 300, height: 100 }, [
          node({ width: 50, height: 50, marginLeft: 5, marginTop: 10 }),
        ]),
        300, 100
      );
      expect(result.children[0].x).toBe(5);
    });

    it('margins between children in row', () => {
      const result = computeLayout(
        node({ width: 300, height: 100 }, [
          node({ width: 50, height: 50, marginRight: 10 }),
          node({ width: 50, height: 50, marginLeft: 5 }),
        ]),
        300, 100
      );
      expect(result.children[0].x).toBe(0);
      // Second child: after first (50) + marginRight(10) + marginLeft(5)
      expect(result.children[1].x).toBe(65);
    });

    it('horizontal/vertical margins', () => {
      const result = computeLayout(
        node({ width: 300, height: 100 }, [
          node({ width: 50, height: 50, marginHorizontal: 10, marginVertical: 20 }),
        ]),
        300, 100
      );
      expect(result.children[0].x).toBe(10);
      expect(result.children[0].y).toBe(20);
    });
  });

  // ─── 14. Border width ─────────────────────────────────────────
  describe('border width', () => {
    it('borderWidth affects content area like padding', () => {
      const result = computeLayout(
        node({ width: 200, height: 200, borderWidth: 5 }, [
          node({ flex: 1, height: 50 }),
        ]),
        200, 200
      );
      // Content width = 200 - 10 = 190
      expect(result.children[0].width).toBe(190);
      expect(result.children[0].x).toBe(5);
      expect(result.children[0].y).toBe(5);
    });

    it('per-side border widths', () => {
      const result = computeLayout(
        node({
          width: 200, height: 200,
          borderLeftWidth: 3, borderRightWidth: 7,
          borderTopWidth: 2, borderBottomWidth: 8,
        }, [
          node({ flex: 1, height: 50 }),
        ]),
        200, 200
      );
      expect(result.children[0].x).toBe(3);
      expect(result.children[0].y).toBe(2);
      expect(result.children[0].width).toBe(190); // 200 - 3 - 7
    });

    it('border + padding combined', () => {
      const result = computeLayout(
        node({ width: 200, height: 200, borderWidth: 5, padding: 10 }, [
          node({ flex: 1, height: 50 }),
        ]),
        200, 200
      );
      // Content width = 200 - 10(border) - 20(padding) = 170
      expect(result.children[0].width).toBe(170);
      expect(result.children[0].x).toBe(15); // borderLeft + padLeft
    });
  });

  // ─── 15. Gap ───────────────────────────────────────────────────
  describe('gap', () => {
    it('gap between items in row', () => {
      const result = computeLayout(
        node({ width: 300, height: 100, gap: 10 }, [
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50 }),
        ]),
        300, 100
      );
      expect(result.children[0].x).toBe(0);
      expect(result.children[1].x).toBe(60); // 50 + 10
      expect(result.children[2].x).toBe(120); // 110 + 10
    });

    it('gap between items in column', () => {
      const result = computeLayout(
        node({ width: 100, height: 300, flexDirection: 'column', gap: 10 }, [
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50 }),
        ]),
        100, 300
      );
      expect(result.children[0].y).toBe(0);
      expect(result.children[1].y).toBe(60);
    });

    it('columnGap only affects columns between items in row', () => {
      const result = computeLayout(
        node({ width: 300, height: 100, columnGap: 20 }, [
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50 }),
        ]),
        300, 100
      );
      expect(result.children[1].x).toBe(70); // 50 + 20
    });

    it('rowGap only affects rows between lines in column', () => {
      const result = computeLayout(
        node({ width: 100, height: 300, flexDirection: 'column', rowGap: 15 }, [
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50 }),
        ]),
        100, 300
      );
      expect(result.children[1].y).toBe(65); // 50 + 15
    });

    it('gap interacts with flex grow', () => {
      const result = computeLayout(
        node({ width: 300, height: 100, gap: 10 }, [
          node({ flex: 1, height: 50 }),
          node({ flex: 1, height: 50 }),
        ]),
        300, 100
      );
      // Available = 300, gap = 10, each gets (300-10)/2 = 145
      expect(result.children[0].width).toBe(145);
      expect(result.children[1].width).toBe(145);
    });
  });

  // ─── 16. Position absolute ─────────────────────────────────────
  describe('position absolute', () => {
    it('absolute child removed from flow', () => {
      const result = computeLayout(
        node({ width: 300, height: 200 }, [
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50, position: 'absolute', top: 10, left: 10 }),
          node({ width: 50, height: 50 }),
        ]),
        300, 200
      );
      // Second child is absolute, so third child is at x=50 (right after first)
      expect(result.children[0].x).toBe(0);
      expect(result.children[2].x).toBe(50);
    });

    it('absolute positioning with top/left', () => {
      const result = computeLayout(
        node({ width: 300, height: 200 }, [
          node({ width: 50, height: 50, position: 'absolute', top: 20, left: 30 }),
        ]),
        300, 200
      );
      expect(result.children[0].x).toBe(30);
      expect(result.children[0].y).toBe(20);
    });

    it('absolute positioning with bottom/right', () => {
      const result = computeLayout(
        node({ width: 300, height: 200 }, [
          node({ width: 50, height: 50, position: 'absolute', bottom: 10, right: 10 }),
        ]),
        300, 200
      );
      expect(result.children[0].x).toBe(240); // 300 - 10 - 50
      expect(result.children[0].y).toBe(140); // 200 - 10 - 50
    });

    it('absolute positioning with padding parent', () => {
      const result = computeLayout(
        node({ width: 300, height: 200, padding: 20 }, [
          node({ width: 50, height: 50, position: 'absolute', top: 0, left: 0 }),
        ]),
        300, 200
      );
      // Position relative to padding box
      expect(result.children[0].x).toBe(20);
      expect(result.children[0].y).toBe(20);
    });

    it('absolute child size inferred from offsets', () => {
      const result = computeLayout(
        node({ width: 300, height: 200 }, [
          node({ height: 50, position: 'absolute', left: 10, right: 10 }),
        ]),
        300, 200
      );
      expect(result.children[0].width).toBe(280); // 300 - 10 - 10
    });
  });

  // ─── 17. Min/Max constraints ────────────────────────────────────
  describe('min/max constraints', () => {
    it('minWidth clamps up', () => {
      const result = computeLayout(node({ width: 50, height: 50, minWidth: 100 }), 400, 400);
      expect(result.width).toBe(100);
    });

    it('maxWidth clamps down', () => {
      const result = computeLayout(node({ width: 200, height: 50, maxWidth: 100 }), 400, 400);
      expect(result.width).toBe(100);
    });

    it('minHeight clamps up', () => {
      const result = computeLayout(node({ width: 50, height: 30, minHeight: 80 }), 400, 400);
      expect(result.height).toBe(80);
    });

    it('maxHeight clamps down', () => {
      const result = computeLayout(node({ width: 50, height: 200, maxHeight: 100 }), 400, 400);
      expect(result.height).toBe(100);
    });

    it('flex grow respects maxWidth on child', () => {
      const result = computeLayout(
        node({ width: 300, height: 100 }, [
          node({ flexGrow: 1, height: 50, maxWidth: 100 }),
          node({ flexGrow: 1, height: 50 }),
        ]),
        300, 100
      );
      expect(result.children[0].width).toBeLessThanOrEqual(100);
    });

    it('flex shrink respects minWidth on child', () => {
      const result = computeLayout(
        node({ width: 100, height: 100 }, [
          node({ width: 100, height: 50, flexShrink: 1, minWidth: 80 }),
          node({ width: 100, height: 50, flexShrink: 1 }),
        ]),
        100, 100
      );
      expect(result.children[0].width).toBeGreaterThanOrEqual(80);
    });
  });

  // ─── 18. Display none ──────────────────────────────────────────
  describe('display none', () => {
    it('display none node returns zero size', () => {
      const result = computeLayout(
        node({ width: 100, height: 100, display: 'none' }),
        400, 400
      );
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
    });

    it('display none child is skipped in layout', () => {
      const result = computeLayout(
        node({ width: 300, height: 100 }, [
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50, display: 'none' }),
          node({ width: 50, height: 50 }),
        ]),
        300, 100
      );
      // Third child (index 2) should be right after first since second is none
      expect(result.children[0].x).toBe(0);
      expect(result.children[2].x).toBe(50);
    });

    it('display none child produces zero-size output', () => {
      const result = computeLayout(
        node({ width: 300, height: 100 }, [
          node({ width: 50, height: 50, display: 'none' }),
        ]),
        300, 100
      );
      expect(result.children[0].width).toBe(0);
      expect(result.children[0].height).toBe(0);
    });
  });

  // ─── 19. Nested layouts ────────────────────────────────────────
  describe('nested layouts', () => {
    it('child with its own flex layout', () => {
      const result = computeLayout(
        node({ width: 300, height: 200 }, [
          node({ width: 200, height: 100, flexDirection: 'column' }, [
            node({ width: 50, height: 30 }),
            node({ width: 50, height: 30 }),
          ]),
        ]),
        300, 200
      );
      expect(result.children[0].children.length).toBe(2);
      expect(result.children[0].children[0].y).toBe(0);
      expect(result.children[0].children[1].y).toBe(30);
    });

    it('deeply nested flex containers', () => {
      const result = computeLayout(
        node({ width: 400, height: 300 }, [
          node({ flex: 1, height: 300, flexDirection: 'column' }, [
            node({ flex: 1 }, [
              node({ width: 20, height: 20 }),
            ]),
            node({ flex: 1 }),
          ]),
          node({ flex: 1, height: 300 }),
        ]),
        400, 300
      );
      expect(result.children.length).toBe(2);
      expect(result.children[0].children.length).toBe(2);
    });
  });

  // ─── 20. Text measurement ──────────────────────────────────────
  describe('text measurement', () => {
    it('should use measureText for intrinsic size', () => {
      const measureText = (_text: string, _style: Style) => ({ width: 80, height: 20 });
      const result = computeLayout(
        node({}, [], { text: 'Hello', measureText }),
        400, 400
      );
      expect(result.width).toBe(80);
      expect(result.height).toBe(20);
    });

    it('text node with padding', () => {
      const measureText = (_text: string, _style: Style) => ({ width: 80, height: 20 });
      const result = computeLayout(
        node({ padding: 10 }, [], { text: 'Hello', measureText }),
        400, 400
      );
      expect(result.width).toBe(100); // 80 + 20
      expect(result.height).toBe(40); // 20 + 20
    });

    it('explicit width overrides text measurement', () => {
      const measureText = (_text: string, _style: Style) => ({ width: 80, height: 20 });
      const result = computeLayout(
        node({ width: 200 }, [], { text: 'Hello', measureText }),
        400, 400
      );
      expect(result.width).toBe(200);
    });

    it('text child used as flex basis fallback', () => {
      const measureText = (_text: string, _style: Style) => ({ width: 60, height: 20 });
      const result = computeLayout(
        node({ width: 300, height: 100 }, [
          node({}, [], { text: 'Hi', measureText }),
          node({ flex: 1, height: 50 }),
        ]),
        300, 100
      );
      expect(result.children[0].width).toBe(60);
      expect(result.children[1].width).toBe(240);
    });
  });

  // ─── 21. Edge cases ────────────────────────────────────────────
  describe('edge cases', () => {
    it('no children', () => {
      const result = computeLayout(
        node({ width: 100, height: 50 }),
        400, 400
      );
      expect(result.width).toBe(100);
      expect(result.height).toBe(50);
      expect(result.children).toEqual([]);
    });

    it('single child', () => {
      const result = computeLayout(
        node({ width: 200, height: 100 }, [
          node({ width: 50, height: 50 }),
        ]),
        200, 100
      );
      expect(result.children.length).toBe(1);
      expect(result.children[0].x).toBe(0);
      expect(result.children[0].y).toBe(0);
    });

    it('zero available space', () => {
      const result = computeLayout(
        node({ width: 0, height: 0 }, [
          node({ width: 50, height: 50 }),
        ]),
        0, 0
      );
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
    });

    it('child larger than parent', () => {
      const result = computeLayout(
        node({ width: 100, height: 100 }, [
          node({ width: 200, height: 200 }),
        ]),
        100, 100
      );
      // Child may shrink or overflow
      expect(result.children.length).toBe(1);
    });

    it('root output starts at x:0, y:0', () => {
      const result = computeLayout(
        node({ width: 100, height: 100 }),
        400, 400
      );
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('many children', () => {
      const children = Array.from({ length: 20 }, () => node({ width: 10, height: 10 }));
      const result = computeLayout(
        node({ width: 400, height: 100 }, children),
        400, 100
      );
      expect(result.children.length).toBe(20);
    });
  });

  // ─── Column-specific tests ─────────────────────────────────────
  describe('column direction specifics', () => {
    it('justify content center in column', () => {
      const result = computeLayout(
        node({ width: 100, height: 300, flexDirection: 'column', justifyContent: 'center' }, [
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50 }),
        ]),
        100, 300
      );
      // Free = 200, offset = 100
      expect(result.children[0].y).toBe(100);
      expect(result.children[1].y).toBe(150);
    });

    it('align items in column affects x axis', () => {
      const result = computeLayout(
        node({ width: 200, height: 300, flexDirection: 'column', alignItems: 'center' }, [
          node({ width: 50, height: 50 }),
        ]),
        200, 300
      );
      expect(result.children[0].x).toBe(75); // (200 - 50) / 2
    });

    it('flex grow in column distributes height', () => {
      const result = computeLayout(
        node({ width: 100, height: 300, flexDirection: 'column' }, [
          node({ width: 50, flexGrow: 1 }),
          node({ width: 50, flexGrow: 2 }),
        ]),
        100, 300
      );
      expect(result.children[0].height).toBe(100);
      expect(result.children[1].height).toBe(200);
    });

    it('gap in column direction', () => {
      const result = computeLayout(
        node({ width: 100, height: 300, flexDirection: 'column', gap: 10 }, [
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50 }),
          node({ width: 50, height: 50 }),
        ]),
        100, 300
      );
      expect(result.children[0].y).toBe(0);
      expect(result.children[1].y).toBe(60);
      expect(result.children[2].y).toBe(120);
    });
  });

  // ─── Combined scenarios ─────────────────────────────────────────
  describe('combined scenarios', () => {
    it('padding + margin + border combined', () => {
      const result = computeLayout(
        node({ width: 300, height: 200, padding: 10, borderWidth: 5 }, [
          node({ width: 50, height: 50, margin: 5 }),
        ]),
        300, 200
      );
      expect(result.children[0].x).toBe(20); // pad(10) + border(5) + margin(5)
      expect(result.children[0].y).toBe(20);
    });

    it('flex grow with gap and padding', () => {
      const result = computeLayout(
        node({ width: 300, height: 100, padding: 10, gap: 10 }, [
          node({ flex: 1, height: 50 }),
          node({ flex: 1, height: 50 }),
        ]),
        300, 100
      );
      // Content = 280, gap = 10, each = 135
      expect(result.children[0].width).toBe(135);
      expect(result.children[1].width).toBe(135);
    });

    it('percentage width inside padded parent', () => {
      const result = computeLayout(
        node({ width: 200, height: 100, padding: 20 }, [
          node({ width: '50%', height: 50 }),
        ]),
        200, 100
      );
      // Child resolves 50% of parentWidth passed to computeLayout
      // Parent's content width = 200 - 40 = 160, child sees 160 as parentWidth
      expect(result.children[0].width).toBeLessThanOrEqual(100);
    });

    it('multiple align-self values in same container', () => {
      const result = computeLayout(
        node({ width: 300, height: 100, alignItems: 'flex-start' }, [
          node({ width: 50, height: 30, alignSelf: 'flex-start' }),
          node({ width: 50, height: 30, alignSelf: 'flex-end' }),
          node({ width: 50, height: 30, alignSelf: 'center' }),
          node({ width: 50, height: 30, alignSelf: 'stretch' }),
        ]),
        300, 100
      );
      expect(result.children[0].y).toBe(0);
      expect(result.children[1].y).toBe(70);
      expect(result.children[2].y).toBe(35);
      expect(result.children[3].height).toBe(100);
    });
  });
});
