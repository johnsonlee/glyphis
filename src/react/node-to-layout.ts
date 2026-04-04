import type { Style, Renderer } from '../types';
import type { LayoutInput, LayoutOutput } from '../layout';
import { GlyphNode, HOST_TYPES } from './glyph-node';

export function nodeToLayoutInput(node: GlyphNode, renderer: Renderer): LayoutInput {
  const style: Style = node.props.style || {};
  const children: LayoutInput[] = [];

  for (const child of node.children) {
    children.push(nodeToLayoutInput(child, renderer));
  }

  const input: LayoutInput = { style, children };

  // Text measurement for text leaf nodes
  if (node.type === HOST_TYPES.TEXT_LEAF && node.text) {
    const parentStyle = node.parent?.props.style || {};
    input.text = node.text;
    input.measureText = (t: string, s: Style) => {
      return renderer.measureText(
        t,
        s.fontSize || parentStyle.fontSize || style.fontSize || 14,
        s.fontFamily || parentStyle.fontFamily || style.fontFamily || 'system-ui',
        String(s.fontWeight || parentStyle.fontWeight || style.fontWeight || 'normal'),
      );
    };
  } else if (node.type === HOST_TYPES.TEXT && node.children.length > 0) {
    // Text host might have text leaf children -- collect text for measurement
    const textParts: string[] = [];
    for (const child of node.children) {
      if (child.type === HOST_TYPES.TEXT_LEAF && child.text) {
        textParts.push(child.text);
      }
    }
    if (textParts.length > 0) {
      input.text = textParts.join('');
      input.measureText = (t: string, s: Style) => {
        return renderer.measureText(
          t,
          s.fontSize || style.fontSize || 14,
          s.fontFamily || style.fontFamily || 'system-ui',
          String(s.fontWeight || style.fontWeight || 'normal'),
        );
      };
    }
  }

  return input;
}

export function buildNodeLayoutMap(
  node: GlyphNode,
  layout: LayoutOutput,
): Map<GlyphNode, LayoutOutput> {
  const map = new Map<GlyphNode, LayoutOutput>();
  mapNodeToLayout(node, layout, map);
  return map;
}

function mapNodeToLayout(
  node: GlyphNode,
  layout: LayoutOutput,
  map: Map<GlyphNode, LayoutOutput>,
): void {
  map.set(node, layout);
  for (let i = 0; i < node.children.length && i < layout.children.length; i++) {
    mapNodeToLayout(node.children[i], layout.children[i], map);
  }
}
