import type { Style } from '../types';
import type { Yoga as YogaInstance, Node as YogaNode } from 'yoga-wasm-web/dist/wrapAsm';
import initYoga from 'yoga-wasm-web/asm';

const Yoga: YogaInstance = initYoga();
export { Yoga };

export function applyStyleToNode(node: YogaNode, style: Style): void {
  // Flex direction -- Yoga defaults to column, but Glyph/React Native default to row
  {
    const map: Record<string, typeof Yoga.FLEX_DIRECTION_ROW> = {
      'row': Yoga.FLEX_DIRECTION_ROW,
      'column': Yoga.FLEX_DIRECTION_COLUMN,
      'row-reverse': Yoga.FLEX_DIRECTION_ROW_REVERSE,
      'column-reverse': Yoga.FLEX_DIRECTION_COLUMN_REVERSE,
    };
    node.setFlexDirection(map[style.flexDirection ?? 'row'] ?? Yoga.FLEX_DIRECTION_ROW);
  }

  // Flex wrap
  if (style.flexWrap) {
    const map: Record<string, typeof Yoga.WRAP_NO_WRAP> = {
      'nowrap': Yoga.WRAP_NO_WRAP,
      'wrap': Yoga.WRAP_WRAP,
      'wrap-reverse': Yoga.WRAP_WRAP_REVERSE,
    };
    node.setFlexWrap(map[style.flexWrap] ?? Yoga.WRAP_NO_WRAP);
  }

  // Justify content
  if (style.justifyContent) {
    const map: Record<string, typeof Yoga.JUSTIFY_FLEX_START> = {
      'flex-start': Yoga.JUSTIFY_FLEX_START,
      'flex-end': Yoga.JUSTIFY_FLEX_END,
      'center': Yoga.JUSTIFY_CENTER,
      'space-between': Yoga.JUSTIFY_SPACE_BETWEEN,
      'space-around': Yoga.JUSTIFY_SPACE_AROUND,
      'space-evenly': Yoga.JUSTIFY_SPACE_EVENLY,
    };
    node.setJustifyContent(map[style.justifyContent] ?? Yoga.JUSTIFY_FLEX_START);
  }

  // Align items
  if (style.alignItems) {
    const map: Record<string, typeof Yoga.ALIGN_FLEX_START> = {
      'flex-start': Yoga.ALIGN_FLEX_START,
      'flex-end': Yoga.ALIGN_FLEX_END,
      'center': Yoga.ALIGN_CENTER,
      'stretch': Yoga.ALIGN_STRETCH,
    };
    node.setAlignItems(map[style.alignItems] ?? Yoga.ALIGN_STRETCH);
  }

  // Align self
  if (style.alignSelf && style.alignSelf !== 'auto') {
    const map: Record<string, typeof Yoga.ALIGN_FLEX_START> = {
      'flex-start': Yoga.ALIGN_FLEX_START,
      'flex-end': Yoga.ALIGN_FLEX_END,
      'center': Yoga.ALIGN_CENTER,
      'stretch': Yoga.ALIGN_STRETCH,
    };
    node.setAlignSelf(map[style.alignSelf] ?? Yoga.ALIGN_AUTO);
  }

  // Align content
  if (style.alignContent) {
    const map: Record<string, typeof Yoga.ALIGN_FLEX_START> = {
      'flex-start': Yoga.ALIGN_FLEX_START,
      'flex-end': Yoga.ALIGN_FLEX_END,
      'center': Yoga.ALIGN_CENTER,
      'stretch': Yoga.ALIGN_STRETCH,
      'space-between': Yoga.ALIGN_SPACE_BETWEEN,
      'space-around': Yoga.ALIGN_SPACE_AROUND,
    };
    node.setAlignContent(map[style.alignContent] ?? Yoga.ALIGN_FLEX_START);
  }

  // Flex
  if (style.flex !== undefined) {
    node.setFlex(style.flex);
  }
  if (style.flexGrow !== undefined) {
    node.setFlexGrow(style.flexGrow);
  }
  // Yoga defaults flexShrink to 0, but Glyph/CSS default to 1
  if (style.flex === undefined) {
    node.setFlexShrink(style.flexShrink ?? 1);
  } else if (style.flexShrink !== undefined) {
    node.setFlexShrink(style.flexShrink);
  }
  if (style.flexBasis !== undefined) {
    if (style.flexBasis === 'auto') {
      node.setFlexBasisAuto();
    } else if (typeof style.flexBasis === 'number') {
      node.setFlexBasis(style.flexBasis);
    }
  }

  // Dimensions
  if (style.width !== undefined) {
    if (style.width === 'auto') {
      node.setWidthAuto();
    } else if (typeof style.width === 'string' && style.width.endsWith('%')) {
      node.setWidthPercent(parseFloat(style.width));
    } else if (typeof style.width === 'number') {
      node.setWidth(style.width);
    }
  }
  if (style.height !== undefined) {
    if (style.height === 'auto') {
      node.setHeightAuto();
    } else if (typeof style.height === 'string' && style.height.endsWith('%')) {
      node.setHeightPercent(parseFloat(style.height));
    } else if (typeof style.height === 'number') {
      node.setHeight(style.height);
    }
  }

  // Min/Max
  if (style.minWidth !== undefined) node.setMinWidth(style.minWidth);
  if (style.minHeight !== undefined) node.setMinHeight(style.minHeight);
  if (style.maxWidth !== undefined) node.setMaxWidth(style.maxWidth);
  if (style.maxHeight !== undefined) node.setMaxHeight(style.maxHeight);

  // Padding (use EDGE constants)
  if (style.padding !== undefined) node.setPadding(Yoga.EDGE_ALL, style.padding);
  if (style.paddingTop !== undefined) node.setPadding(Yoga.EDGE_TOP, style.paddingTop);
  if (style.paddingRight !== undefined) node.setPadding(Yoga.EDGE_RIGHT, style.paddingRight);
  if (style.paddingBottom !== undefined) node.setPadding(Yoga.EDGE_BOTTOM, style.paddingBottom);
  if (style.paddingLeft !== undefined) node.setPadding(Yoga.EDGE_LEFT, style.paddingLeft);
  if (style.paddingHorizontal !== undefined) node.setPadding(Yoga.EDGE_HORIZONTAL, style.paddingHorizontal);
  if (style.paddingVertical !== undefined) node.setPadding(Yoga.EDGE_VERTICAL, style.paddingVertical);

  // Margin
  if (style.margin !== undefined) node.setMargin(Yoga.EDGE_ALL, style.margin);
  if (style.marginTop !== undefined) node.setMargin(Yoga.EDGE_TOP, style.marginTop);
  if (style.marginRight !== undefined) node.setMargin(Yoga.EDGE_RIGHT, style.marginRight);
  if (style.marginBottom !== undefined) node.setMargin(Yoga.EDGE_BOTTOM, style.marginBottom);
  if (style.marginLeft !== undefined) node.setMargin(Yoga.EDGE_LEFT, style.marginLeft);
  if (style.marginHorizontal !== undefined) node.setMargin(Yoga.EDGE_HORIZONTAL, style.marginHorizontal);
  if (style.marginVertical !== undefined) node.setMargin(Yoga.EDGE_VERTICAL, style.marginVertical);

  // Border width
  if (style.borderWidth !== undefined) node.setBorder(Yoga.EDGE_ALL, style.borderWidth);
  if (style.borderTopWidth !== undefined) node.setBorder(Yoga.EDGE_TOP, style.borderTopWidth);
  if (style.borderRightWidth !== undefined) node.setBorder(Yoga.EDGE_RIGHT, style.borderRightWidth);
  if (style.borderBottomWidth !== undefined) node.setBorder(Yoga.EDGE_BOTTOM, style.borderBottomWidth);
  if (style.borderLeftWidth !== undefined) node.setBorder(Yoga.EDGE_LEFT, style.borderLeftWidth);

  // Position
  if (style.position === 'absolute') {
    node.setPositionType(Yoga.POSITION_TYPE_ABSOLUTE);
  } else if (style.position === 'relative') {
    node.setPositionType(Yoga.POSITION_TYPE_RELATIVE);
  }
  if (style.top !== undefined) node.setPosition(Yoga.EDGE_TOP, style.top);
  if (style.right !== undefined) node.setPosition(Yoga.EDGE_RIGHT, style.right);
  if (style.bottom !== undefined) node.setPosition(Yoga.EDGE_BOTTOM, style.bottom);
  if (style.left !== undefined) node.setPosition(Yoga.EDGE_LEFT, style.left);

  // Display
  if (style.display === 'none') {
    node.setDisplay(Yoga.DISPLAY_NONE);
  } else {
    node.setDisplay(Yoga.DISPLAY_FLEX);
  }

  // Overflow
  if (style.overflow === 'hidden') {
    node.setOverflow(Yoga.OVERFLOW_HIDDEN);
  } else if (style.overflow === 'scroll') {
    node.setOverflow(Yoga.OVERFLOW_SCROLL);
  }

  // Gap
  if (style.gap !== undefined) node.setGap(Yoga.GUTTER_ALL, style.gap);
  if (style.rowGap !== undefined) node.setGap(Yoga.GUTTER_ROW, style.rowGap);
  if (style.columnGap !== undefined) node.setGap(Yoga.GUTTER_COLUMN, style.columnGap);
}
