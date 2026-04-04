import { describe, it, expect, afterEach } from 'bun:test';
import { Yoga, applyStyleToNode } from '../src/layout/style-to-yoga';
import type { Node as YogaNode } from 'yoga-wasm-web/dist/wrapAsm';

describe('applyStyleToNode', () => {
  let yogaNode: YogaNode;

  afterEach(() => {
    if (yogaNode) {
      yogaNode.free();
    }
  });

  function createNode(): YogaNode {
    yogaNode = Yoga.Node.create();
    return yogaNode;
  }

  it('should set flex direction', () => {
    const n = createNode();
    applyStyleToNode(n, { flexDirection: 'column' });
    expect(n.getFlexDirection()).toBe(Yoga.FLEX_DIRECTION_COLUMN);
  });

  it('should set flex direction row-reverse', () => {
    const n = createNode();
    applyStyleToNode(n, { flexDirection: 'row-reverse' });
    expect(n.getFlexDirection()).toBe(Yoga.FLEX_DIRECTION_ROW_REVERSE);
  });

  it('should set flex wrap', () => {
    const n = createNode();
    applyStyleToNode(n, { flexWrap: 'wrap' });
    expect(n.getFlexWrap()).toBe(Yoga.WRAP_WRAP);
  });

  it('should set justify content', () => {
    const n = createNode();
    applyStyleToNode(n, { justifyContent: 'center' });
    expect(n.getJustifyContent()).toBe(Yoga.JUSTIFY_CENTER);
  });

  it('should set justify content space-evenly', () => {
    const n = createNode();
    applyStyleToNode(n, { justifyContent: 'space-evenly' });
    expect(n.getJustifyContent()).toBe(Yoga.JUSTIFY_SPACE_EVENLY);
  });

  it('should set align items', () => {
    const n = createNode();
    applyStyleToNode(n, { alignItems: 'center' });
    expect(n.getAlignItems()).toBe(Yoga.ALIGN_CENTER);
  });

  it('should set align self', () => {
    const n = createNode();
    applyStyleToNode(n, { alignSelf: 'flex-end' });
    expect(n.getAlignSelf()).toBe(Yoga.ALIGN_FLEX_END);
  });

  it('should not set align self for auto', () => {
    const n = createNode();
    applyStyleToNode(n, { alignSelf: 'auto' });
    expect(n.getAlignSelf()).toBe(Yoga.ALIGN_AUTO);
  });

  it('should set align content', () => {
    const n = createNode();
    applyStyleToNode(n, { alignContent: 'space-between' });
    expect(n.getAlignContent()).toBe(Yoga.ALIGN_SPACE_BETWEEN);
  });

  it('should set flex grow', () => {
    const n = createNode();
    applyStyleToNode(n, { flexGrow: 2 });
    expect(n.getFlexGrow()).toBe(2);
  });

  it('should set flex shrink to 0', () => {
    const n = createNode();
    applyStyleToNode(n, { flexShrink: 0 });
    expect(n.getFlexShrink()).toBe(0);
  });

  it('should default flex shrink to 1', () => {
    const n = createNode();
    applyStyleToNode(n, {});
    expect(n.getFlexShrink()).toBe(1);
  });

  it('should set flex basis', () => {
    const n = createNode();
    applyStyleToNode(n, { flexBasis: 100 });
    const basis = n.getFlexBasis();
    expect(basis.value).toBe(100);
  });

  it('should set flex basis auto', () => {
    const n = createNode();
    applyStyleToNode(n, { flexBasis: 'auto' });
    const basis = n.getFlexBasis();
    expect(basis.unit).toBe(Yoga.UNIT_AUTO);
  });

  it('should set width', () => {
    const n = createNode();
    applyStyleToNode(n, { width: 200 });
    const w = n.getWidth();
    expect(w.value).toBe(200);
  });

  it('should set width auto', () => {
    const n = createNode();
    applyStyleToNode(n, { width: 'auto' });
    const w = n.getWidth();
    expect(w.unit).toBe(Yoga.UNIT_AUTO);
  });

  it('should set width percent', () => {
    const n = createNode();
    applyStyleToNode(n, { width: '50%' });
    const w = n.getWidth();
    expect(w.value).toBe(50);
    expect(w.unit).toBe(Yoga.UNIT_PERCENT);
  });

  it('should set height', () => {
    const n = createNode();
    applyStyleToNode(n, { height: 150 });
    const h = n.getHeight();
    expect(h.value).toBe(150);
  });

  it('should set min/max dimensions', () => {
    const n = createNode();
    applyStyleToNode(n, { minWidth: 50, maxWidth: 300, minHeight: 20, maxHeight: 500 });
    expect(n.getMinWidth().value).toBe(50);
    expect(n.getMaxWidth().value).toBe(300);
    expect(n.getMinHeight().value).toBe(20);
    expect(n.getMaxHeight().value).toBe(500);
  });

  it('should set padding', () => {
    const n = createNode();
    applyStyleToNode(n, { padding: 10 });
    expect(n.getPadding(Yoga.EDGE_ALL).value).toBe(10);
  });

  it('should set per-side padding', () => {
    const n = createNode();
    applyStyleToNode(n, { paddingTop: 5, paddingRight: 10, paddingBottom: 15, paddingLeft: 20 });
    expect(n.getPadding(Yoga.EDGE_TOP).value).toBe(5);
    expect(n.getPadding(Yoga.EDGE_RIGHT).value).toBe(10);
    expect(n.getPadding(Yoga.EDGE_BOTTOM).value).toBe(15);
    expect(n.getPadding(Yoga.EDGE_LEFT).value).toBe(20);
  });

  it('should set margin', () => {
    const n = createNode();
    applyStyleToNode(n, { margin: 10 });
    expect(n.getMargin(Yoga.EDGE_ALL).value).toBe(10);
  });

  it('should set border width', () => {
    const n = createNode();
    applyStyleToNode(n, { borderWidth: 2 });
    expect(n.getBorder(Yoga.EDGE_ALL)).toBe(2);
  });

  it('should set per-side border width', () => {
    const n = createNode();
    applyStyleToNode(n, { borderTopWidth: 1, borderRightWidth: 2, borderBottomWidth: 3, borderLeftWidth: 4 });
    expect(n.getBorder(Yoga.EDGE_TOP)).toBe(1);
    expect(n.getBorder(Yoga.EDGE_RIGHT)).toBe(2);
    expect(n.getBorder(Yoga.EDGE_BOTTOM)).toBe(3);
    expect(n.getBorder(Yoga.EDGE_LEFT)).toBe(4);
  });

  it('should set position absolute', () => {
    const n = createNode();
    applyStyleToNode(n, { position: 'absolute' });
    expect(n.getPositionType()).toBe(Yoga.POSITION_TYPE_ABSOLUTE);
  });

  it('should set position relative', () => {
    const n = createNode();
    applyStyleToNode(n, { position: 'relative' });
    expect(n.getPositionType()).toBe(Yoga.POSITION_TYPE_RELATIVE);
  });

  it('should set position offsets', () => {
    const n = createNode();
    applyStyleToNode(n, { top: 10, right: 20, bottom: 30, left: 40 });
    expect(n.getPosition(Yoga.EDGE_TOP).value).toBe(10);
    expect(n.getPosition(Yoga.EDGE_RIGHT).value).toBe(20);
    expect(n.getPosition(Yoga.EDGE_BOTTOM).value).toBe(30);
    expect(n.getPosition(Yoga.EDGE_LEFT).value).toBe(40);
  });

  it('should set display none', () => {
    const n = createNode();
    applyStyleToNode(n, { display: 'none' });
    expect(n.getDisplay()).toBe(Yoga.DISPLAY_NONE);
  });

  it('should set display flex by default', () => {
    const n = createNode();
    applyStyleToNode(n, {});
    expect(n.getDisplay()).toBe(Yoga.DISPLAY_FLEX);
  });

  it('should set overflow hidden', () => {
    const n = createNode();
    applyStyleToNode(n, { overflow: 'hidden' });
    expect(n.getOverflow()).toBe(Yoga.OVERFLOW_HIDDEN);
  });

  it('should set overflow scroll', () => {
    const n = createNode();
    applyStyleToNode(n, { overflow: 'scroll' });
    expect(n.getOverflow()).toBe(Yoga.OVERFLOW_SCROLL);
  });

  it('should set gap', () => {
    const n = createNode();
    applyStyleToNode(n, { gap: 10 });
    // yoga-wasm-web getGap returns a plain number
    expect(n.getGap(Yoga.GUTTER_ALL)).toBe(10);
  });

  it('should set row and column gap', () => {
    const n = createNode();
    applyStyleToNode(n, { rowGap: 5, columnGap: 15 });
    expect(n.getGap(Yoga.GUTTER_ROW)).toBe(5);
    expect(n.getGap(Yoga.GUTTER_COLUMN)).toBe(15);
  });

  it('should not error on empty style', () => {
    const n = createNode();
    expect(() => applyStyleToNode(n, {})).not.toThrow();
  });

  it('should not error on style with only visual properties', () => {
    const n = createNode();
    expect(() =>
      applyStyleToNode(n, {
        backgroundColor: 'red',
        borderColor: 'blue',
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
        opacity: 0.5,
      }),
    ).not.toThrow();
  });
});
