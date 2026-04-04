import type { Style, LayoutBox } from './types';
import { resolvePadding, resolveMargin, resolveBorderWidth } from './types';

export interface LayoutInput {
  style: Style;
  children: LayoutInput[];
  text?: string;
  measureText?: (text: string, style: Style) => { width: number; height: number };
}

export interface LayoutOutput {
  x: number;
  y: number;
  width: number;
  height: number;
  children: LayoutOutput[];
}

function resolveSize(
  value: number | 'auto' | `${number}%` | undefined,
  parentSize: number,
): number | null {
  if (value === undefined || value === 'auto') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.endsWith('%')) {
    return (parseFloat(value) / 100) * parentSize;
  }
  return null;
}

function clamp(value: number, min?: number, max?: number): number {
  let result = value;
  if (min !== undefined) result = Math.max(result, min);
  if (max !== undefined) result = Math.min(result, max);
  return result;
}

function isReversed(dir: string): boolean {
  return dir === 'row-reverse' || dir === 'column-reverse';
}

function isRow(dir: string): boolean {
  return dir === 'row' || dir === 'row-reverse';
}

interface FlexLine {
  items: FlexLineItem[];
  mainSize: number;
  crossSize: number;
}

interface FlexLineItem {
  index: number;
  node: LayoutInput;
  mainSize: number;
  crossSize: number;
  flexGrow: number;
  flexShrink: number;
  marginMain: number;
  marginCross: number;
  marginBefore: number;
  marginAfter: number;
  marginCrossBefore: number;
  marginCrossAfter: number;
  output: LayoutOutput;
}

export function computeLayout(
  node: LayoutInput,
  parentWidth: number,
  parentHeight: number,
): LayoutOutput {
  const style = node.style;

  // display: none
  if (style.display === 'none') {
    return { x: 0, y: 0, width: 0, height: 0, children: [] };
  }

  const [padTop, padRight, padBottom, padLeft] = resolvePadding(style);
  const [margTop, margRight, margBottom, margLeft] = resolveMargin(style);
  const [borderTop, borderRight, borderBottom, borderLeft] = resolveBorderWidth(style);

  const padAndBorderH = padLeft + padRight + borderLeft + borderRight;
  const padAndBorderV = padTop + padBottom + borderTop + borderBottom;

  // Resolve own dimensions
  let resolvedWidth = resolveSize(style.width, parentWidth);
  let resolvedHeight = resolveSize(style.height, parentHeight);

  // Apply min/max to resolved dimensions
  if (resolvedWidth !== null) {
    resolvedWidth = clamp(resolvedWidth, style.minWidth, style.maxWidth);
  }
  if (resolvedHeight !== null) {
    resolvedHeight = clamp(resolvedHeight, style.minHeight, style.maxHeight);
  }

  const flexDir = style.flexDirection ?? 'row';
  const rowDir = isRow(flexDir);
  const justifyContent = style.justifyContent ?? 'flex-start';
  const alignItems = style.alignItems ?? 'stretch';
  const flexWrap = style.flexWrap ?? 'nowrap';
  const rowGap = style.rowGap ?? style.gap ?? 0;
  const columnGap = style.columnGap ?? style.gap ?? 0;
  const mainGap = rowDir ? columnGap : rowGap;
  const crossGap = rowDir ? rowGap : columnGap;

  // Available content area (if dimension is known)
  const contentWidth = resolvedWidth !== null ? resolvedWidth - padAndBorderH : parentWidth - margLeft - margRight - padAndBorderH;
  const contentHeight = resolvedHeight !== null ? resolvedHeight - padAndBorderV : parentHeight - margTop - margBottom - padAndBorderV;

  const availableMain = rowDir ? contentWidth : contentHeight;
  const availableCross = rowDir ? contentHeight : contentWidth;

  // Separate children
  const flowChildren: { index: number; node: LayoutInput }[] = [];
  const absChildren: { index: number; node: LayoutInput }[] = [];

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (child.style.display === 'none') {
      continue;
    }
    if (child.style.position === 'absolute') {
      absChildren.push({ index: i, node: child });
    } else {
      flowChildren.push({ index: i, node: child });
    }
  }

  // Calculate hypothetical sizes for flow children
  const lineItems: FlexLineItem[] = [];

  for (const { index, node: child } of flowChildren) {
    const childStyle = child.style;
    const [cmTop, cmRight, cmBottom, cmLeft] = resolveMargin(childStyle);

    let flexGrow: number;
    let flexShrink: number;
    let flexBasis: number | 'auto';

    // flex shorthand
    if (childStyle.flex !== undefined) {
      flexGrow = childStyle.flex;
      flexShrink = childStyle.flex > 0 ? 1 : 0;
      flexBasis = 0;
    } else {
      flexGrow = childStyle.flexGrow ?? 0;
      flexShrink = childStyle.flexShrink ?? 1;
      flexBasis = childStyle.flexBasis ?? 'auto';
    }

    // Override with explicit values if set alongside flex
    if (childStyle.flex !== undefined && childStyle.flexGrow !== undefined) {
      flexGrow = childStyle.flexGrow;
    }
    if (childStyle.flex !== undefined && childStyle.flexShrink !== undefined) {
      flexShrink = childStyle.flexShrink;
    }

    let hypotheticalMain: number;

    if (flexBasis !== 'auto') {
      hypotheticalMain = flexBasis;
    } else {
      // Use child's explicit size on main axis, or measure content
      const mainDim = rowDir ? childStyle.width : childStyle.height;
      const parentMain = rowDir ? parentWidth : parentHeight;
      const resolved = resolveSize(mainDim, parentMain);
      if (resolved !== null) {
        hypotheticalMain = resolved;
      } else if (child.text && child.measureText) {
        const measured = child.measureText(child.text, childStyle);
        hypotheticalMain = rowDir ? measured.width : measured.height;
      } else if (child.children.length > 0) {
        // Recursively compute to get intrinsic size
        const childLayout = computeLayout(child, rowDir ? contentWidth : contentWidth, rowDir ? contentHeight : contentHeight);
        hypotheticalMain = rowDir ? childLayout.width : childLayout.height;
      } else {
        hypotheticalMain = 0;
      }
    }

    // Apply child's padding/border to hypothetical size if basis was 0 or explicit
    const marginMain = rowDir ? cmLeft + cmRight : cmTop + cmBottom;
    const marginCross = rowDir ? cmTop + cmBottom : cmLeft + cmRight;
    const marginBefore = rowDir ? cmLeft : cmTop;
    const marginAfter = rowDir ? cmRight : cmBottom;
    const marginCrossBefore = rowDir ? cmTop : cmLeft;
    const marginCrossAfter = rowDir ? cmBottom : cmRight;

    lineItems.push({
      index,
      node: child,
      mainSize: hypotheticalMain,
      crossSize: 0,
      flexGrow,
      flexShrink,
      marginMain,
      marginCross,
      marginBefore,
      marginAfter,
      marginCrossBefore,
      marginCrossAfter,
      output: { x: 0, y: 0, width: 0, height: 0, children: [] },
    });
  }

  // Split into lines
  const lines: FlexLine[] = [];

  if (flexWrap === 'nowrap' || lineItems.length === 0) {
    lines.push({ items: lineItems, mainSize: 0, crossSize: 0 });
  } else {
    let currentLine: FlexLineItem[] = [];
    let currentMainSize = 0;

    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      const itemMainWithMargin = item.mainSize + item.marginMain;
      const gapSize = currentLine.length > 0 ? mainGap : 0;

      if (currentLine.length > 0 && currentMainSize + gapSize + itemMainWithMargin > availableMain) {
        lines.push({ items: currentLine, mainSize: 0, crossSize: 0 });
        currentLine = [item];
        currentMainSize = itemMainWithMargin;
      } else {
        currentLine.push(item);
        currentMainSize += gapSize + itemMainWithMargin;
      }
    }
    if (currentLine.length > 0) {
      lines.push({ items: currentLine, mainSize: 0, crossSize: 0 });
    }
  }

  // Process each line
  for (const line of lines) {
    if (line.items.length === 0) continue;

    // Calculate total hypothetical main size including gaps and margins
    const totalGaps = (line.items.length - 1) * mainGap;
    let totalHypothetical = 0;
    let totalMarginMain = 0;
    for (const item of line.items) {
      totalHypothetical += item.mainSize;
      totalMarginMain += item.marginMain;
    }

    let freeSpace = availableMain - totalHypothetical - totalMarginMain - totalGaps;

    // Flex grow / shrink
    if (freeSpace > 0) {
      let totalGrow = 0;
      for (const item of line.items) totalGrow += item.flexGrow;
      if (totalGrow > 0) {
        // Iteratively distribute, respecting min/max
        let remaining = freeSpace;
        const frozen = new Set<number>();

        for (let iteration = 0; iteration < 3 && remaining > 0.001; iteration++) {
          let activeGrow = 0;
          for (let i = 0; i < line.items.length; i++) {
            if (!frozen.has(i)) activeGrow += line.items[i].flexGrow;
          }
          if (activeGrow === 0) break;

          const spacePerGrow = remaining / activeGrow;
          let redistributed = 0;

          for (let i = 0; i < line.items.length; i++) {
            if (frozen.has(i)) continue;
            const item = line.items[i];
            if (item.flexGrow === 0) continue;

            const addition = spacePerGrow * item.flexGrow;
            const newSize = item.mainSize + addition;

            const childStyle = item.node.style;
            const maxMain = rowDir ? childStyle.maxWidth : childStyle.maxHeight;
            const minMain = rowDir ? childStyle.minWidth : childStyle.minHeight;

            let clamped = newSize;
            if (maxMain !== undefined && clamped > maxMain) {
              clamped = maxMain;
              frozen.add(i);
            }
            if (minMain !== undefined && clamped < minMain) {
              clamped = minMain;
              frozen.add(i);
            }

            redistributed += clamped - item.mainSize;
            item.mainSize = clamped;
          }

          remaining -= redistributed;
        }

        // Recalculate free space after growing
        let totalMain = 0;
        for (const item of line.items) totalMain += item.mainSize + item.marginMain;
        freeSpace = availableMain - totalMain - totalGaps;
      }
    } else if (freeSpace < 0) {
      let totalShrink = 0;
      for (const item of line.items) totalShrink += item.flexShrink * item.mainSize;

      if (totalShrink > 0) {
        const overflow = -freeSpace;
        for (const item of line.items) {
          const shrinkRatio = (item.flexShrink * item.mainSize) / totalShrink;
          const reduction = overflow * shrinkRatio;
          item.mainSize = Math.max(0, item.mainSize - reduction);

          const childStyle = item.node.style;
          const minMain = rowDir ? childStyle.minWidth : childStyle.minHeight;
          if (minMain !== undefined) {
            item.mainSize = Math.max(item.mainSize, minMain);
          }
        }

        // Recalculate free space
        let totalMain = 0;
        for (const item of line.items) totalMain += item.mainSize + item.marginMain;
        freeSpace = availableMain - totalMain - totalGaps;
      }
    }

    // Compute each child layout to get cross sizes
    for (const item of line.items) {
      const childStyle = item.node.style;
      const childMainSize = item.mainSize;

      let childCrossSize: number;
      const crossDim = rowDir ? childStyle.height : childStyle.width;
      const parentCross = rowDir ? parentHeight : parentWidth;
      const resolvedCross = resolveSize(crossDim, parentCross);

      if (resolvedCross !== null) {
        childCrossSize = resolvedCross;
      } else {
        // Need to compute layout to find intrinsic cross size
        const childW = rowDir ? childMainSize : (resolvedWidth !== null ? contentWidth : contentWidth);
        const childH = rowDir ? (resolvedHeight !== null ? contentHeight : contentHeight) : childMainSize;

        const childLayout = computeLayout(item.node, childW, childH);
        childCrossSize = rowDir ? childLayout.height : childLayout.width;
      }

      // Apply min/max on cross axis
      const minCross = rowDir ? childStyle.minHeight : childStyle.minWidth;
      const maxCross = rowDir ? childStyle.maxHeight : childStyle.maxWidth;
      childCrossSize = clamp(childCrossSize, minCross, maxCross);

      item.crossSize = childCrossSize;
    }

    // Line cross size = max of children cross sizes + their cross margins
    let lineCrossSize = 0;
    for (const item of line.items) {
      lineCrossSize = Math.max(lineCrossSize, item.crossSize + item.marginCross);
    }
    line.crossSize = lineCrossSize;

    // Total main occupied
    let totalMainOccupied = 0;
    for (const item of line.items) {
      totalMainOccupied += item.mainSize + item.marginMain;
    }
    totalMainOccupied += totalGaps;
    line.mainSize = totalMainOccupied;
  }

  // Determine container's auto dimensions
  let autoMainSize = 0;
  let autoCrossSize = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    autoMainSize = Math.max(autoMainSize, line.mainSize);
    autoCrossSize += line.crossSize;
    if (i > 0) autoCrossSize += crossGap;
  }

  // Final container sizes
  let containerWidth: number;
  let containerHeight: number;

  if (resolvedWidth !== null) {
    containerWidth = resolvedWidth;
  } else {
    const autoW = rowDir ? autoMainSize + padAndBorderH : autoCrossSize + padAndBorderH;
    containerWidth = clamp(autoW, style.minWidth, style.maxWidth);
  }

  if (resolvedHeight !== null) {
    containerHeight = resolvedHeight;
  } else {
    const autoH = rowDir ? autoCrossSize + padAndBorderV : autoMainSize + padAndBorderV;
    containerHeight = clamp(autoH, style.minHeight, style.maxHeight);
  }

  // Recalculate content area with final sizes
  const finalContentWidth = containerWidth - padAndBorderH;
  const finalContentHeight = containerHeight - padAndBorderV;
  // Use the larger of content dimensions (from parent constraints) and final container dimensions
  // This ensures flex children use parent-determined space for justify/align calculations
  const effectiveContentWidth = Math.max(finalContentWidth, contentWidth);
  const effectiveContentHeight = Math.max(finalContentHeight, contentHeight);
  const finalAvailableMain = rowDir ? effectiveContentWidth : effectiveContentHeight;
  const finalAvailableCross = rowDir ? effectiveContentHeight : effectiveContentWidth;

  // Align content (distribute lines along cross axis)
  const totalLinesCross = lines.reduce((sum, l) => sum + l.crossSize, 0) +
    (lines.length > 1 ? (lines.length - 1) * crossGap : 0);
  const freeCrossSpace = finalAvailableCross - totalLinesCross;

  const alignContent = style.alignContent ?? 'stretch';
  const lineOffsets: number[] = [];
  let crossCursor = 0;

  if (lines.length <= 1 || flexWrap === 'nowrap') {
    lineOffsets.push(0);
    if (lines.length === 1) {
      // Expand line cross size to fill available cross space
      // This handles both explicit dimensions AND parent-determined dimensions (flex stretch)
      lines[0].crossSize = Math.max(lines[0].crossSize, finalAvailableCross);
    }
  } else {
    // Multi-line align content
    switch (alignContent) {
      case 'flex-start':
        for (let i = 0; i < lines.length; i++) {
          lineOffsets.push(crossCursor);
          crossCursor += lines[i].crossSize + crossGap;
        }
        break;
      case 'flex-end':
        crossCursor = freeCrossSpace;
        for (let i = 0; i < lines.length; i++) {
          lineOffsets.push(crossCursor);
          crossCursor += lines[i].crossSize + crossGap;
        }
        break;
      case 'center':
        crossCursor = freeCrossSpace / 2;
        for (let i = 0; i < lines.length; i++) {
          lineOffsets.push(crossCursor);
          crossCursor += lines[i].crossSize + crossGap;
        }
        break;
      case 'space-between':
        {
          const spaceBetween = lines.length > 1 ? freeCrossSpace / (lines.length - 1) : 0;
          for (let i = 0; i < lines.length; i++) {
            lineOffsets.push(crossCursor);
            crossCursor += lines[i].crossSize + spaceBetween;
          }
        }
        break;
      case 'space-around':
        {
          const spaceAround = freeCrossSpace / lines.length;
          crossCursor = spaceAround / 2;
          for (let i = 0; i < lines.length; i++) {
            lineOffsets.push(crossCursor);
            crossCursor += lines[i].crossSize + spaceAround;
          }
        }
        break;
      case 'stretch':
        {
          const extraPerLine = lines.length > 0 ? freeCrossSpace / lines.length : 0;
          for (let i = 0; i < lines.length; i++) {
            lineOffsets.push(crossCursor);
            lines[i].crossSize += extraPerLine;
            crossCursor += lines[i].crossSize + crossGap;
          }
        }
        break;
    }
  }

  // Position items within lines
  const childOutputs: { index: number; output: LayoutOutput }[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (line.items.length === 0) continue;

    const lineOffset = lineOffsets[lineIdx] ?? 0;

    // Recalculate free space on main axis with final available main
    const totalGaps = (line.items.length - 1) * mainGap;
    let totalMainUsed = 0;
    for (const item of line.items) {
      totalMainUsed += item.mainSize + item.marginMain;
    }
    const mainFreeSpace = Math.max(0, finalAvailableMain - totalMainUsed - totalGaps);

    // Justify content
    let mainCursor = 0;
    let mainSpaceBetween = 0;

    switch (justifyContent) {
      case 'flex-start':
        mainCursor = 0;
        break;
      case 'flex-end':
        mainCursor = mainFreeSpace;
        break;
      case 'center':
        mainCursor = mainFreeSpace / 2;
        break;
      case 'space-between':
        mainCursor = 0;
        mainSpaceBetween = line.items.length > 1 ? mainFreeSpace / (line.items.length - 1) : 0;
        break;
      case 'space-around':
        {
          const spaceAround = mainFreeSpace / line.items.length;
          mainCursor = spaceAround / 2;
          mainSpaceBetween = spaceAround;
        }
        break;
      case 'space-evenly':
        {
          const spaceEvenly = mainFreeSpace / (line.items.length + 1);
          mainCursor = spaceEvenly;
          mainSpaceBetween = spaceEvenly;
        }
        break;
    }

    for (let i = 0; i < line.items.length; i++) {
      const item = line.items[i];
      const childStyle = item.node.style;

      // Resolve align for this item
      const selfAlign = childStyle.alignSelf && childStyle.alignSelf !== 'auto'
        ? childStyle.alignSelf
        : alignItems;

      // Cross axis positioning
      let crossPos = lineOffset + item.marginCrossBefore;
      let finalCrossSize = item.crossSize;

      switch (selfAlign) {
        case 'flex-start':
          crossPos = lineOffset + item.marginCrossBefore;
          break;
        case 'flex-end':
          crossPos = lineOffset + line.crossSize - item.crossSize - item.marginCrossAfter;
          break;
        case 'center':
          crossPos = lineOffset + (line.crossSize - item.crossSize - item.marginCross) / 2 + item.marginCrossBefore;
          break;
        case 'stretch':
          crossPos = lineOffset + item.marginCrossBefore;
          finalCrossSize = line.crossSize - item.marginCross;
          break;
      }

      // Main axis position
      const mainPos = mainCursor + item.marginBefore;

      // Compute final child layout with resolved sizes
      const childW = rowDir ? item.mainSize : finalCrossSize;
      const childH = rowDir ? finalCrossSize : item.mainSize;

      const childLayout = computeLayout(item.node, childW, childH);

      // Override the child's width/height if we've determined them
      childLayout.width = childW;
      childLayout.height = childH;

      // Set position
      if (rowDir) {
        childLayout.x = padLeft + borderLeft + mainPos;
        childLayout.y = padTop + borderTop + crossPos;
      } else {
        childLayout.x = padLeft + borderLeft + crossPos;
        childLayout.y = padTop + borderTop + mainPos;
      }

      childOutputs.push({ index: item.index, output: childLayout });

      mainCursor += item.marginBefore + item.mainSize + item.marginAfter + mainGap;
      if (i < line.items.length - 1) {
        mainCursor += mainSpaceBetween;
      }
    }
  }

  // Handle reverse directions
  if (isReversed(flexDir)) {
    for (const { output } of childOutputs) {
      if (rowDir) {
        output.x = containerWidth - output.x - output.width;
      } else {
        output.y = containerHeight - output.y - output.height;
      }
    }
  }

  // Handle wrap-reverse
  if (flexWrap === 'wrap-reverse' && lines.length > 1) {
    // Mirror cross positions
    for (const { output } of childOutputs) {
      if (rowDir) {
        output.y = containerHeight - output.y - output.height;
      } else {
        output.x = containerWidth - output.x - output.width;
      }
    }
  }

  // Handle absolute children
  for (const { index, node: child } of absChildren) {
    const childStyle = child.style;
    const [cmTop, cmRight, cmBottom, cmLeft] = resolveMargin(childStyle);

    let childW = resolveSize(childStyle.width, finalContentWidth);
    let childH = resolveSize(childStyle.height, finalContentHeight);

    // Infer size from offsets
    if (childW === null && childStyle.left !== undefined && childStyle.right !== undefined) {
      childW = finalContentWidth - childStyle.left - childStyle.right - cmLeft - cmRight;
    }
    if (childH === null && childStyle.top !== undefined && childStyle.bottom !== undefined) {
      childH = finalContentHeight - childStyle.top - childStyle.bottom - cmTop - cmBottom;
    }

    const resolvedChildW = childW ?? 0;
    const resolvedChildH = childH ?? 0;

    const childLayout = computeLayout(child, resolvedChildW, resolvedChildH);
    childLayout.width = resolvedChildW;
    childLayout.height = resolvedChildH;

    // Position relative to parent's padding box
    let x = padLeft + borderLeft + cmLeft;
    let y = padTop + borderTop + cmTop;

    if (childStyle.left !== undefined) {
      x = padLeft + borderLeft + childStyle.left + cmLeft;
    } else if (childStyle.right !== undefined) {
      x = containerWidth - padRight - borderRight - childStyle.right - resolvedChildW - cmRight;
    }

    if (childStyle.top !== undefined) {
      y = padTop + borderTop + childStyle.top + cmTop;
    } else if (childStyle.bottom !== undefined) {
      y = containerHeight - padBottom - borderBottom - childStyle.bottom - resolvedChildH - cmBottom;
    }

    childLayout.x = x;
    childLayout.y = y;

    childOutputs.push({ index, output: childLayout });
  }

  // Handle display: none children (produce zero-size outputs)
  for (let i = 0; i < node.children.length; i++) {
    if (node.children[i].style.display === 'none') {
      childOutputs.push({
        index: i,
        output: { x: 0, y: 0, width: 0, height: 0, children: [] },
      });
    }
  }

  // Sort children by original index
  childOutputs.sort((a, b) => a.index - b.index);

  // Handle text measurement for leaf nodes
  if (node.children.length === 0 && node.text && node.measureText) {
    const measured = node.measureText(node.text, style);
    if (resolvedWidth === null) {
      containerWidth = clamp(measured.width + padAndBorderH, style.minWidth, style.maxWidth);
    }
    if (resolvedHeight === null) {
      containerHeight = clamp(measured.height + padAndBorderV, style.minHeight, style.maxHeight);
    }
  }

  return {
    x: 0,
    y: 0,
    width: containerWidth,
    height: containerHeight,
    children: childOutputs.map((c) => c.output),
  };
}
