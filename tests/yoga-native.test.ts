import { describe, test, expect, beforeEach, mock } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock the __yoga bridge before importing the module under test.
// We use a factory that returns fresh mocks per test via beforeEach.
// ---------------------------------------------------------------------------

let nodeIdCounter = 0;

const mockYoga: Record<string, any> = {
  nodeNew: () => ++nodeIdCounter,
  nodeFreeRecursive: mock(() => {}),
  nodeInsertChild: mock(() => {}),
  nodeRemoveChild: mock(() => {}),
  nodeCalculateLayout: mock(() => {}),
  nodeLayoutGetLeft: mock(() => 10),
  nodeLayoutGetRight: mock(() => 20),
  nodeLayoutGetTop: mock(() => 30),
  nodeLayoutGetBottom: mock(() => 40),
  nodeLayoutGetWidth: mock(() => 100),
  nodeLayoutGetHeight: mock(() => 50),
  nodeMarkDirty: mock(() => {}),
  enableMeasure: mock(() => {}),
  enableMeasureNative: mock(() => {}),
  updateMeasureText: mock(() => {}),
  nodeStyleSetDirection: mock(() => {}),
  nodeStyleSetFlexDirection: mock(() => {}),
  nodeStyleSetJustifyContent: mock(() => {}),
  nodeStyleSetAlignContent: mock(() => {}),
  nodeStyleSetAlignItems: mock(() => {}),
  nodeStyleSetAlignSelf: mock(() => {}),
  nodeStyleSetPositionType: mock(() => {}),
  nodeStyleSetFlexWrap: mock(() => {}),
  nodeStyleSetOverflow: mock(() => {}),
  nodeStyleSetDisplay: mock(() => {}),
  nodeStyleSetFlex: mock(() => {}),
  nodeStyleSetFlexGrow: mock(() => {}),
  nodeStyleSetFlexShrink: mock(() => {}),
  nodeStyleSetFlexBasis: mock(() => {}),
  nodeStyleSetFlexBasisPercent: mock(() => {}),
  nodeStyleSetFlexBasisAuto: mock(() => {}),
  nodeStyleSetWidth: mock(() => {}),
  nodeStyleSetWidthPercent: mock(() => {}),
  nodeStyleSetWidthAuto: mock(() => {}),
  nodeStyleSetHeight: mock(() => {}),
  nodeStyleSetHeightPercent: mock(() => {}),
  nodeStyleSetHeightAuto: mock(() => {}),
  nodeStyleSetMinWidth: mock(() => {}),
  nodeStyleSetMinWidthPercent: mock(() => {}),
  nodeStyleSetMinHeight: mock(() => {}),
  nodeStyleSetMinHeightPercent: mock(() => {}),
  nodeStyleSetMaxWidth: mock(() => {}),
  nodeStyleSetMaxWidthPercent: mock(() => {}),
  nodeStyleSetMaxHeight: mock(() => {}),
  nodeStyleSetMaxHeightPercent: mock(() => {}),
  nodeStyleSetPosition: mock(() => {}),
  nodeStyleSetPositionPercent: mock(() => {}),
  nodeStyleSetMargin: mock(() => {}),
  nodeStyleSetMarginPercent: mock(() => {}),
  nodeStyleSetMarginAuto: mock(() => {}),
  nodeStyleSetPadding: mock(() => {}),
  nodeStyleSetPaddingPercent: mock(() => {}),
  nodeStyleSetBorder: mock(() => {}),
  nodeStyleSetGap: mock(() => {}),
};

(globalThis as any).__yoga = mockYoga;

// Now import the module under test — it reads __yoga at module level
import Yoga, {
  Direction,
  Edge,
  Align,
  FlexDirection,
  Justify,
  Display,
  Overflow,
  PositionType,
  Wrap,
  Gutter,
  Unit,
  MeasureMode,
  BoxSizing,
  Dimension,
  Errata,
  LogLevel,
  NodeType,
  ExperimentalFeature,
} from '../src/yoga-native';

// Helper to reset all mock call counts between tests
function resetMocks() {
  for (const key of Object.keys(mockYoga)) {
    if (typeof mockYoga[key]?.mockClear === 'function') {
      mockYoga[key].mockClear();
    }
  }
}

beforeEach(() => {
  resetMocks();
});

// ---------------------------------------------------------------------------
// Enum values
// ---------------------------------------------------------------------------

describe('Enum values match yoga-layout', () => {
  test('Direction', () => {
    expect(Direction.Inherit).toBe(0);
    expect(Direction.LTR).toBe(1);
    expect(Direction.RTL).toBe(2);
  });

  test('Edge', () => {
    expect(Edge.Left).toBe(0);
    expect(Edge.Top).toBe(1);
    expect(Edge.Right).toBe(2);
    expect(Edge.Bottom).toBe(3);
    expect(Edge.Start).toBe(4);
    expect(Edge.End).toBe(5);
    expect(Edge.Horizontal).toBe(6);
    expect(Edge.Vertical).toBe(7);
    expect(Edge.All).toBe(8);
  });

  test('Align', () => {
    expect(Align.Auto).toBe(0);
    expect(Align.FlexStart).toBe(1);
    expect(Align.Center).toBe(2);
    expect(Align.FlexEnd).toBe(3);
    expect(Align.Stretch).toBe(4);
    expect(Align.Baseline).toBe(5);
    expect(Align.SpaceBetween).toBe(6);
    expect(Align.SpaceAround).toBe(7);
    expect(Align.SpaceEvenly).toBe(8);
  });

  test('FlexDirection', () => {
    expect(FlexDirection.Column).toBe(0);
    expect(FlexDirection.ColumnReverse).toBe(1);
    expect(FlexDirection.Row).toBe(2);
    expect(FlexDirection.RowReverse).toBe(3);
  });

  test('Justify', () => {
    expect(Justify.FlexStart).toBe(0);
    expect(Justify.Center).toBe(1);
    expect(Justify.FlexEnd).toBe(2);
    expect(Justify.SpaceBetween).toBe(3);
    expect(Justify.SpaceAround).toBe(4);
    expect(Justify.SpaceEvenly).toBe(5);
  });

  test('Display', () => {
    expect(Display.Flex).toBe(0);
    expect(Display.None).toBe(1);
    expect(Display.Contents).toBe(2);
  });

  test('Overflow', () => {
    expect(Overflow.Visible).toBe(0);
    expect(Overflow.Hidden).toBe(1);
    expect(Overflow.Scroll).toBe(2);
  });

  test('PositionType', () => {
    expect(PositionType.Static).toBe(0);
    expect(PositionType.Relative).toBe(1);
    expect(PositionType.Absolute).toBe(2);
  });

  test('Wrap', () => {
    expect(Wrap.NoWrap).toBe(0);
    expect(Wrap.Wrap).toBe(1);
    expect(Wrap.WrapReverse).toBe(2);
  });

  test('Gutter', () => {
    expect(Gutter.Column).toBe(0);
    expect(Gutter.Row).toBe(1);
    expect(Gutter.All).toBe(2);
  });

  test('Unit', () => {
    expect(Unit.Undefined).toBe(0);
    expect(Unit.Point).toBe(1);
    expect(Unit.Percent).toBe(2);
    expect(Unit.Auto).toBe(3);
  });

  test('MeasureMode', () => {
    expect(MeasureMode.Undefined).toBe(0);
    expect(MeasureMode.Exactly).toBe(1);
    expect(MeasureMode.AtMost).toBe(2);
  });

  test('BoxSizing', () => {
    expect(BoxSizing.BorderBox).toBe(0);
    expect(BoxSizing.ContentBox).toBe(1);
  });

  test('Dimension', () => {
    expect(Dimension.Width).toBe(0);
    expect(Dimension.Height).toBe(1);
  });

  test('Errata', () => {
    expect(Errata.None).toBe(0);
    expect(Errata.StretchFlexBasis).toBe(1);
    expect(Errata.All).toBe(2147483647);
    expect(Errata.Classic).toBe(2147483646);
  });

  test('LogLevel', () => {
    expect(LogLevel.Error).toBe(0);
    expect(LogLevel.Warn).toBe(1);
    expect(LogLevel.Info).toBe(2);
    expect(LogLevel.Debug).toBe(3);
    expect(LogLevel.Verbose).toBe(4);
    expect(LogLevel.Fatal).toBe(5);
  });

  test('NodeType', () => {
    expect(NodeType.Default).toBe(0);
    expect(NodeType.Text).toBe(1);
  });

  test('ExperimentalFeature', () => {
    expect(ExperimentalFeature.WebFlexBasis).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Node creation
// ---------------------------------------------------------------------------

describe('Node.create()', () => {
  test('calls __yoga.nodeNew and returns a NativeNode', () => {
    const node = Yoga.Node.create();
    expect(node).toBeDefined();
    expect(typeof node._id).toBe('number');
    expect(node._id).toBeGreaterThan(0);
  });

  test('createDefault returns a NativeNode', () => {
    const node = Yoga.Node.createDefault();
    expect(node).toBeDefined();
    expect(typeof node._id).toBe('number');
  });

  test('createWithConfig returns a NativeNode', () => {
    const config = Yoga.Config.create();
    const node = Yoga.Node.createWithConfig(config);
    expect(node).toBeDefined();
    expect(typeof node._id).toBe('number');
  });

  test('Node.destroy calls free on node', () => {
    const node = Yoga.Node.create();
    // Should not throw
    Yoga.Node.destroy(node);
  });
});

// ---------------------------------------------------------------------------
// Dimension setters: width
// ---------------------------------------------------------------------------

describe('setWidth', () => {
  test('numeric value calls nodeStyleSetWidth', () => {
    const node = Yoga.Node.create();
    node.setWidth(100);
    expect(mockYoga.nodeStyleSetWidth).toHaveBeenCalledWith(node._id, 100);
  });

  test('percent string calls nodeStyleSetWidthPercent', () => {
    const node = Yoga.Node.create();
    node.setWidth('50%' as any);
    expect(mockYoga.nodeStyleSetWidthPercent).toHaveBeenCalledWith(node._id, 50);
  });

  test('"auto" calls nodeStyleSetWidthAuto', () => {
    const node = Yoga.Node.create();
    node.setWidth('auto');
    expect(mockYoga.nodeStyleSetWidthAuto).toHaveBeenCalledWith(node._id);
  });

  test('undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setWidth(undefined);
    expect(mockYoga.nodeStyleSetWidth).not.toHaveBeenCalled();
    expect(mockYoga.nodeStyleSetWidthPercent).not.toHaveBeenCalled();
    expect(mockYoga.nodeStyleSetWidthAuto).not.toHaveBeenCalled();
  });

  test('setWidthPercent calls nodeStyleSetWidthPercent', () => {
    const node = Yoga.Node.create();
    node.setWidthPercent(75);
    expect(mockYoga.nodeStyleSetWidthPercent).toHaveBeenCalledWith(node._id, 75);
  });

  test('setWidthAuto calls nodeStyleSetWidthAuto', () => {
    const node = Yoga.Node.create();
    node.setWidthAuto();
    expect(mockYoga.nodeStyleSetWidthAuto).toHaveBeenCalledWith(node._id);
  });
});

// ---------------------------------------------------------------------------
// Dimension setters: height
// ---------------------------------------------------------------------------

describe('setHeight', () => {
  test('numeric value calls nodeStyleSetHeight', () => {
    const node = Yoga.Node.create();
    node.setHeight(200);
    expect(mockYoga.nodeStyleSetHeight).toHaveBeenCalledWith(node._id, 200);
  });

  test('percent string calls nodeStyleSetHeightPercent', () => {
    const node = Yoga.Node.create();
    node.setHeight('75%' as any);
    expect(mockYoga.nodeStyleSetHeightPercent).toHaveBeenCalledWith(node._id, 75);
  });

  test('"auto" calls nodeStyleSetHeightAuto', () => {
    const node = Yoga.Node.create();
    node.setHeight('auto');
    expect(mockYoga.nodeStyleSetHeightAuto).toHaveBeenCalledWith(node._id);
  });

  test('undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setHeight(undefined);
    expect(mockYoga.nodeStyleSetHeight).not.toHaveBeenCalled();
    expect(mockYoga.nodeStyleSetHeightPercent).not.toHaveBeenCalled();
    expect(mockYoga.nodeStyleSetHeightAuto).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Dimension setters: flexBasis
// ---------------------------------------------------------------------------

describe('setFlexBasis', () => {
  test('numeric value calls nodeStyleSetFlexBasis', () => {
    const node = Yoga.Node.create();
    node.setFlexBasis(50);
    expect(mockYoga.nodeStyleSetFlexBasis).toHaveBeenCalledWith(node._id, 50);
  });

  test('percent string calls nodeStyleSetFlexBasisPercent', () => {
    const node = Yoga.Node.create();
    node.setFlexBasis('30%' as any);
    expect(mockYoga.nodeStyleSetFlexBasisPercent).toHaveBeenCalledWith(node._id, 30);
  });

  test('"auto" calls nodeStyleSetFlexBasisAuto', () => {
    const node = Yoga.Node.create();
    node.setFlexBasis('auto');
    expect(mockYoga.nodeStyleSetFlexBasisAuto).toHaveBeenCalledWith(node._id);
  });

  test('undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setFlexBasis(undefined);
    expect(mockYoga.nodeStyleSetFlexBasis).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Min/Max dimension setters
// ---------------------------------------------------------------------------

describe('setMinWidth / setMinHeight / setMaxWidth / setMaxHeight', () => {
  test('setMinWidth numeric', () => {
    const node = Yoga.Node.create();
    node.setMinWidth(50);
    expect(mockYoga.nodeStyleSetMinWidth).toHaveBeenCalledWith(node._id, 50);
  });

  test('setMinWidth percent', () => {
    const node = Yoga.Node.create();
    node.setMinWidth('25%' as any);
    expect(mockYoga.nodeStyleSetMinWidthPercent).toHaveBeenCalledWith(node._id, 25);
  });

  test('setMinHeight numeric', () => {
    const node = Yoga.Node.create();
    node.setMinHeight(30);
    expect(mockYoga.nodeStyleSetMinHeight).toHaveBeenCalledWith(node._id, 30);
  });

  test('setMaxWidth numeric', () => {
    const node = Yoga.Node.create();
    node.setMaxWidth(500);
    expect(mockYoga.nodeStyleSetMaxWidth).toHaveBeenCalledWith(node._id, 500);
  });

  test('setMaxHeight percent', () => {
    const node = Yoga.Node.create();
    node.setMaxHeight('80%' as any);
    expect(mockYoga.nodeStyleSetMaxHeightPercent).toHaveBeenCalledWith(node._id, 80);
  });

  test('undefined does nothing for all min/max setters', () => {
    const node = Yoga.Node.create();
    node.setMinWidth(undefined);
    node.setMinHeight(undefined);
    node.setMaxWidth(undefined);
    node.setMaxHeight(undefined);
    expect(mockYoga.nodeStyleSetMinWidth).not.toHaveBeenCalled();
    expect(mockYoga.nodeStyleSetMinHeight).not.toHaveBeenCalled();
    expect(mockYoga.nodeStyleSetMaxWidth).not.toHaveBeenCalled();
    expect(mockYoga.nodeStyleSetMaxHeight).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tree operations: insertChild / removeChild
// ---------------------------------------------------------------------------

describe('insertChild / removeChild', () => {
  test('insertChild updates local children and calls bridge', () => {
    const parent = Yoga.Node.create();
    const child = Yoga.Node.create();
    parent.insertChild(child, 0);

    expect(mockYoga.nodeInsertChild).toHaveBeenCalledWith(parent._id, child._id, 0);
    expect(parent.getChildCount()).toBe(1);
    expect(parent.getChild(0)).toBe(child);
  });

  test('removeChild updates local children and calls bridge', () => {
    const parent = Yoga.Node.create();
    const child = Yoga.Node.create();
    parent.insertChild(child, 0);
    resetMocks();

    parent.removeChild(child);

    expect(mockYoga.nodeRemoveChild).toHaveBeenCalledWith(parent._id, child._id);
    expect(parent.getChildCount()).toBe(0);
  });

  test('insertChild at specific index', () => {
    const parent = Yoga.Node.create();
    const child1 = Yoga.Node.create();
    const child2 = Yoga.Node.create();
    const child3 = Yoga.Node.create();

    parent.insertChild(child1, 0);
    parent.insertChild(child2, 1);
    parent.insertChild(child3, 1); // insert in the middle

    expect(parent.getChildCount()).toBe(3);
    expect(parent.getChild(0)).toBe(child1);
    expect(parent.getChild(1)).toBe(child3);
    expect(parent.getChild(2)).toBe(child2);
  });

  test('removeChild of non-child does nothing', () => {
    const parent = Yoga.Node.create();
    const notChild = Yoga.Node.create();

    parent.removeChild(notChild);
    expect(mockYoga.nodeRemoveChild).not.toHaveBeenCalled();
  });

  test('insertChild re-parents from old parent', () => {
    const parent1 = Yoga.Node.create();
    const parent2 = Yoga.Node.create();
    const child = Yoga.Node.create();

    parent1.insertChild(child, 0);
    expect(parent1.getChildCount()).toBe(1);

    parent2.insertChild(child, 0);
    expect(parent1.getChildCount()).toBe(0);
    expect(parent2.getChildCount()).toBe(1);
    expect(child.getParent()).toBe(parent2);
  });
});

// ---------------------------------------------------------------------------
// getParent
// ---------------------------------------------------------------------------

describe('getParent', () => {
  test('returns null when no parent', () => {
    const node = Yoga.Node.create();
    expect(node.getParent()).toBeNull();
  });

  test('returns parent after insertion', () => {
    const parent = Yoga.Node.create();
    const child = Yoga.Node.create();
    parent.insertChild(child, 0);
    expect(child.getParent()).toBe(parent);
  });

  test('returns null after removal', () => {
    const parent = Yoga.Node.create();
    const child = Yoga.Node.create();
    parent.insertChild(child, 0);
    parent.removeChild(child);
    expect(child.getParent()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Measure function
// ---------------------------------------------------------------------------

describe('setMeasureFunc', () => {
  test('stores function and calls enableMeasure', () => {
    const node = Yoga.Node.create();
    const fn = () => ({ width: 42, height: 18 });
    node.setMeasureFunc(fn);
    expect(mockYoga.enableMeasure).toHaveBeenCalledWith(node._id);
  });

  test('setting null removes the measure function', () => {
    const node = Yoga.Node.create();
    const fn = () => ({ width: 42, height: 18 });
    node.setMeasureFunc(fn);
    node.setMeasureFunc(null);

    // After removal, __yoga_measure should return default
    const result = (globalThis as any).__yoga_measure(node._id, 100, 1, 50, 1);
    expect(result).toEqual({ width: 0, height: 0 });
  });

  test('unsetMeasureFunc removes the measure function', () => {
    const node = Yoga.Node.create();
    const fn = () => ({ width: 42, height: 18 });
    node.setMeasureFunc(fn);
    node.unsetMeasureFunc();

    const result = (globalThis as any).__yoga_measure(node._id, 100, 1, 50, 1);
    expect(result).toEqual({ width: 0, height: 0 });
  });
});

// ---------------------------------------------------------------------------
// __yoga_measure global
// ---------------------------------------------------------------------------

describe('__yoga_measure global', () => {
  test('dispatches to stored measure function', () => {
    const node = Yoga.Node.create();
    const fn = mock((w: number, wm: number, h: number, hm: number) => ({
      width: w * 2,
      height: h * 2,
    }));
    node.setMeasureFunc(fn);

    const result = (globalThis as any).__yoga_measure(node._id, 100, MeasureMode.Exactly, 50, MeasureMode.AtMost);
    expect(fn).toHaveBeenCalledWith(100, MeasureMode.Exactly, 50, MeasureMode.AtMost);
    expect(result).toEqual({ width: 200, height: 100 });
  });

  test('returns {0,0} for unknown node', () => {
    const result = (globalThis as any).__yoga_measure(999999, 100, 1, 50, 1);
    expect(result).toEqual({ width: 0, height: 0 });
  });
});

// ---------------------------------------------------------------------------
// calculateLayout
// ---------------------------------------------------------------------------

describe('calculateLayout', () => {
  test('calls __yoga.nodeCalculateLayout with numeric values', () => {
    const node = Yoga.Node.create();
    node.calculateLayout(390, 844, Direction.LTR);
    expect(mockYoga.nodeCalculateLayout).toHaveBeenCalledWith(node._id, 390, 844, Direction.LTR);
  });

  test('"auto" width/height are passed as NaN', () => {
    const node = Yoga.Node.create();
    node.calculateLayout('auto', 'auto', Direction.LTR);
    const call = mockYoga.nodeCalculateLayout.mock.calls[0];
    expect(call[0]).toBe(node._id);
    expect(Number.isNaN(call[1])).toBe(true);
    expect(Number.isNaN(call[2])).toBe(true);
    expect(call[3]).toBe(Direction.LTR);
  });

  test('undefined width/height are passed as NaN', () => {
    const node = Yoga.Node.create();
    node.calculateLayout(undefined, undefined);
    const call = mockYoga.nodeCalculateLayout.mock.calls[0];
    expect(Number.isNaN(call[1])).toBe(true);
    expect(Number.isNaN(call[2])).toBe(true);
  });

  test('default direction is LTR', () => {
    const node = Yoga.Node.create();
    node.calculateLayout(100, 100);
    const call = mockYoga.nodeCalculateLayout.mock.calls[0];
    expect(call[3]).toBe(Direction.LTR);
  });

  test('sets hasNewLayout to true', () => {
    const node = Yoga.Node.create();
    expect(node.hasNewLayout()).toBe(false);
    node.calculateLayout(100, 100);
    expect(node.hasNewLayout()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getComputedLayout
// ---------------------------------------------------------------------------

describe('getComputedLayout', () => {
  test('returns layout from bridge getters', () => {
    const node = Yoga.Node.create();
    const layout = node.getComputedLayout();
    expect(layout).toEqual({
      left: 10,
      right: 20,
      top: 30,
      bottom: 40,
      width: 100,
      height: 50,
    });
    expect(mockYoga.nodeLayoutGetLeft).toHaveBeenCalledWith(node._id);
    expect(mockYoga.nodeLayoutGetRight).toHaveBeenCalledWith(node._id);
    expect(mockYoga.nodeLayoutGetTop).toHaveBeenCalledWith(node._id);
    expect(mockYoga.nodeLayoutGetBottom).toHaveBeenCalledWith(node._id);
    expect(mockYoga.nodeLayoutGetWidth).toHaveBeenCalledWith(node._id);
    expect(mockYoga.nodeLayoutGetHeight).toHaveBeenCalledWith(node._id);
  });

  test('individual computed getters', () => {
    const node = Yoga.Node.create();
    expect(node.getComputedLeft()).toBe(10);
    expect(node.getComputedRight()).toBe(20);
    expect(node.getComputedTop()).toBe(30);
    expect(node.getComputedBottom()).toBe(40);
    expect(node.getComputedWidth()).toBe(100);
    expect(node.getComputedHeight()).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// freeRecursive
// ---------------------------------------------------------------------------

describe('freeRecursive', () => {
  test('cleans up children recursively', () => {
    const root = Yoga.Node.create();
    const child1 = Yoga.Node.create();
    const child2 = Yoga.Node.create();
    const grandchild = Yoga.Node.create();

    root.insertChild(child1, 0);
    root.insertChild(child2, 1);
    child1.insertChild(grandchild, 0);

    resetMocks();
    root.freeRecursive();

    // Bridge was called for each node in the tree
    // freeRecursive calls __yoga.nodeFreeRecursive on itself after recursing children
    expect(mockYoga.nodeFreeRecursive).toHaveBeenCalledWith(grandchild._id);
    expect(mockYoga.nodeFreeRecursive).toHaveBeenCalledWith(child1._id);
    expect(mockYoga.nodeFreeRecursive).toHaveBeenCalledWith(child2._id);
    expect(mockYoga.nodeFreeRecursive).toHaveBeenCalledWith(root._id);
  });

  test('freeRecursive removes measure funcs', () => {
    const node = Yoga.Node.create();
    node.setMeasureFunc(() => ({ width: 10, height: 10 }));
    node.freeRecursive();

    const result = (globalThis as any).__yoga_measure(node._id, 100, 1, 50, 1);
    expect(result).toEqual({ width: 0, height: 0 });
  });
});

// ---------------------------------------------------------------------------
// Dirty / layout state
// ---------------------------------------------------------------------------

describe('dirty / layout state', () => {
  test('markDirty sets isDirty and calls bridge', () => {
    const node = Yoga.Node.create();
    expect(node.isDirty()).toBe(false);
    node.markDirty();
    expect(node.isDirty()).toBe(true);
    expect(mockYoga.nodeMarkDirty).toHaveBeenCalledWith(node._id);
  });

  test('markLayoutSeen clears hasNewLayout', () => {
    const node = Yoga.Node.create();
    node.calculateLayout(100, 100);
    expect(node.hasNewLayout()).toBe(true);
    node.markLayoutSeen();
    expect(node.hasNewLayout()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Enum-style setters
// ---------------------------------------------------------------------------

describe('enum-style setters', () => {
  test('setDirection', () => {
    const node = Yoga.Node.create();
    node.setDirection(Direction.RTL);
    expect(mockYoga.nodeStyleSetDirection).toHaveBeenCalledWith(node._id, Direction.RTL);
  });

  test('setFlexDirection', () => {
    const node = Yoga.Node.create();
    node.setFlexDirection(FlexDirection.Row);
    expect(mockYoga.nodeStyleSetFlexDirection).toHaveBeenCalledWith(node._id, FlexDirection.Row);
  });

  test('setJustifyContent', () => {
    const node = Yoga.Node.create();
    node.setJustifyContent(Justify.Center);
    expect(mockYoga.nodeStyleSetJustifyContent).toHaveBeenCalledWith(node._id, Justify.Center);
  });

  test('setAlignContent', () => {
    const node = Yoga.Node.create();
    node.setAlignContent(Align.SpaceBetween);
    expect(mockYoga.nodeStyleSetAlignContent).toHaveBeenCalledWith(node._id, Align.SpaceBetween);
  });

  test('setAlignItems', () => {
    const node = Yoga.Node.create();
    node.setAlignItems(Align.Center);
    expect(mockYoga.nodeStyleSetAlignItems).toHaveBeenCalledWith(node._id, Align.Center);
  });

  test('setAlignSelf', () => {
    const node = Yoga.Node.create();
    node.setAlignSelf(Align.FlexEnd);
    expect(mockYoga.nodeStyleSetAlignSelf).toHaveBeenCalledWith(node._id, Align.FlexEnd);
  });

  test('setPositionType', () => {
    const node = Yoga.Node.create();
    node.setPositionType(PositionType.Absolute);
    expect(mockYoga.nodeStyleSetPositionType).toHaveBeenCalledWith(node._id, PositionType.Absolute);
  });

  test('setFlexWrap', () => {
    const node = Yoga.Node.create();
    node.setFlexWrap(Wrap.Wrap);
    expect(mockYoga.nodeStyleSetFlexWrap).toHaveBeenCalledWith(node._id, Wrap.Wrap);
  });

  test('setOverflow', () => {
    const node = Yoga.Node.create();
    node.setOverflow(Overflow.Hidden);
    expect(mockYoga.nodeStyleSetOverflow).toHaveBeenCalledWith(node._id, Overflow.Hidden);
  });

  test('setDisplay', () => {
    const node = Yoga.Node.create();
    node.setDisplay(Display.None);
    expect(mockYoga.nodeStyleSetDisplay).toHaveBeenCalledWith(node._id, Display.None);
  });
});

// ---------------------------------------------------------------------------
// Numeric setters
// ---------------------------------------------------------------------------

describe('numeric setters', () => {
  test('setFlex', () => {
    const node = Yoga.Node.create();
    node.setFlex(1);
    expect(mockYoga.nodeStyleSetFlex).toHaveBeenCalledWith(node._id, 1);
  });

  test('setFlex undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setFlex(undefined);
    expect(mockYoga.nodeStyleSetFlex).not.toHaveBeenCalled();
  });

  test('setFlexGrow', () => {
    const node = Yoga.Node.create();
    node.setFlexGrow(2);
    expect(mockYoga.nodeStyleSetFlexGrow).toHaveBeenCalledWith(node._id, 2);
  });

  test('setFlexGrow undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setFlexGrow(undefined);
    expect(mockYoga.nodeStyleSetFlexGrow).not.toHaveBeenCalled();
  });

  test('setFlexShrink', () => {
    const node = Yoga.Node.create();
    node.setFlexShrink(0);
    expect(mockYoga.nodeStyleSetFlexShrink).toHaveBeenCalledWith(node._id, 0);
  });

  test('setFlexShrink undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setFlexShrink(undefined);
    expect(mockYoga.nodeStyleSetFlexShrink).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Edge-based setters
// ---------------------------------------------------------------------------

describe('edge-based setters', () => {
  test('setPosition numeric', () => {
    const node = Yoga.Node.create();
    node.setPosition(Edge.Top, 10);
    expect(mockYoga.nodeStyleSetPosition).toHaveBeenCalledWith(node._id, Edge.Top, 10);
  });

  test('setPosition percent', () => {
    const node = Yoga.Node.create();
    node.setPosition(Edge.Left, '20%' as any);
    expect(mockYoga.nodeStyleSetPositionPercent).toHaveBeenCalledWith(node._id, Edge.Left, 20);
  });

  test('setPosition undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setPosition(Edge.Top, undefined);
    expect(mockYoga.nodeStyleSetPosition).not.toHaveBeenCalled();
  });

  test('setMargin numeric', () => {
    const node = Yoga.Node.create();
    node.setMargin(Edge.All, 16);
    expect(mockYoga.nodeStyleSetMargin).toHaveBeenCalledWith(node._id, Edge.All, 16);
  });

  test('setMargin auto', () => {
    const node = Yoga.Node.create();
    node.setMargin(Edge.Horizontal, 'auto');
    expect(mockYoga.nodeStyleSetMarginAuto).toHaveBeenCalledWith(node._id, Edge.Horizontal);
  });

  test('setMargin percent', () => {
    const node = Yoga.Node.create();
    node.setMargin(Edge.Top, '10%');
    expect(mockYoga.nodeStyleSetMarginPercent).toHaveBeenCalledWith(node._id, Edge.Top, 10);
  });

  test('setMarginAuto', () => {
    const node = Yoga.Node.create();
    node.setMarginAuto(Edge.Left);
    expect(mockYoga.nodeStyleSetMarginAuto).toHaveBeenCalledWith(node._id, Edge.Left);
  });

  test('setPadding numeric', () => {
    const node = Yoga.Node.create();
    node.setPadding(Edge.All, 8);
    expect(mockYoga.nodeStyleSetPadding).toHaveBeenCalledWith(node._id, Edge.All, 8);
  });

  test('setPadding percent', () => {
    const node = Yoga.Node.create();
    node.setPadding(Edge.Top, '5%' as any);
    expect(mockYoga.nodeStyleSetPaddingPercent).toHaveBeenCalledWith(node._id, Edge.Top, 5);
  });

  test('setBorder', () => {
    const node = Yoga.Node.create();
    node.setBorder(Edge.All, 2);
    expect(mockYoga.nodeStyleSetBorder).toHaveBeenCalledWith(node._id, Edge.All, 2);
  });

  test('setBorder undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setBorder(Edge.All, undefined);
    expect(mockYoga.nodeStyleSetBorder).not.toHaveBeenCalled();
  });

  test('setGap numeric', () => {
    const node = Yoga.Node.create();
    const result = node.setGap(Gutter.All, 10);
    expect(mockYoga.nodeStyleSetGap).toHaveBeenCalledWith(node._id, Gutter.All, 10);
    expect(result).toEqual({ unit: Unit.Point, value: 10 });
  });

  test('setGap percent', () => {
    const node = Yoga.Node.create();
    const result = node.setGap(Gutter.Row, '15%' as any);
    expect(mockYoga.nodeStyleSetGap).toHaveBeenCalledWith(node._id, Gutter.Row, 15);
    expect(result).toEqual({ unit: Unit.Percent, value: 15 });
  });

  test('setGap undefined returns Undefined unit', () => {
    const node = Yoga.Node.create();
    const result = node.setGap(Gutter.All, undefined);
    expect(mockYoga.nodeStyleSetGap).not.toHaveBeenCalled();
    expect(result).toEqual({ unit: Unit.Undefined, value: 0 });
  });
});

// ---------------------------------------------------------------------------
// Stub getters (return defaults)
// ---------------------------------------------------------------------------

describe('stub getters return defaults', () => {
  test('getters return expected defaults', () => {
    const node = Yoga.Node.create();
    expect(node.getAlignContent()).toBe(Align.FlexStart);
    expect(node.getAlignItems()).toBe(Align.Stretch);
    expect(node.getAlignSelf()).toBe(Align.Auto);
    expect(Number.isNaN(node.getAspectRatio())).toBe(true);
    expect(node.getBorder(Edge.All)).toBe(0);
    expect(node.getComputedBorder(Edge.All)).toBe(0);
    expect(node.getComputedMargin(Edge.All)).toBe(0);
    expect(node.getComputedPadding(Edge.All)).toBe(0);
    expect(node.getDirection()).toBe(Direction.LTR);
    expect(node.getDisplay()).toBe(Display.Flex);
    expect(node.getFlexBasis()).toEqual({ unit: Unit.Auto, value: 0 });
    expect(node.getFlexDirection()).toBe(FlexDirection.Column);
    expect(node.getFlexGrow()).toBe(0);
    expect(node.getFlexShrink()).toBe(1);
    expect(node.getFlexWrap()).toBe(Wrap.NoWrap);
    expect(node.getHeight()).toEqual({ unit: Unit.Auto, value: 0 });
    expect(node.getJustifyContent()).toBe(Justify.FlexStart);
    expect(node.getOverflow()).toBe(Overflow.Visible);
    expect(node.getPositionType()).toBe(PositionType.Relative);
    expect(node.getBoxSizing()).toBe(BoxSizing.BorderBox);
    expect(node.getWidth()).toEqual({ unit: Unit.Auto, value: 0 });
    expect(node.isReferenceBaseline()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

describe('Config', () => {
  test('Config.create returns a config', () => {
    const config = Yoga.Config.create();
    expect(config).toBeDefined();
    expect(config.isExperimentalFeatureEnabled(ExperimentalFeature.WebFlexBasis)).toBe(false);
    expect(config.getErrata()).toBe(Errata.None);
    expect(config.useWebDefaults()).toBe(false);
  });

  test('Config stubs do not throw', () => {
    const config = Yoga.Config.create();
    config.free();
    config.setExperimentalFeatureEnabled(ExperimentalFeature.WebFlexBasis, true);
    config.setPointScaleFactor(2);
    config.setErrata(Errata.Classic);
    config.setUseWebDefaults(true);
    Yoga.Config.destroy(config);
  });
});

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe('reset', () => {
  test('clears local state', () => {
    const node = Yoga.Node.create();
    const child = Yoga.Node.create();
    node.insertChild(child, 0);
    node.markDirty();
    node.reset();
    expect(node.getChildCount()).toBe(0);
    expect(node.getParent()).toBeNull();
    expect(node.isDirty()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Default export Yoga constants
// ---------------------------------------------------------------------------

describe('Yoga default export constants', () => {
  test('direction constants', () => {
    expect(Yoga.DIRECTION_INHERIT).toBe(Direction.Inherit);
    expect(Yoga.DIRECTION_LTR).toBe(Direction.LTR);
    expect(Yoga.DIRECTION_RTL).toBe(Direction.RTL);
  });

  test('edge constants', () => {
    expect(Yoga.EDGE_LEFT).toBe(Edge.Left);
    expect(Yoga.EDGE_TOP).toBe(Edge.Top);
    expect(Yoga.EDGE_RIGHT).toBe(Edge.Right);
    expect(Yoga.EDGE_BOTTOM).toBe(Edge.Bottom);
    expect(Yoga.EDGE_ALL).toBe(Edge.All);
  });

  test('flex direction constants', () => {
    expect(Yoga.FLEX_DIRECTION_COLUMN).toBe(FlexDirection.Column);
    expect(Yoga.FLEX_DIRECTION_ROW).toBe(FlexDirection.Row);
  });

  test('justify constants', () => {
    expect(Yoga.JUSTIFY_CENTER).toBe(Justify.Center);
    expect(Yoga.JUSTIFY_SPACE_BETWEEN).toBe(Justify.SpaceBetween);
  });

  test('align constants', () => {
    expect(Yoga.ALIGN_CENTER).toBe(Align.Center);
    expect(Yoga.ALIGN_STRETCH).toBe(Align.Stretch);
  });
});

// ---------------------------------------------------------------------------
// enableMeasureNative / updateMeasureText
// ---------------------------------------------------------------------------

describe('enableMeasureNative / updateMeasureText', () => {
  test('enableMeasureNative calls bridge with text and font info', () => {
    const node = Yoga.Node.create();
    node.enableMeasureNative('hello', 14, 'system-ui', '400');
    expect(mockYoga.enableMeasureNative).toHaveBeenCalledWith(node._id, 'hello', 14, 'system-ui', '400');
  });

  test('updateMeasureText calls bridge with new text', () => {
    const node = Yoga.Node.create();
    node.updateMeasureText('world');
    expect(mockYoga.updateMeasureText).toHaveBeenCalledWith(node._id, 'world');
  });
});

// ---------------------------------------------------------------------------
// Percent and auto direct setters
// ---------------------------------------------------------------------------

describe('percent and auto direct setters', () => {
  test('setFlexBasisPercent calls bridge', () => {
    const node = Yoga.Node.create();
    node.setFlexBasisPercent(50);
    expect(mockYoga.nodeStyleSetFlexBasisPercent).toHaveBeenCalledWith(node._id, 50);
  });

  test('setFlexBasisPercent undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setFlexBasisPercent(undefined);
    expect(mockYoga.nodeStyleSetFlexBasisPercent).not.toHaveBeenCalled();
  });

  test('setFlexBasisAuto calls bridge', () => {
    const node = Yoga.Node.create();
    node.setFlexBasisAuto();
    expect(mockYoga.nodeStyleSetFlexBasisAuto).toHaveBeenCalledWith(node._id);
  });

  test('setHeightPercent calls bridge', () => {
    const node = Yoga.Node.create();
    node.setHeightPercent(75);
    expect(mockYoga.nodeStyleSetHeightPercent).toHaveBeenCalledWith(node._id, 75);
  });

  test('setHeightPercent undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setHeightPercent(undefined);
    expect(mockYoga.nodeStyleSetHeightPercent).not.toHaveBeenCalled();
  });

  test('setHeightAuto calls bridge', () => {
    const node = Yoga.Node.create();
    node.setHeightAuto();
    expect(mockYoga.nodeStyleSetHeightAuto).toHaveBeenCalledWith(node._id);
  });

  test('setMinWidthPercent calls bridge', () => {
    const node = Yoga.Node.create();
    node.setMinWidthPercent(30);
    expect(mockYoga.nodeStyleSetMinWidthPercent).toHaveBeenCalledWith(node._id, 30);
  });

  test('setMinWidthPercent undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setMinWidthPercent(undefined);
    expect(mockYoga.nodeStyleSetMinWidthPercent).not.toHaveBeenCalled();
  });

  test('setMinHeightPercent calls bridge', () => {
    const node = Yoga.Node.create();
    node.setMinHeightPercent(20);
    expect(mockYoga.nodeStyleSetMinHeightPercent).toHaveBeenCalledWith(node._id, 20);
  });

  test('setMinHeightPercent undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setMinHeightPercent(undefined);
    expect(mockYoga.nodeStyleSetMinHeightPercent).not.toHaveBeenCalled();
  });

  test('setMaxWidthPercent calls bridge', () => {
    const node = Yoga.Node.create();
    node.setMaxWidthPercent(90);
    expect(mockYoga.nodeStyleSetMaxWidthPercent).toHaveBeenCalledWith(node._id, 90);
  });

  test('setMaxWidthPercent undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setMaxWidthPercent(undefined);
    expect(mockYoga.nodeStyleSetMaxWidthPercent).not.toHaveBeenCalled();
  });

  test('setMaxHeightPercent calls bridge', () => {
    const node = Yoga.Node.create();
    node.setMaxHeightPercent(85);
    expect(mockYoga.nodeStyleSetMaxHeightPercent).toHaveBeenCalledWith(node._id, 85);
  });

  test('setMaxHeightPercent undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setMaxHeightPercent(undefined);
    expect(mockYoga.nodeStyleSetMaxHeightPercent).not.toHaveBeenCalled();
  });

  test('setPositionPercent calls bridge', () => {
    const node = Yoga.Node.create();
    node.setPositionPercent(Edge.Top, 15);
    expect(mockYoga.nodeStyleSetPositionPercent).toHaveBeenCalledWith(node._id, Edge.Top, 15);
  });

  test('setPositionPercent undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setPositionPercent(Edge.Top, undefined);
    expect(mockYoga.nodeStyleSetPositionPercent).not.toHaveBeenCalled();
  });

  test('setMarginPercent calls bridge', () => {
    const node = Yoga.Node.create();
    node.setMarginPercent(Edge.Left, 10);
    expect(mockYoga.nodeStyleSetMarginPercent).toHaveBeenCalledWith(node._id, Edge.Left, 10);
  });

  test('setMarginPercent undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setMarginPercent(Edge.Left, undefined);
    expect(mockYoga.nodeStyleSetMarginPercent).not.toHaveBeenCalled();
  });

  test('setPaddingPercent calls bridge', () => {
    const node = Yoga.Node.create();
    node.setPaddingPercent(Edge.All, 12);
    expect(mockYoga.nodeStyleSetPaddingPercent).toHaveBeenCalledWith(node._id, Edge.All, 12);
  });

  test('setPaddingPercent undefined does nothing', () => {
    const node = Yoga.Node.create();
    node.setPaddingPercent(Edge.All, undefined);
    expect(mockYoga.nodeStyleSetPaddingPercent).not.toHaveBeenCalled();
  });

  test('setGapPercent returns Undefined unit (stub)', () => {
    const node = Yoga.Node.create();
    const result = node.setGapPercent(Gutter.All, 10);
    expect(result).toEqual({ unit: Unit.Undefined, value: 0 });
  });

  test('setGapPercent undefined returns Undefined unit', () => {
    const node = Yoga.Node.create();
    const result = node.setGapPercent(Gutter.All, undefined);
    expect(result).toEqual({ unit: Unit.Undefined, value: 0 });
  });
});

// ---------------------------------------------------------------------------
// Additional percent branches in dimension setters via setXxx("N%")
// ---------------------------------------------------------------------------

describe('percent branches in min/max setters', () => {
  test('setMinHeight percent string calls nodeStyleSetMinHeightPercent', () => {
    const node = Yoga.Node.create();
    node.setMinHeight('40%' as any);
    expect(mockYoga.nodeStyleSetMinHeightPercent).toHaveBeenCalledWith(node._id, 40);
  });

  test('setMaxWidth percent string calls nodeStyleSetMaxWidthPercent', () => {
    const node = Yoga.Node.create();
    node.setMaxWidth('60%' as any);
    expect(mockYoga.nodeStyleSetMaxWidthPercent).toHaveBeenCalledWith(node._id, 60);
  });

  test('setMaxHeight numeric calls nodeStyleSetMaxHeight', () => {
    const node = Yoga.Node.create();
    node.setMaxHeight(300);
    expect(mockYoga.nodeStyleSetMaxHeight).toHaveBeenCalledWith(node._id, 300);
  });
});
