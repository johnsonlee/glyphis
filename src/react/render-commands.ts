import type { AnyRenderCommand } from '../types';
import type { LayoutOutput } from '../layout';
import { resolveBorderWidth, resolveBorderColor, resolveBorderRadius } from '../types';
import { GlyphNode, HOST_TYPES } from './glyph-node';
import { isDebugMode, DEBUG_COLORS } from '../render-tree';

export function generateNodeRenderCommands(
  node: GlyphNode,
  layoutMap: Map<GlyphNode, LayoutOutput>,
): AnyRenderCommand[] {
  const commands: AnyRenderCommand[] = [];
  walkNode(node, layoutMap, commands, 0, 0, 0);
  return commands;
}

function walkNode(
  node: GlyphNode,
  layoutMap: Map<GlyphNode, LayoutOutput>,
  commands: AnyRenderCommand[],
  offsetX: number,
  offsetY: number,
  depth: number,
): void {
  const layout = layoutMap.get(node);
  if (!layout) return;

  const style = node.props.style || {};
  const x = offsetX + layout.x;
  const y = offsetY + layout.y;

  // Opacity
  if (style.opacity !== undefined && style.opacity < 1) {
    commands.push({ type: 'opacity', opacity: style.opacity });
  }

  // Clipping
  if (style.overflow === 'hidden' || style.overflow === 'scroll') {
    commands.push({
      type: 'clip', x, y,
      width: layout.width, height: layout.height,
      borderRadius: resolveBorderRadius(style),
    });
  }

  // Background
  if (style.backgroundColor) {
    commands.push({
      type: 'rect', x, y,
      width: layout.width, height: layout.height,
      color: style.backgroundColor,
      borderRadius: resolveBorderRadius(style),
    });
  }

  // Border
  const bw = resolveBorderWidth(style);
  if (bw[0] > 0 || bw[1] > 0 || bw[2] > 0 || bw[3] > 0) {
    commands.push({
      type: 'border', x, y,
      width: layout.width, height: layout.height,
      widths: bw,
      colors: resolveBorderColor(style),
      borderRadius: resolveBorderRadius(style),
    });
  }

  // Text leaf
  if (node.type === HOST_TYPES.TEXT_LEAF && node.text) {
    const parentStyle = node.parent?.props.style || {};
    commands.push({
      type: 'text', x, y,
      width: layout.width,
      text: node.text,
      color: parentStyle.color || style.color || '#000000',
      fontSize: parentStyle.fontSize || style.fontSize || 14,
      fontWeight: String(parentStyle.fontWeight || style.fontWeight || 'normal'),
      fontFamily: parentStyle.fontFamily || style.fontFamily || 'system-ui',
      textAlign: parentStyle.textAlign || style.textAlign || 'left',
      lineHeight: parentStyle.lineHeight || style.lineHeight,
    });
  }

  // Image
  if (node.type === HOST_TYPES.IMAGE && node.props.src) {
    commands.push({
      type: 'image', x, y,
      width: layout.width, height: layout.height,
      src: node.props.src,
      borderRadius: style.borderRadius,
    });
  }

  // Debug borders
  if (isDebugMode()) {
    const debugColor = DEBUG_COLORS[depth % DEBUG_COLORS.length];
    commands.push({
      type: 'border', x, y,
      width: layout.width, height: layout.height,
      widths: [1, 1, 1, 1],
      colors: [debugColor, debugColor, debugColor, debugColor],
    });
  }

  // Children
  for (const child of node.children) {
    walkNode(child, layoutMap, commands, x, y, depth + 1);
  }

  // Restore clipping
  if (style.overflow === 'hidden' || style.overflow === 'scroll') {
    commands.push({ type: 'restore' });
  }

  // Restore opacity
  if (style.opacity !== undefined && style.opacity < 1) {
    commands.push({ type: 'restoreOpacity' });
  }
}
