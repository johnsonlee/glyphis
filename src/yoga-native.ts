/**
 * Drop-in replacement for the `yoga-layout` npm package that calls native
 * Yoga C++ through a JS bridge (`__yoga` global object) instead of WASM.
 *
 * When native builds use a Bun plugin to redirect `import from 'yoga-layout'`
 * to this file, all existing code works unchanged.
 */

// Bridge function names match the Swift YogaBridge registration (YG C API naming)
declare const __yoga: {
  nodeNew(): number;
  nodeFreeRecursive(nodeId: number): void;
  nodeInsertChild(parentId: number, childId: number, index: number): void;
  nodeRemoveChild(parentId: number, childId: number): void;
  nodeCalculateLayout(nodeId: number, width: number, height: number, direction: number): void;
  nodeLayoutGetLeft(nodeId: number): number;
  nodeLayoutGetRight(nodeId: number): number;
  nodeLayoutGetTop(nodeId: number): number;
  nodeLayoutGetBottom(nodeId: number): number;
  nodeLayoutGetWidth(nodeId: number): number;
  nodeLayoutGetHeight(nodeId: number): number;
  nodeMarkDirty(nodeId: number): void;
  enableMeasure(nodeId: number): void;
  nodeStyleSetDirection(nodeId: number, value: number): void;
  nodeStyleSetFlexDirection(nodeId: number, value: number): void;
  nodeStyleSetJustifyContent(nodeId: number, value: number): void;
  nodeStyleSetAlignContent(nodeId: number, value: number): void;
  nodeStyleSetAlignItems(nodeId: number, value: number): void;
  nodeStyleSetAlignSelf(nodeId: number, value: number): void;
  nodeStyleSetPositionType(nodeId: number, value: number): void;
  nodeStyleSetFlexWrap(nodeId: number, value: number): void;
  nodeStyleSetOverflow(nodeId: number, value: number): void;
  nodeStyleSetDisplay(nodeId: number, value: number): void;
  nodeStyleSetFlex(nodeId: number, value: number): void;
  nodeStyleSetFlexGrow(nodeId: number, value: number): void;
  nodeStyleSetFlexShrink(nodeId: number, value: number): void;
  nodeStyleSetFlexBasis(nodeId: number, value: number): void;
  nodeStyleSetFlexBasisPercent(nodeId: number, value: number): void;
  nodeStyleSetFlexBasisAuto(nodeId: number): void;
  nodeStyleSetWidth(nodeId: number, value: number): void;
  nodeStyleSetWidthPercent(nodeId: number, value: number): void;
  nodeStyleSetWidthAuto(nodeId: number): void;
  nodeStyleSetHeight(nodeId: number, value: number): void;
  nodeStyleSetHeightPercent(nodeId: number, value: number): void;
  nodeStyleSetHeightAuto(nodeId: number): void;
  nodeStyleSetMinWidth(nodeId: number, value: number): void;
  nodeStyleSetMinWidthPercent(nodeId: number, value: number): void;
  nodeStyleSetMinHeight(nodeId: number, value: number): void;
  nodeStyleSetMinHeightPercent(nodeId: number, value: number): void;
  nodeStyleSetMaxWidth(nodeId: number, value: number): void;
  nodeStyleSetMaxWidthPercent(nodeId: number, value: number): void;
  nodeStyleSetMaxHeight(nodeId: number, value: number): void;
  nodeStyleSetMaxHeightPercent(nodeId: number, value: number): void;
  nodeStyleSetPosition(nodeId: number, edge: number, value: number): void;
  nodeStyleSetPositionPercent(nodeId: number, edge: number, value: number): void;
  nodeStyleSetMargin(nodeId: number, edge: number, value: number): void;
  nodeStyleSetMarginPercent(nodeId: number, edge: number, value: number): void;
  nodeStyleSetMarginAuto(nodeId: number, edge: number): void;
  nodeStyleSetPadding(nodeId: number, edge: number, value: number): void;
  nodeStyleSetPaddingPercent(nodeId: number, edge: number, value: number): void;
  nodeStyleSetBorder(nodeId: number, edge: number, value: number): void;
  nodeStyleSetGap(nodeId: number, gutter: number, value: number): void;
};

// ---------------------------------------------------------------------------
// Enums — identical numeric values to yoga-layout
// ---------------------------------------------------------------------------

export enum Align {
  Auto = 0,
  FlexStart = 1,
  Center = 2,
  FlexEnd = 3,
  Stretch = 4,
  Baseline = 5,
  SpaceBetween = 6,
  SpaceAround = 7,
  SpaceEvenly = 8,
}

export enum BoxSizing {
  BorderBox = 0,
  ContentBox = 1,
}

export enum Dimension {
  Width = 0,
  Height = 1,
}

export enum Direction {
  Inherit = 0,
  LTR = 1,
  RTL = 2,
}

export enum Display {
  Flex = 0,
  None = 1,
  Contents = 2,
}

export enum Edge {
  Left = 0,
  Top = 1,
  Right = 2,
  Bottom = 3,
  Start = 4,
  End = 5,
  Horizontal = 6,
  Vertical = 7,
  All = 8,
}

export enum Errata {
  None = 0,
  StretchFlexBasis = 1,
  AbsolutePositionWithoutInsetsExcludesPadding = 2,
  AbsolutePercentAgainstInnerSize = 4,
  All = 2147483647,
  Classic = 2147483646,
}

export enum ExperimentalFeature {
  WebFlexBasis = 0,
}

export enum FlexDirection {
  Column = 0,
  ColumnReverse = 1,
  Row = 2,
  RowReverse = 3,
}

export enum Gutter {
  Column = 0,
  Row = 1,
  All = 2,
}

export enum Justify {
  FlexStart = 0,
  Center = 1,
  FlexEnd = 2,
  SpaceBetween = 3,
  SpaceAround = 4,
  SpaceEvenly = 5,
}

export enum LogLevel {
  Error = 0,
  Warn = 1,
  Info = 2,
  Debug = 3,
  Verbose = 4,
  Fatal = 5,
}

export enum MeasureMode {
  Undefined = 0,
  Exactly = 1,
  AtMost = 2,
}

export enum NodeType {
  Default = 0,
  Text = 1,
}

export enum Overflow {
  Visible = 0,
  Hidden = 1,
  Scroll = 2,
}

export enum PositionType {
  Static = 0,
  Relative = 1,
  Absolute = 2,
}

export enum Unit {
  Undefined = 0,
  Point = 1,
  Percent = 2,
  Auto = 3,
}

export enum Wrap {
  NoWrap = 0,
  Wrap = 1,
  WrapReverse = 2,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Layout = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

type Size = {
  width: number;
  height: number;
};

type Value = {
  unit: Unit;
  value: number;
};

export type MeasureFunction = (
  width: number,
  widthMode: MeasureMode,
  height: number,
  heightMode: MeasureMode,
) => Size;

export type DirtiedFunction = (node: Node) => void;

export type Config = {
  free(): void;
  isExperimentalFeatureEnabled(feature: ExperimentalFeature): boolean;
  setExperimentalFeatureEnabled(feature: ExperimentalFeature, enabled: boolean): void;
  setPointScaleFactor(factor: number): void;
  getErrata(): Errata;
  setErrata(errata: Errata): void;
  useWebDefaults(): boolean;
  setUseWebDefaults(useWebDefaults: boolean): void;
};

// ---------------------------------------------------------------------------
// Measure function registry
// ---------------------------------------------------------------------------

const measureFuncs = new Map<number, MeasureFunction>();

(globalThis as any).__yoga_measure = (
  nodeId: number,
  width: number,
  widthMode: number,
  height: number,
  heightMode: number,
): Size => {
  const fn = measureFuncs.get(nodeId);
  if (!fn) return { width: 0, height: 0 };
  return fn(width, widthMode as MeasureMode, height, heightMode as MeasureMode);
};

// ---------------------------------------------------------------------------
// Helpers for parsing dimension values
// ---------------------------------------------------------------------------

type DimensionValue = number | 'auto' | `${number}%` | undefined;

function parsePercent(value: string): number {
  return parseFloat(value.slice(0, -1));
}

// ---------------------------------------------------------------------------
// Node ID to NativeNode lookup (for getChild/getParent)
// ---------------------------------------------------------------------------

const nodeById = new Map<number, NativeNode>();

// ---------------------------------------------------------------------------
// NativeNode — implements the yoga-layout Node interface
// ---------------------------------------------------------------------------

class NativeNode {
  declare _id: number;
  declare _children: NativeNode[];
  declare _parent: NativeNode | null;
  declare _isDirty: boolean;
  declare _hasNewLayout: boolean;

  constructor() {
    this._id = __yoga.nodeNew();
    this._children = [];
    this._parent = null;
    this._isDirty = false;
    this._hasNewLayout = false;
    nodeById.set(this._id, this);
  }

  // -- Tree operations -------------------------------------------------------

  insertChild(child: NativeNode, index: number): void {
    // Remove from old parent if needed
    if (child._parent && child._parent !== this) {
      child._parent.removeChild(child);
    }
    this._children.splice(index, 0, child);
    child._parent = this;
    __yoga.nodeInsertChild(this._id, child._id, index);
  }

  removeChild(child: NativeNode): void {
    const idx = this._children.indexOf(child);
    if (idx !== -1) {
      this._children.splice(idx, 1);
      child._parent = null;
      __yoga.nodeRemoveChild(this._id, child._id);
    }
  }

  getChild(index: number): NativeNode {
    return this._children[index];
  }

  getChildCount(): number {
    return this._children.length;
  }

  getParent(): NativeNode | null {
    return this._parent;
  }

  // -- Layout ----------------------------------------------------------------

  calculateLayout(
    width: number | 'auto' | undefined,
    height: number | 'auto' | undefined,
    direction: Direction = Direction.LTR,
  ): void {
    const w = width === 'auto' || width === undefined ? NaN : width;
    const h = height === 'auto' || height === undefined ? NaN : height;
    __yoga.nodeCalculateLayout(this._id, w, h, direction);
    this._hasNewLayout = true;
  }

  getComputedLayout(): Layout {
    return {
      left: __yoga.nodeLayoutGetLeft(this._id),
      right: __yoga.nodeLayoutGetRight(this._id),
      top: __yoga.nodeLayoutGetTop(this._id),
      bottom: __yoga.nodeLayoutGetBottom(this._id),
      width: __yoga.nodeLayoutGetWidth(this._id),
      height: __yoga.nodeLayoutGetHeight(this._id),
    };
  }

  getComputedLeft(): number {
    return __yoga.nodeLayoutGetLeft(this._id);
  }

  getComputedRight(): number {
    return __yoga.nodeLayoutGetRight(this._id);
  }

  getComputedTop(): number {
    return __yoga.nodeLayoutGetTop(this._id);
  }

  getComputedBottom(): number {
    return __yoga.nodeLayoutGetBottom(this._id);
  }

  getComputedWidth(): number {
    return __yoga.nodeLayoutGetWidth(this._id);
  }

  getComputedHeight(): number {
    return __yoga.nodeLayoutGetHeight(this._id);
  }

  // -- Dirty / layout state --------------------------------------------------

  markDirty(): void {
    this._isDirty = true;
    __yoga.nodeMarkDirty(this._id);
  }

  isDirty(): boolean {
    return this._isDirty;
  }

  hasNewLayout(): boolean {
    return this._hasNewLayout;
  }

  markLayoutSeen(): void {
    this._hasNewLayout = false;
  }

  // -- Measure function ------------------------------------------------------

  setMeasureFunc(fn: MeasureFunction | null): void {
    if (fn) {
      measureFuncs.set(this._id, fn);
      __yoga.enableMeasure(this._id);
    } else {
      measureFuncs.delete(this._id);
    }
  }

  unsetMeasureFunc(): void {
    measureFuncs.delete(this._id);
  }

  // -- Dirtied function (stub — not supported over bridge) -------------------

  setDirtiedFunc(_fn: DirtiedFunction | null): void {
    // Not implemented over native bridge
  }

  unsetDirtiedFunc(): void {
    // Not implemented over native bridge
  }

  // -- Lifecycle -------------------------------------------------------------

  free(): void {
    measureFuncs.delete(this._id);
    nodeById.delete(this._id);
  }

  freeRecursive(): void {
    for (const child of this._children) {
      child.freeRecursive();
    }
    this._children = [];
    this._parent = null;
    measureFuncs.delete(this._id);
    nodeById.delete(this._id);
    __yoga.nodeFreeRecursive(this._id);
  }

  reset(): void {
    // Minimal reset — clear local state
    this._children = [];
    this._parent = null;
    this._isDirty = false;
  }

  copyStyle(_node: NativeNode): void {
    // Not implemented over native bridge — would require reading all styles
  }

  // -- Enum-style setters (no dimension parsing) -----------------------------

  setDirection(value: Direction): void {
    __yoga.nodeStyleSetDirection(this._id, value);
  }

  setFlexDirection(value: FlexDirection): void {
    __yoga.nodeStyleSetFlexDirection(this._id, value);
  }

  setJustifyContent(value: Justify): void {
    __yoga.nodeStyleSetJustifyContent(this._id, value);
  }

  setAlignContent(value: Align): void {
    __yoga.nodeStyleSetAlignContent(this._id, value);
  }

  setAlignItems(value: Align): void {
    __yoga.nodeStyleSetAlignItems(this._id, value);
  }

  setAlignSelf(value: Align): void {
    __yoga.nodeStyleSetAlignSelf(this._id, value);
  }

  setPositionType(value: PositionType): void {
    __yoga.nodeStyleSetPositionType(this._id, value);
  }

  setFlexWrap(value: Wrap): void {
    __yoga.nodeStyleSetFlexWrap(this._id, value);
  }

  setOverflow(value: Overflow): void {
    __yoga.nodeStyleSetOverflow(this._id, value);
  }

  setDisplay(value: Display): void {
    __yoga.nodeStyleSetDisplay(this._id, value);
  }

  // -- Numeric setters (no auto/percent variants) ----------------------------

  setFlex(value: number | undefined): void {
    if (value === undefined) return;
    __yoga.nodeStyleSetFlex(this._id, value);
  }

  setFlexGrow(value: number | undefined): void {
    if (value === undefined) return;
    __yoga.nodeStyleSetFlexGrow(this._id, value);
  }

  setFlexShrink(value: number | undefined): void {
    if (value === undefined) return;
    __yoga.nodeStyleSetFlexShrink(this._id, value);
  }

  setAspectRatio(_value: number | undefined): void {
    // Not exposed through __yoga bridge
  }

  setIsReferenceBaseline(_value: boolean): void {
    // Not exposed through __yoga bridge
  }

  setAlwaysFormsContainingBlock(_value: boolean): void {
    // Not exposed through __yoga bridge
  }

  // -- Dimension setters (support number / "auto" / "N%") --------------------

  setFlexBasis(value: DimensionValue): void {
    if (value === undefined) return;
    if (value === 'auto') {
      __yoga.nodeStyleSetFlexBasisAuto(this._id);
    } else if (typeof value === 'string' && value.endsWith('%')) {
      __yoga.nodeStyleSetFlexBasisPercent(this._id, parsePercent(value));
    } else {
      __yoga.nodeStyleSetFlexBasis(this._id, value as number);
    }
  }

  setFlexBasisPercent(value: number | undefined): void {
    if (value === undefined) return;
    __yoga.nodeStyleSetFlexBasisPercent(this._id, value);
  }

  setFlexBasisAuto(): void {
    __yoga.nodeStyleSetFlexBasisAuto(this._id);
  }

  setWidth(value: DimensionValue): void {
    if (value === undefined) return;
    if (value === 'auto') {
      __yoga.nodeStyleSetWidthAuto(this._id);
    } else if (typeof value === 'string' && value.endsWith('%')) {
      __yoga.nodeStyleSetWidthPercent(this._id, parsePercent(value));
    } else {
      __yoga.nodeStyleSetWidth(this._id, value as number);
    }
  }

  setWidthPercent(value: number | undefined): void {
    if (value === undefined) return;
    __yoga.nodeStyleSetWidthPercent(this._id, value);
  }

  setWidthAuto(): void {
    __yoga.nodeStyleSetWidthAuto(this._id);
  }

  setHeight(value: DimensionValue): void {
    if (value === undefined) return;
    if (value === 'auto') {
      __yoga.nodeStyleSetHeightAuto(this._id);
    } else if (typeof value === 'string' && value.endsWith('%')) {
      __yoga.nodeStyleSetHeightPercent(this._id, parsePercent(value));
    } else {
      __yoga.nodeStyleSetHeight(this._id, value as number);
    }
  }

  setHeightPercent(value: number | undefined): void {
    if (value === undefined) return;
    __yoga.nodeStyleSetHeightPercent(this._id, value);
  }

  setHeightAuto(): void {
    __yoga.nodeStyleSetHeightAuto(this._id);
  }

  setMinWidth(value: DimensionValue): void {
    if (value === undefined) return;
    if (typeof value === 'string' && value.endsWith('%')) {
      __yoga.nodeStyleSetMinWidthPercent(this._id, parsePercent(value));
    } else {
      __yoga.nodeStyleSetMinWidth(this._id, value as number);
    }
  }

  setMinWidthPercent(value: number | undefined): void {
    if (value === undefined) return;
    __yoga.nodeStyleSetMinWidthPercent(this._id, value);
  }

  setMinHeight(value: DimensionValue): void {
    if (value === undefined) return;
    if (typeof value === 'string' && value.endsWith('%')) {
      __yoga.nodeStyleSetMinHeightPercent(this._id, parsePercent(value));
    } else {
      __yoga.nodeStyleSetMinHeight(this._id, value as number);
    }
  }

  setMinHeightPercent(value: number | undefined): void {
    if (value === undefined) return;
    __yoga.nodeStyleSetMinHeightPercent(this._id, value);
  }

  setMaxWidth(value: DimensionValue): void {
    if (value === undefined) return;
    if (typeof value === 'string' && value.endsWith('%')) {
      __yoga.nodeStyleSetMaxWidthPercent(this._id, parsePercent(value));
    } else {
      __yoga.nodeStyleSetMaxWidth(this._id, value as number);
    }
  }

  setMaxWidthPercent(value: number | undefined): void {
    if (value === undefined) return;
    __yoga.nodeStyleSetMaxWidthPercent(this._id, value);
  }

  setMaxHeight(value: DimensionValue): void {
    if (value === undefined) return;
    if (typeof value === 'string' && value.endsWith('%')) {
      __yoga.nodeStyleSetMaxHeightPercent(this._id, parsePercent(value));
    } else {
      __yoga.nodeStyleSetMaxHeight(this._id, value as number);
    }
  }

  setMaxHeightPercent(value: number | undefined): void {
    if (value === undefined) return;
    __yoga.nodeStyleSetMaxHeightPercent(this._id, value);
  }

  // -- Edge-based setters (support number / "auto" / "N%") -------------------

  setPosition(edge: Edge, value: DimensionValue): void {
    if (value === undefined) return;
    if (typeof value === 'string' && value.endsWith('%')) {
      __yoga.nodeStyleSetPositionPercent(this._id, edge, parsePercent(value));
    } else {
      __yoga.nodeStyleSetPosition(this._id, edge, value as number);
    }
  }

  setPositionPercent(edge: Edge, value: number | undefined): void {
    if (value === undefined) return;
    __yoga.nodeStyleSetPositionPercent(this._id, edge, value);
  }

  setPositionAuto(_edge: Edge): void {
    // Not exposed through __yoga bridge
  }

  setMargin(edge: Edge, value: number | 'auto' | `${number}%` | undefined): void {
    if (value === undefined) return;
    if (value === 'auto') {
      __yoga.nodeStyleSetMarginAuto(this._id, edge);
    } else if (typeof value === 'string' && value.endsWith('%')) {
      __yoga.nodeStyleSetMarginPercent(this._id, edge, parsePercent(value));
    } else {
      __yoga.nodeStyleSetMargin(this._id, edge, value as number);
    }
  }

  setMarginPercent(edge: Edge, value: number | undefined): void {
    if (value === undefined) return;
    __yoga.nodeStyleSetMarginPercent(this._id, edge, value);
  }

  setMarginAuto(edge: Edge): void {
    __yoga.nodeStyleSetMarginAuto(this._id, edge);
  }

  setPadding(edge: Edge, value: DimensionValue): void {
    if (value === undefined) return;
    if (typeof value === 'string' && value.endsWith('%')) {
      __yoga.nodeStyleSetPaddingPercent(this._id, edge, parsePercent(value));
    } else {
      __yoga.nodeStyleSetPadding(this._id, edge, value as number);
    }
  }

  setPaddingPercent(edge: Edge, value: number | undefined): void {
    if (value === undefined) return;
    __yoga.nodeStyleSetPaddingPercent(this._id, edge, value);
  }

  setBorder(edge: Edge, value: number | undefined): void {
    if (value === undefined) return;
    __yoga.nodeStyleSetBorder(this._id, edge, value);
  }

  setGap(gutter: Gutter, value: number | `${number}%` | undefined): Value {
    if (value === undefined) return { unit: Unit.Undefined, value: 0 };
    if (typeof value === 'string' && value.endsWith('%')) {
      const numVal = parsePercent(value);
      __yoga.nodeStyleSetGap(this._id, gutter, numVal);
      return { unit: Unit.Percent, value: numVal };
    }
    __yoga.nodeStyleSetGap(this._id, gutter, value as number);
    return { unit: Unit.Point, value: value as number };
  }

  setGapPercent(_gutter: Gutter, _value: number | undefined): Value {
    // The native bridge only has setGap — pass through
    return { unit: Unit.Undefined, value: 0 };
  }

  setBoxSizing(_value: BoxSizing): void {
    // Not exposed through __yoga bridge
  }

  // -- Getters (stubs returning defaults — not needed by our rendering code) -

  getAlignContent(): Align { return Align.FlexStart; }
  getAlignItems(): Align { return Align.Stretch; }
  getAlignSelf(): Align { return Align.Auto; }
  getAspectRatio(): number { return NaN; }
  getBorder(_edge: Edge): number { return 0; }
  getComputedBorder(_edge: Edge): number { return 0; }
  getComputedMargin(_edge: Edge): number { return 0; }
  getComputedPadding(_edge: Edge): number { return 0; }
  getDirection(): Direction { return Direction.LTR; }
  getDisplay(): Display { return Display.Flex; }
  getFlexBasis(): Value { return { unit: Unit.Auto, value: 0 }; }
  getFlexDirection(): FlexDirection { return FlexDirection.Column; }
  getFlexGrow(): number { return 0; }
  getFlexShrink(): number { return 1; }
  getFlexWrap(): Wrap { return Wrap.NoWrap; }
  getHeight(): Value { return { unit: Unit.Auto, value: 0 }; }
  getJustifyContent(): Justify { return Justify.FlexStart; }
  getGap(_gutter: Gutter): Value { return { unit: Unit.Undefined, value: 0 }; }
  getMargin(_edge: Edge): Value { return { unit: Unit.Undefined, value: 0 }; }
  getMaxHeight(): Value { return { unit: Unit.Undefined, value: 0 }; }
  getMaxWidth(): Value { return { unit: Unit.Undefined, value: 0 }; }
  getMinHeight(): Value { return { unit: Unit.Undefined, value: 0 }; }
  getMinWidth(): Value { return { unit: Unit.Undefined, value: 0 }; }
  getOverflow(): Overflow { return Overflow.Visible; }
  getPadding(_edge: Edge): Value { return { unit: Unit.Undefined, value: 0 }; }
  getPosition(_edge: Edge): Value { return { unit: Unit.Undefined, value: 0 }; }
  getPositionType(): PositionType { return PositionType.Relative; }
  getBoxSizing(): BoxSizing { return BoxSizing.BorderBox; }
  getWidth(): Value { return { unit: Unit.Auto, value: 0 }; }
  isReferenceBaseline(): boolean { return false; }
}

// Re-export the class as the Node type for consumers that import `Node`
export type Node = NativeNode;

// ---------------------------------------------------------------------------
// Minimal Config stub (not used in our codebase but required for type compat)
// ---------------------------------------------------------------------------

class NativeConfig implements Config {
  free(): void {}
  isExperimentalFeatureEnabled(_feature: ExperimentalFeature): boolean { return false; }
  setExperimentalFeatureEnabled(_feature: ExperimentalFeature, _enabled: boolean): void {}
  setPointScaleFactor(_factor: number): void {}
  getErrata(): Errata { return Errata.None; }
  setErrata(_errata: Errata): void {}
  useWebDefaults(): boolean { return false; }
  setUseWebDefaults(_useWebDefaults: boolean): void {}
}

// ---------------------------------------------------------------------------
// Default export — mimics yoga-layout's Yoga object
// ---------------------------------------------------------------------------

const Yoga = {
  Node: {
    create(_config?: Config): NativeNode {
      return new NativeNode();
    },
    createDefault(): NativeNode {
      return new NativeNode();
    },
    createWithConfig(_config: Config): NativeNode {
      return new NativeNode();
    },
    destroy(node: NativeNode): void {
      node.free();
    },
  },
  Config: {
    create(): NativeConfig {
      return new NativeConfig();
    },
    destroy(_config: Config): void {},
  },

  // Spread all enum constants (matches yoga-layout's Yoga type which extends YGEnums)
  ALIGN_AUTO: Align.Auto,
  ALIGN_FLEX_START: Align.FlexStart,
  ALIGN_CENTER: Align.Center,
  ALIGN_FLEX_END: Align.FlexEnd,
  ALIGN_STRETCH: Align.Stretch,
  ALIGN_BASELINE: Align.Baseline,
  ALIGN_SPACE_BETWEEN: Align.SpaceBetween,
  ALIGN_SPACE_AROUND: Align.SpaceAround,
  ALIGN_SPACE_EVENLY: Align.SpaceEvenly,
  BOX_SIZING_BORDER_BOX: BoxSizing.BorderBox,
  BOX_SIZING_CONTENT_BOX: BoxSizing.ContentBox,
  DIMENSION_WIDTH: Dimension.Width,
  DIMENSION_HEIGHT: Dimension.Height,
  DIRECTION_INHERIT: Direction.Inherit,
  DIRECTION_LTR: Direction.LTR,
  DIRECTION_RTL: Direction.RTL,
  DISPLAY_FLEX: Display.Flex,
  DISPLAY_NONE: Display.None,
  DISPLAY_CONTENTS: Display.Contents,
  EDGE_LEFT: Edge.Left,
  EDGE_TOP: Edge.Top,
  EDGE_RIGHT: Edge.Right,
  EDGE_BOTTOM: Edge.Bottom,
  EDGE_START: Edge.Start,
  EDGE_END: Edge.End,
  EDGE_HORIZONTAL: Edge.Horizontal,
  EDGE_VERTICAL: Edge.Vertical,
  EDGE_ALL: Edge.All,
  ERRATA_NONE: Errata.None,
  ERRATA_STRETCH_FLEX_BASIS: Errata.StretchFlexBasis,
  ERRATA_ABSOLUTE_POSITION_WITHOUT_INSETS_EXCLUDES_PADDING: Errata.AbsolutePositionWithoutInsetsExcludesPadding,
  ERRATA_ABSOLUTE_PERCENT_AGAINST_INNER_SIZE: Errata.AbsolutePercentAgainstInnerSize,
  ERRATA_ALL: Errata.All,
  ERRATA_CLASSIC: Errata.Classic,
  EXPERIMENTAL_FEATURE_WEB_FLEX_BASIS: ExperimentalFeature.WebFlexBasis,
  FLEX_DIRECTION_COLUMN: FlexDirection.Column,
  FLEX_DIRECTION_COLUMN_REVERSE: FlexDirection.ColumnReverse,
  FLEX_DIRECTION_ROW: FlexDirection.Row,
  FLEX_DIRECTION_ROW_REVERSE: FlexDirection.RowReverse,
  GUTTER_COLUMN: Gutter.Column,
  GUTTER_ROW: Gutter.Row,
  GUTTER_ALL: Gutter.All,
  JUSTIFY_FLEX_START: Justify.FlexStart,
  JUSTIFY_CENTER: Justify.Center,
  JUSTIFY_FLEX_END: Justify.FlexEnd,
  JUSTIFY_SPACE_BETWEEN: Justify.SpaceBetween,
  JUSTIFY_SPACE_AROUND: Justify.SpaceAround,
  JUSTIFY_SPACE_EVENLY: Justify.SpaceEvenly,
  LOG_LEVEL_ERROR: LogLevel.Error,
  LOG_LEVEL_WARN: LogLevel.Warn,
  LOG_LEVEL_INFO: LogLevel.Info,
  LOG_LEVEL_DEBUG: LogLevel.Debug,
  LOG_LEVEL_VERBOSE: LogLevel.Verbose,
  LOG_LEVEL_FATAL: LogLevel.Fatal,
  MEASURE_MODE_UNDEFINED: MeasureMode.Undefined,
  MEASURE_MODE_EXACTLY: MeasureMode.Exactly,
  MEASURE_MODE_AT_MOST: MeasureMode.AtMost,
  NODE_TYPE_DEFAULT: NodeType.Default,
  NODE_TYPE_TEXT: NodeType.Text,
  OVERFLOW_VISIBLE: Overflow.Visible,
  OVERFLOW_HIDDEN: Overflow.Hidden,
  OVERFLOW_SCROLL: Overflow.Scroll,
  POSITION_TYPE_STATIC: PositionType.Static,
  POSITION_TYPE_RELATIVE: PositionType.Relative,
  POSITION_TYPE_ABSOLUTE: PositionType.Absolute,
  UNIT_UNDEFINED: Unit.Undefined,
  UNIT_POINT: Unit.Point,
  UNIT_PERCENT: Unit.Percent,
  UNIT_AUTO: Unit.Auto,
  WRAP_NO_WRAP: Wrap.NoWrap,
  WRAP_WRAP: Wrap.Wrap,
  WRAP_WRAP_REVERSE: Wrap.WrapReverse,
};

export default Yoga;
