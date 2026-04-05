import type { RenderCommand } from './types';
import type { GlyphisNode } from './node';

let clipIdCounter = 0;

export function generateCommands(root: GlyphisNode): RenderCommand[] {
  const commands: RenderCommand[] = [];
  clipIdCounter = 0;
  walkNode(root, 0, 0, commands, undefined);
  return commands;
}

function walkNode(
  node: GlyphisNode,
  parentX: number,
  parentY: number,
  commands: RenderCommand[],
  clipId: number | undefined,
): void {
  const layout = node.yoga.getComputedLayout();
  const x = parentX + layout.left;
  const y = parentY + layout.top;
  const w = layout.width;
  const h = layout.height;
  const style = node.style;
  const opacity = style.opacity;

  if (node.tag === '__text') {
    const text = node.text;
    if (!text) return;
    const parentStyle = node.parent ? node.parent.style : {};
    commands.push({
      type: 'text',
      x, y,
      text,
      color: parentStyle.color || '#000000',
      fontSize: parentStyle.fontSize || 14,
      fontWeight: parentStyle.fontWeight,
      fontFamily: parentStyle.fontFamily,
      textAlign: parentStyle.textAlign,
      maxWidth: w,
      opacity,
      clipId,
    });
    return;
  }

  if (style.backgroundColor) {
    commands.push({
      type: 'rect',
      x, y, width: w, height: h,
      color: style.backgroundColor,
      borderRadius: style.borderRadius,
      opacity,
      clipId,
    });
  }

  if (style.borderWidth && style.borderColor) {
    const bw = style.borderWidth;
    commands.push({
      type: 'border',
      x, y, width: w, height: h,
      color: style.borderColor,
      widths: [
        style.borderTopWidth != null ? style.borderTopWidth : bw,
        style.borderRightWidth != null ? style.borderRightWidth : bw,
        style.borderBottomWidth != null ? style.borderBottomWidth : bw,
        style.borderLeftWidth != null ? style.borderLeftWidth : bw,
      ],
      borderRadius: style.borderRadius,
      opacity,
      clipId,
    });
  }

  let childClipId = clipId;
  const needsClip = style.overflow === 'hidden' || style.overflow === 'scroll';
  if (needsClip) {
    childClipId = ++clipIdCounter;
    commands.push({
      type: 'clip-start',
      id: childClipId,
      x, y, width: w, height: h,
      borderRadius: style.borderRadius,
    });
  }

  for (const child of node.children) {
    walkNode(child, x, y, commands, childClipId);
  }

  if (needsClip) {
    commands.push({ type: 'clip-end', id: childClipId! });
  }
}
