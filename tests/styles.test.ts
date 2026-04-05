import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import Yoga, {
  Edge,
  FlexDirection,
  Justify,
  Align,
  Wrap,
  PositionType,
  Display,
  Overflow,
  Gutter,
  Unit,
} from 'yoga-layout';
import type { Node } from 'yoga-layout';
import { applyStyle } from '../src/styles';

let node: Node;

beforeEach(() => {
  node = Yoga.Node.create();
});

afterEach(() => {
  node.free();
});

// ---------------------------------------------------------------------------
// Helper: value/unit objects returned by dimension getters
// ---------------------------------------------------------------------------
function pt(value: number) {
  return { value, unit: Unit.Point };
}

// ---------------------------------------------------------------------------
// 1. Dimensions
// ---------------------------------------------------------------------------
describe('dimensions', () => {
  it('applies width', () => {
    applyStyle(node, { width: 100 });
    expect(node.getWidth()).toEqual(pt(100));
  });

  it('applies height', () => {
    applyStyle(node, { height: 200 });
    expect(node.getHeight()).toEqual(pt(200));
  });

  it('applies minWidth', () => {
    applyStyle(node, { minWidth: 50 });
    expect(node.getMinWidth()).toEqual(pt(50));
  });

  it('applies minHeight', () => {
    applyStyle(node, { minHeight: 30 });
    expect(node.getMinHeight()).toEqual(pt(30));
  });

  it('applies maxWidth', () => {
    applyStyle(node, { maxWidth: 400 });
    expect(node.getMaxWidth()).toEqual(pt(400));
  });

  it('applies maxHeight', () => {
    applyStyle(node, { maxHeight: 300 });
    expect(node.getMaxHeight()).toEqual(pt(300));
  });

  it('does not crash when dimensions are undefined', () => {
    expect(() => applyStyle(node, {})).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. Flex properties
// ---------------------------------------------------------------------------
describe('flex', () => {
  it('applies flex', () => {
    // setFlex is a shorthand that Yoga stores internally; there is no getFlex.
    // Verify the setter is called by spying on it.
    const spy = spyOn(node, 'setFlex');
    applyStyle(node, { flex: 1 });
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('applies flexDirection - column', () => {
    applyStyle(node, { flexDirection: 'column' });
    expect(node.getFlexDirection()).toBe(FlexDirection.Column);
  });

  it('applies flexDirection - row', () => {
    applyStyle(node, { flexDirection: 'row' });
    expect(node.getFlexDirection()).toBe(FlexDirection.Row);
  });

  it('applies flexDirection - column-reverse', () => {
    applyStyle(node, { flexDirection: 'column-reverse' });
    expect(node.getFlexDirection()).toBe(FlexDirection.ColumnReverse);
  });

  it('applies flexDirection - row-reverse', () => {
    applyStyle(node, { flexDirection: 'row-reverse' });
    expect(node.getFlexDirection()).toBe(FlexDirection.RowReverse);
  });

  it('applies flexGrow', () => {
    applyStyle(node, { flexGrow: 2 });
    expect(node.getFlexGrow()).toBe(2);
  });

  it('applies flexShrink', () => {
    applyStyle(node, { flexShrink: 0.5 });
    expect(node.getFlexShrink()).toBe(0.5);
  });

  it('applies flexBasis as number', () => {
    applyStyle(node, { flexBasis: 80 });
    expect(node.getFlexBasis()).toEqual(pt(80));
  });

  it('applies flexWrap - wrap', () => {
    applyStyle(node, { flexWrap: 'wrap' });
    expect(node.getFlexWrap()).toBe(Wrap.Wrap);
  });

  it('applies flexWrap - nowrap', () => {
    applyStyle(node, { flexWrap: 'nowrap' });
    expect(node.getFlexWrap()).toBe(Wrap.NoWrap);
  });

  it('applies flexWrap - wrap-reverse', () => {
    applyStyle(node, { flexWrap: 'wrap-reverse' });
    expect(node.getFlexWrap()).toBe(Wrap.WrapReverse);
  });

  it('does not crash when flex properties are undefined', () => {
    expect(() => applyStyle(node, {})).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. Alignment
// ---------------------------------------------------------------------------
describe('alignment', () => {
  it('applies justifyContent - flex-start', () => {
    applyStyle(node, { justifyContent: 'flex-start' });
    expect(node.getJustifyContent()).toBe(Justify.FlexStart);
  });

  it('applies justifyContent - center', () => {
    applyStyle(node, { justifyContent: 'center' });
    expect(node.getJustifyContent()).toBe(Justify.Center);
  });

  it('applies justifyContent - flex-end', () => {
    applyStyle(node, { justifyContent: 'flex-end' });
    expect(node.getJustifyContent()).toBe(Justify.FlexEnd);
  });

  it('applies justifyContent - space-between', () => {
    applyStyle(node, { justifyContent: 'space-between' });
    expect(node.getJustifyContent()).toBe(Justify.SpaceBetween);
  });

  it('applies justifyContent - space-around', () => {
    applyStyle(node, { justifyContent: 'space-around' });
    expect(node.getJustifyContent()).toBe(Justify.SpaceAround);
  });

  it('applies justifyContent - space-evenly', () => {
    applyStyle(node, { justifyContent: 'space-evenly' });
    expect(node.getJustifyContent()).toBe(Justify.SpaceEvenly);
  });

  it('applies alignItems - center', () => {
    applyStyle(node, { alignItems: 'center' });
    expect(node.getAlignItems()).toBe(Align.Center);
  });

  it('applies alignItems - flex-start', () => {
    applyStyle(node, { alignItems: 'flex-start' });
    expect(node.getAlignItems()).toBe(Align.FlexStart);
  });

  it('applies alignItems - flex-end', () => {
    applyStyle(node, { alignItems: 'flex-end' });
    expect(node.getAlignItems()).toBe(Align.FlexEnd);
  });

  it('applies alignItems - stretch', () => {
    applyStyle(node, { alignItems: 'stretch' });
    expect(node.getAlignItems()).toBe(Align.Stretch);
  });

  it('applies alignItems - baseline', () => {
    applyStyle(node, { alignItems: 'baseline' });
    expect(node.getAlignItems()).toBe(Align.Baseline);
  });

  it('applies alignSelf - flex-end', () => {
    applyStyle(node, { alignSelf: 'flex-end' });
    expect(node.getAlignSelf()).toBe(Align.FlexEnd);
  });

  it('applies alignSelf - auto', () => {
    applyStyle(node, { alignSelf: 'auto' });
    expect(node.getAlignSelf()).toBe(Align.Auto);
  });

  it('applies alignContent - space-between', () => {
    applyStyle(node, { alignContent: 'space-between' });
    expect(node.getAlignContent()).toBe(Align.SpaceBetween);
  });

  it('applies alignContent - space-around', () => {
    applyStyle(node, { alignContent: 'space-around' });
    expect(node.getAlignContent()).toBe(Align.SpaceAround);
  });

  it('applies alignContent - center', () => {
    applyStyle(node, { alignContent: 'center' });
    expect(node.getAlignContent()).toBe(Align.Center);
  });

  it('does not crash when alignment properties are undefined', () => {
    expect(() => applyStyle(node, {})).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4. Padding
// ---------------------------------------------------------------------------
describe('padding', () => {
  it('applies padding (all edges)', () => {
    applyStyle(node, { padding: 10 });
    expect(node.getPadding(Edge.All)).toEqual(pt(10));
  });

  it('applies paddingTop', () => {
    applyStyle(node, { paddingTop: 5 });
    expect(node.getPadding(Edge.Top)).toEqual(pt(5));
  });

  it('applies paddingRight', () => {
    applyStyle(node, { paddingRight: 8 });
    expect(node.getPadding(Edge.Right)).toEqual(pt(8));
  });

  it('applies paddingBottom', () => {
    applyStyle(node, { paddingBottom: 12 });
    expect(node.getPadding(Edge.Bottom)).toEqual(pt(12));
  });

  it('applies paddingLeft', () => {
    applyStyle(node, { paddingLeft: 3 });
    expect(node.getPadding(Edge.Left)).toEqual(pt(3));
  });

  it('applies paddingHorizontal', () => {
    applyStyle(node, { paddingHorizontal: 20 });
    expect(node.getPadding(Edge.Horizontal)).toEqual(pt(20));
  });

  it('applies paddingVertical', () => {
    applyStyle(node, { paddingVertical: 15 });
    expect(node.getPadding(Edge.Vertical)).toEqual(pt(15));
  });

  it('does not crash when padding properties are undefined', () => {
    expect(() => applyStyle(node, {})).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 5. Margin
// ---------------------------------------------------------------------------
describe('margin', () => {
  it('applies margin (all edges)', () => {
    applyStyle(node, { margin: 10 });
    expect(node.getMargin(Edge.All)).toEqual(pt(10));
  });

  it('applies marginTop', () => {
    applyStyle(node, { marginTop: 5 });
    expect(node.getMargin(Edge.Top)).toEqual(pt(5));
  });

  it('applies marginRight', () => {
    applyStyle(node, { marginRight: 8 });
    expect(node.getMargin(Edge.Right)).toEqual(pt(8));
  });

  it('applies marginBottom', () => {
    applyStyle(node, { marginBottom: 12 });
    expect(node.getMargin(Edge.Bottom)).toEqual(pt(12));
  });

  it('applies marginLeft', () => {
    applyStyle(node, { marginLeft: 3 });
    expect(node.getMargin(Edge.Left)).toEqual(pt(3));
  });

  it('applies marginHorizontal', () => {
    applyStyle(node, { marginHorizontal: 20 });
    expect(node.getMargin(Edge.Horizontal)).toEqual(pt(20));
  });

  it('applies marginVertical', () => {
    applyStyle(node, { marginVertical: 15 });
    expect(node.getMargin(Edge.Vertical)).toEqual(pt(15));
  });

  it('does not crash when margin properties are undefined', () => {
    expect(() => applyStyle(node, {})).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 6. Position
// ---------------------------------------------------------------------------
describe('position', () => {
  it('applies position - relative', () => {
    applyStyle(node, { position: 'relative' });
    expect(node.getPositionType()).toBe(PositionType.Relative);
  });

  it('applies position - absolute', () => {
    applyStyle(node, { position: 'absolute' });
    expect(node.getPositionType()).toBe(PositionType.Absolute);
  });

  it('applies top', () => {
    applyStyle(node, { top: 10 });
    expect(node.getPosition(Edge.Top)).toEqual(pt(10));
  });

  it('applies right', () => {
    applyStyle(node, { right: 20 });
    expect(node.getPosition(Edge.Right)).toEqual(pt(20));
  });

  it('applies bottom', () => {
    applyStyle(node, { bottom: 30 });
    expect(node.getPosition(Edge.Bottom)).toEqual(pt(30));
  });

  it('applies left', () => {
    applyStyle(node, { left: 40 });
    expect(node.getPosition(Edge.Left)).toEqual(pt(40));
  });

  it('does not crash when position properties are undefined', () => {
    expect(() => applyStyle(node, {})).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 7. Border
// ---------------------------------------------------------------------------
describe('border', () => {
  it('applies borderWidth (all edges)', () => {
    applyStyle(node, { borderWidth: 2 });
    expect(node.getBorder(Edge.All)).toBe(2);
  });

  it('applies borderTopWidth', () => {
    applyStyle(node, { borderTopWidth: 1 });
    expect(node.getBorder(Edge.Top)).toBe(1);
  });

  it('applies borderRightWidth', () => {
    applyStyle(node, { borderRightWidth: 3 });
    expect(node.getBorder(Edge.Right)).toBe(3);
  });

  it('applies borderBottomWidth', () => {
    applyStyle(node, { borderBottomWidth: 4 });
    expect(node.getBorder(Edge.Bottom)).toBe(4);
  });

  it('applies borderLeftWidth', () => {
    applyStyle(node, { borderLeftWidth: 5 });
    expect(node.getBorder(Edge.Left)).toBe(5);
  });

  it('does not crash when border properties are undefined', () => {
    expect(() => applyStyle(node, {})).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 8. Display and Overflow
// ---------------------------------------------------------------------------
describe('display', () => {
  it('applies display - flex', () => {
    // Set to none first, then back to flex, to prove the setter runs
    applyStyle(node, { display: 'none' });
    expect(node.getDisplay()).toBe(Display.None);
    applyStyle(node, { display: 'flex' });
    expect(node.getDisplay()).toBe(Display.Flex);
  });

  it('applies display - none', () => {
    applyStyle(node, { display: 'none' });
    expect(node.getDisplay()).toBe(Display.None);
  });
});

describe('overflow', () => {
  it('applies overflow - visible', () => {
    applyStyle(node, { overflow: 'visible' });
    expect(node.getOverflow()).toBe(Overflow.Visible);
  });

  it('applies overflow - hidden', () => {
    applyStyle(node, { overflow: 'hidden' });
    expect(node.getOverflow()).toBe(Overflow.Hidden);
  });

  it('applies overflow - scroll', () => {
    applyStyle(node, { overflow: 'scroll' });
    expect(node.getOverflow()).toBe(Overflow.Scroll);
  });
});

// ---------------------------------------------------------------------------
// 9. Gap
// ---------------------------------------------------------------------------
describe('gap', () => {
  it('applies gap (all gutters)', () => {
    applyStyle(node, { gap: 10 });
    expect(node.getGap(Gutter.All)).toBe(10);
  });

  it('applies rowGap', () => {
    applyStyle(node, { rowGap: 8 });
    expect(node.getGap(Gutter.Row)).toBe(8);
  });

  it('applies columnGap', () => {
    applyStyle(node, { columnGap: 12 });
    expect(node.getGap(Gutter.Column)).toBe(12);
  });

  it('does not crash when gap properties are undefined', () => {
    expect(() => applyStyle(node, {})).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 10. Combined / edge cases
// ---------------------------------------------------------------------------
describe('combined styles', () => {
  it('applies multiple style properties in a single call', () => {
    applyStyle(node, {
      width: 200,
      height: 100,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      margin: 8,
      gap: 4,
    });

    expect(node.getWidth()).toEqual(pt(200));
    expect(node.getHeight()).toEqual(pt(100));
    expect(node.getFlexDirection()).toBe(FlexDirection.Row);
    expect(node.getJustifyContent()).toBe(Justify.SpaceBetween);
    expect(node.getAlignItems()).toBe(Align.Center);
    expect(node.getPadding(Edge.All)).toEqual(pt(16));
    expect(node.getMargin(Edge.All)).toEqual(pt(8));
    expect(node.getGap(Gutter.All)).toBe(4);
  });

  it('ignores style properties not handled by applyStyle (e.g. color)', () => {
    // These properties exist on the Style type but are not Yoga properties.
    // applyStyle should simply not crash.
    expect(() =>
      applyStyle(node, {
        backgroundColor: '#ff0000',
        color: '#000',
        fontSize: 16,
        borderRadius: 8,
        opacity: 0.5,
      })
    ).not.toThrow();
  });

  it('handles an empty style object', () => {
    expect(() => applyStyle(node, {})).not.toThrow();
  });

  it('applies zero values correctly', () => {
    applyStyle(node, {
      width: 0,
      height: 0,
      padding: 0,
      margin: 0,
      flexGrow: 0,
      flexShrink: 0,
      borderWidth: 0,
      gap: 0,
    });

    expect(node.getWidth()).toEqual(pt(0));
    expect(node.getHeight()).toEqual(pt(0));
    expect(node.getPadding(Edge.All)).toEqual(pt(0));
    expect(node.getMargin(Edge.All)).toEqual(pt(0));
    expect(node.getFlexGrow()).toBe(0);
    expect(node.getFlexShrink()).toBe(0);
    expect(node.getBorder(Edge.All)).toBe(0);
    expect(node.getGap(Gutter.All)).toBe(0);
  });
});
