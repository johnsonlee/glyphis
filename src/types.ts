// --- VNode Types ---
export type VNodeType = string | Function | symbol;

export interface VNodeProps {
  key?: string | number | null;
  ref?: RefObject<any>;
  children?: VNodeChild[];
  style?: Style;
  onPress?: (event: GlyphPointerEvent) => void;
  onPressIn?: (event: GlyphPointerEvent) => void;
  onPressOut?: (event: GlyphPointerEvent) => void;
  onLayout?: (layout: LayoutBox) => void;
  [key: string]: any;
}

export type VNodeChild = VNode | string | number | boolean | null | undefined;

export interface VNode {
  type: VNodeType;
  props: VNodeProps;
  key: string | number | null;
}

export const Fragment: unique symbol = Symbol.for('glyph.fragment') as any;
export const TextNode: unique symbol = Symbol.for('glyph.text') as any;

export interface RefObject<T> {
  current: T | null;
}

// --- Style Types ---
export interface Style {
  // Dimensions
  width?: number | 'auto' | `${number}%`;
  height?: number | 'auto' | `${number}%`;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;

  // Flex container
  flex?: number;
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch';
  alignContent?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'space-between' | 'space-around';
  gap?: number;
  rowGap?: number;
  columnGap?: number;

  // Flex item
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | 'auto';
  alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch';

  // Spacing
  padding?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  margin?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginHorizontal?: number;
  marginVertical?: number;

  // Position
  position?: 'relative' | 'absolute';
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  zIndex?: number;

  // Visual
  backgroundColor?: string;
  borderRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;
  borderWidth?: number;
  borderTopWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderColor?: string;
  borderTopColor?: string;
  borderRightColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
  opacity?: number;
  overflow?: 'visible' | 'hidden' | 'scroll';
  display?: 'flex' | 'none';

  // Text
  color?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  textDecorationLine?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

// --- Layout Types ---
export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutNode extends LayoutBox {
  style: Style;
  children: LayoutNode[];
  text?: string;
  type: VNodeType;
  props: VNodeProps;
}

// --- Render Command Types ---
export type AnyRenderCommand =
  | RectCommand
  | TextCommand
  | ImageCommand
  | BorderCommand
  | ClipCommand
  | RestoreCommand
  | OpacityCommand
  | RestoreOpacityCommand;

export interface RectCommand {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  borderRadius?: number | [number, number, number, number];
}

export interface TextCommand {
  type: 'text';
  x: number;
  y: number;
  width: number;
  text: string;
  color: string;
  fontSize: number;
  fontWeight: string;
  fontFamily: string;
  textAlign: string;
  lineHeight?: number;
}

export interface ImageCommand {
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  borderRadius?: number;
}

export interface BorderCommand {
  type: 'border';
  x: number;
  y: number;
  width: number;
  height: number;
  widths: [number, number, number, number];
  colors: [string, string, string, string];
  borderRadius?: number | [number, number, number, number];
}

export interface ClipCommand {
  type: 'clip';
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number | [number, number, number, number];
}

export interface RestoreCommand {
  type: 'restore';
}

export interface OpacityCommand {
  type: 'opacity';
  opacity: number;
}

export interface RestoreOpacityCommand {
  type: 'restoreOpacity';
}

// --- Renderer Interface ---
export interface Renderer {
  clear(): void;
  render(commands: AnyRenderCommand[]): void;
  getWidth(): number;
  getHeight(): number;
  measureText(text: string, fontSize: number, fontFamily: string, fontWeight: string): { width: number; height: number };
}

// --- Event Types ---
export interface GlyphPointerEvent {
  type: 'press' | 'pressIn' | 'pressOut' | 'move';
  x: number;
  y: number;
  timestamp: number;
  target: Fiber | null;
  preventDefault(): void;
  stopPropagation(): void;
}

// --- Fiber Types ---
export type FiberTag = 'host' | 'component' | 'text' | 'root' | 'fragment';
export type EffectTag = 'placement' | 'update' | 'deletion';

export interface Fiber {
  tag: FiberTag;
  type: VNodeType;
  props: VNodeProps;
  key: string | number | null;

  parent: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
  alternate: Fiber | null;

  stateNode: any;
  effectTag?: EffectTag;
  effects: Fiber[];

  hooks: Hook[];
  hookIndex: number;

  layout?: LayoutBox;
  memoizedProps?: VNodeProps;
}

// --- Hook Types ---
export type HookTag = 'state' | 'effect' | 'memo' | 'callback' | 'ref' | 'context';

export interface Hook {
  tag: HookTag;
  state: any;
  queue: any[];
  deps?: any[];
  cleanup?: (() => void) | void;
}

// --- Utility: Style helpers ---
export function resolveEdge(
  all: number | undefined,
  horizontal: number | undefined,
  vertical: number | undefined,
  specific: number | undefined,
  isHorizontal: boolean,
): number {
  if (specific !== undefined) return specific;
  if (isHorizontal && horizontal !== undefined) return horizontal;
  if (!isHorizontal && vertical !== undefined) return vertical;
  if (all !== undefined) return all;
  return 0;
}

export function resolvePadding(style: Style): [number, number, number, number] {
  return [
    resolveEdge(style.padding, style.paddingHorizontal, style.paddingVertical, style.paddingTop, false),
    resolveEdge(style.padding, style.paddingHorizontal, style.paddingVertical, style.paddingRight, true),
    resolveEdge(style.padding, style.paddingHorizontal, style.paddingVertical, style.paddingBottom, false),
    resolveEdge(style.padding, style.paddingHorizontal, style.paddingVertical, style.paddingLeft, true),
  ];
}

export function resolveMargin(style: Style): [number, number, number, number] {
  return [
    resolveEdge(style.margin, style.marginHorizontal, style.marginVertical, style.marginTop, false),
    resolveEdge(style.margin, style.marginHorizontal, style.marginVertical, style.marginRight, true),
    resolveEdge(style.margin, style.marginHorizontal, style.marginVertical, style.marginBottom, false),
    resolveEdge(style.margin, style.marginHorizontal, style.marginVertical, style.marginLeft, true),
  ];
}

export function resolveBorderWidth(style: Style): [number, number, number, number] {
  const w = style.borderWidth ?? 0;
  return [
    style.borderTopWidth ?? w,
    style.borderRightWidth ?? w,
    style.borderBottomWidth ?? w,
    style.borderLeftWidth ?? w,
  ];
}

export function resolveBorderColor(style: Style): [string, string, string, string] {
  const c = style.borderColor ?? 'transparent';
  return [
    style.borderTopColor ?? c,
    style.borderRightColor ?? c,
    style.borderBottomColor ?? c,
    style.borderLeftColor ?? c,
  ];
}

export function resolveBorderRadius(style: Style): [number, number, number, number] {
  const r = style.borderRadius ?? 0;
  return [
    style.borderTopLeftRadius ?? r,
    style.borderTopRightRadius ?? r,
    style.borderBottomRightRadius ?? r,
    style.borderBottomLeftRadius ?? r,
  ];
}
