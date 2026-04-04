import type { LayoutOutput } from './layout';
import type { AnyRenderCommand, Fiber } from './types';
import { resolveBorderWidth, resolveBorderColor, resolveBorderRadius } from './types';

let debugMode = false;

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

export function isDebugMode(): boolean {
  return debugMode;
}

export const DEBUG_COLORS = [
  'rgba(255, 0, 0, 0.3)',    // red
  'rgba(0, 128, 255, 0.3)',  // blue
  'rgba(0, 200, 0, 0.3)',    // green
  'rgba(255, 165, 0, 0.3)',  // orange
  'rgba(128, 0, 255, 0.3)',  // purple
  'rgba(255, 0, 128, 0.3)',  // pink
];

export function generateRenderCommands(
  fiber: Fiber,
  layoutMap: Map<Fiber, LayoutOutput>,
): AnyRenderCommand[] {
  const commands: AnyRenderCommand[] = [];
  walkFiber(fiber, layoutMap, commands, 0, 0, 0);
  return commands;
}

function walkFiber(
  fiber: Fiber,
  layoutMap: Map<Fiber, LayoutOutput>,
  commands: AnyRenderCommand[],
  offsetX: number,
  offsetY: number,
  depth: number = 0,
): void {
  const layout = layoutMap.get(fiber);
  if (!layout) {
    // Component/fragment fibers don't have layout entries,
    // but their children do — keep walking
    let child = fiber.child;
    while (child) {
      walkFiber(child, layoutMap, commands, offsetX, offsetY, depth);
      child = child.sibling;
    }
    return;
  }

  const style = fiber.props.style || {};
  const x = offsetX + layout.x;
  const y = offsetY + layout.y;

  // Push opacity layer
  if (style.opacity !== undefined && style.opacity < 1) {
    commands.push({ type: 'opacity', opacity: style.opacity });
  }

  // Push clipping for overflow
  if (style.overflow === 'hidden' || style.overflow === 'scroll') {
    commands.push({
      type: 'clip',
      x,
      y,
      width: layout.width,
      height: layout.height,
      borderRadius: resolveBorderRadius(style),
    });
  }

  // Background color
  if (style.backgroundColor) {
    commands.push({
      type: 'rect',
      x,
      y,
      width: layout.width,
      height: layout.height,
      color: style.backgroundColor,
      borderRadius: resolveBorderRadius(style),
    });
  }

  // Borders
  const bw = resolveBorderWidth(style);
  if (bw[0] > 0 || bw[1] > 0 || bw[2] > 0 || bw[3] > 0) {
    commands.push({
      type: 'border',
      x,
      y,
      width: layout.width,
      height: layout.height,
      widths: bw,
      colors: resolveBorderColor(style),
      borderRadius: resolveBorderRadius(style),
    });
  }

  // Text content
  if (fiber.tag === 'text' && fiber.props.nodeValue) {
    const parentStyle = fiber.parent?.props.style || {};
    commands.push({
      type: 'text',
      x,
      y,
      width: layout.width,
      text: String(fiber.props.nodeValue),
      color: parentStyle.color || style.color || '#000000',
      fontSize: parentStyle.fontSize || style.fontSize || 14,
      fontWeight: String(parentStyle.fontWeight || style.fontWeight || 'normal'),
      fontFamily: parentStyle.fontFamily || style.fontFamily || 'system-ui',
      textAlign: parentStyle.textAlign || style.textAlign || 'left',
      lineHeight: parentStyle.lineHeight || style.lineHeight,
    });
  }

  // Image
  if (fiber.type === 'Image' && fiber.props.src) {
    commands.push({
      type: 'image',
      x,
      y,
      width: layout.width,
      height: layout.height,
      src: fiber.props.src,
      borderRadius: style.borderRadius,
    });
  }

  // Debug mode: draw a colored border around every layout node
  if (debugMode && layout) {
    const debugColor = DEBUG_COLORS[depth % DEBUG_COLORS.length];
    commands.push({
      type: 'border',
      x,
      y,
      width: layout.width,
      height: layout.height,
      widths: [1, 1, 1, 1],
      colors: [debugColor, debugColor, debugColor, debugColor],
    });
  }

  // Recurse into children
  let child = fiber.child;
  while (child) {
    walkFiber(child, layoutMap, commands, x, y, depth + 1);
    child = child.sibling;
  }

  // Pop clipping
  if (style.overflow === 'hidden' || style.overflow === 'scroll') {
    commands.push({ type: 'restore' });
  }

  // Pop opacity
  if (style.opacity !== undefined && style.opacity < 1) {
    commands.push({ type: 'restoreOpacity' });
  }
}
