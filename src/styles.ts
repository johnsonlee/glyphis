import type { Node } from 'yoga-layout';
import { Edge, FlexDirection, Justify, Align, Wrap, PositionType, Display, Overflow, Gutter } from 'yoga-layout';
import type { Style } from './types';

const FLEX_DIRECTION: Record<string, FlexDirection> = {
  'column': FlexDirection.Column,
  'column-reverse': FlexDirection.ColumnReverse,
  'row': FlexDirection.Row,
  'row-reverse': FlexDirection.RowReverse,
};

const JUSTIFY: Record<string, Justify> = {
  'flex-start': Justify.FlexStart,
  'center': Justify.Center,
  'flex-end': Justify.FlexEnd,
  'space-between': Justify.SpaceBetween,
  'space-around': Justify.SpaceAround,
  'space-evenly': Justify.SpaceEvenly,
};

const ALIGN: Record<string, Align> = {
  'auto': Align.Auto,
  'flex-start': Align.FlexStart,
  'center': Align.Center,
  'flex-end': Align.FlexEnd,
  'stretch': Align.Stretch,
  'baseline': Align.Baseline,
  'space-between': Align.SpaceBetween,
  'space-around': Align.SpaceAround,
};

const WRAP_MAP: Record<string, Wrap> = {
  'nowrap': Wrap.NoWrap,
  'wrap': Wrap.Wrap,
  'wrap-reverse': Wrap.WrapReverse,
};

const POSITION: Record<string, PositionType> = {
  'static': PositionType.Static,
  'relative': PositionType.Relative,
  'absolute': PositionType.Absolute,
};

const DISPLAY_MAP: Record<string, Display> = {
  'flex': Display.Flex,
  'none': Display.None,
};

const OVERFLOW_MAP: Record<string, Overflow> = {
  'visible': Overflow.Visible,
  'hidden': Overflow.Hidden,
  'scroll': Overflow.Scroll,
};

export function applyStyle(node: Node, style: Style): void {
  if (style.width !== undefined) node.setWidth(style.width);
  if (style.height !== undefined) node.setHeight(style.height);
  if (style.minWidth !== undefined) node.setMinWidth(style.minWidth);
  if (style.minHeight !== undefined) node.setMinHeight(style.minHeight);
  if (style.maxWidth !== undefined) node.setMaxWidth(style.maxWidth);
  if (style.maxHeight !== undefined) node.setMaxHeight(style.maxHeight);

  if (style.flex !== undefined) node.setFlex(style.flex);
  if (style.flexDirection) node.setFlexDirection(FLEX_DIRECTION[style.flexDirection]);
  if (style.flexGrow !== undefined) node.setFlexGrow(style.flexGrow);
  if (style.flexShrink !== undefined) node.setFlexShrink(style.flexShrink);
  if (style.flexBasis !== undefined) node.setFlexBasis(style.flexBasis);
  if (style.flexWrap) node.setFlexWrap(WRAP_MAP[style.flexWrap]);

  if (style.justifyContent) node.setJustifyContent(JUSTIFY[style.justifyContent]);
  if (style.alignItems) node.setAlignItems(ALIGN[style.alignItems]);
  if (style.alignSelf) node.setAlignSelf(ALIGN[style.alignSelf]);
  if (style.alignContent) node.setAlignContent(ALIGN[style.alignContent]);

  if (style.padding !== undefined) node.setPadding(Edge.All, style.padding);
  if (style.paddingTop !== undefined) node.setPadding(Edge.Top, style.paddingTop);
  if (style.paddingRight !== undefined) node.setPadding(Edge.Right, style.paddingRight);
  if (style.paddingBottom !== undefined) node.setPadding(Edge.Bottom, style.paddingBottom);
  if (style.paddingLeft !== undefined) node.setPadding(Edge.Left, style.paddingLeft);
  if (style.paddingHorizontal !== undefined) node.setPadding(Edge.Horizontal, style.paddingHorizontal);
  if (style.paddingVertical !== undefined) node.setPadding(Edge.Vertical, style.paddingVertical);

  if (style.margin !== undefined) node.setMargin(Edge.All, style.margin);
  if (style.marginTop !== undefined) node.setMargin(Edge.Top, style.marginTop);
  if (style.marginRight !== undefined) node.setMargin(Edge.Right, style.marginRight);
  if (style.marginBottom !== undefined) node.setMargin(Edge.Bottom, style.marginBottom);
  if (style.marginLeft !== undefined) node.setMargin(Edge.Left, style.marginLeft);
  if (style.marginHorizontal !== undefined) node.setMargin(Edge.Horizontal, style.marginHorizontal);
  if (style.marginVertical !== undefined) node.setMargin(Edge.Vertical, style.marginVertical);

  if (style.position) node.setPositionType(POSITION[style.position]);
  if (style.top !== undefined) node.setPosition(Edge.Top, style.top);
  if (style.right !== undefined) node.setPosition(Edge.Right, style.right);
  if (style.bottom !== undefined) node.setPosition(Edge.Bottom, style.bottom);
  if (style.left !== undefined) node.setPosition(Edge.Left, style.left);

  if (style.borderWidth !== undefined) node.setBorder(Edge.All, style.borderWidth);
  if (style.borderTopWidth !== undefined) node.setBorder(Edge.Top, style.borderTopWidth);
  if (style.borderRightWidth !== undefined) node.setBorder(Edge.Right, style.borderRightWidth);
  if (style.borderBottomWidth !== undefined) node.setBorder(Edge.Bottom, style.borderBottomWidth);
  if (style.borderLeftWidth !== undefined) node.setBorder(Edge.Left, style.borderLeftWidth);

  if (style.display) node.setDisplay(DISPLAY_MAP[style.display]);
  if (style.overflow) node.setOverflow(OVERFLOW_MAP[style.overflow]);

  if (style.gap !== undefined) node.setGap(Gutter.All, style.gap);
  if (style.rowGap !== undefined) node.setGap(Gutter.Row, style.rowGap);
  if (style.columnGap !== undefined) node.setGap(Gutter.Column, style.columnGap);
}
