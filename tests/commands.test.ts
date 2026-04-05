import { describe, it, expect, beforeEach } from 'bun:test';
import Yoga from 'yoga-layout';
import { createGlyphisNode } from '../src/node';
import type { GlyphisNode } from '../src/node';
import { applyStyle } from '../src/styles';
import { generateCommands } from '../src/commands';

function makeNode(tag: string, style: GlyphisNode['style'] = {}): GlyphisNode {
  const yoga = Yoga.Node.create();
  const node = createGlyphisNode(yoga, tag);
  node.style = style;
  applyStyle(yoga, style);
  return node;
}

function appendChild(parent: GlyphisNode, child: GlyphisNode): void {
  parent.yoga.insertChild(child.yoga, parent.children.length);
  parent.children.push(child);
  child.parent = parent;
}

function layout(root: GlyphisNode): void {
  root.yoga.calculateLayout(undefined, undefined);
}

describe('generateCommands', () => {
  it('empty root produces no commands', () => {
    const root = makeNode('View', { width: 100, height: 100 });
    layout(root);
    const cmds = generateCommands(root);
    expect(cmds).toEqual([]);
  });

  it('view with backgroundColor produces a rect command', () => {
    const root = makeNode('View', { width: 200, height: 150, backgroundColor: '#ff0000' });
    layout(root);
    const cmds = generateCommands(root);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({
      type: 'rect',
      x: 0,
      y: 0,
      width: 200,
      height: 150,
      color: '#ff0000',
    });
  });

  it('view with borderWidth + borderColor produces a border command', () => {
    const root = makeNode('View', {
      width: 100,
      height: 100,
      borderWidth: 2,
      borderColor: '#00ff00',
    });
    layout(root);
    const cmds = generateCommands(root);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({
      type: 'border',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      color: '#00ff00',
      widths: [2, 2, 2, 2],
    });
  });

  it('text node produces a text command with parent color/fontSize', () => {
    const root = makeNode('Text', {
      width: 200,
      height: 50,
      color: '#0000ff',
      fontSize: 24,
    });
    const textNode = makeNode('__text', {});
    textNode.text = 'Hello World';
    appendChild(root, textNode);
    layout(root);

    const cmds = generateCommands(root);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({
      type: 'text',
      text: 'Hello World',
      color: '#0000ff',
      fontSize: 24,
    });
  });

  it('text node with no text produces no commands', () => {
    const root = makeNode('Text', { width: 100, height: 50, color: '#000' });
    const textNode = makeNode('__text', {});
    textNode.text = '';
    appendChild(root, textNode);
    layout(root);

    const cmds = generateCommands(root);
    expect(cmds).toEqual([]);
  });

  it('text node defaults to black color and fontSize 14 when parent has no style', () => {
    const root = makeNode('View', { width: 200, height: 50 });
    const textNode = makeNode('__text', {});
    textNode.text = 'Default';
    appendChild(root, textNode);
    layout(root);

    const cmds = generateCommands(root);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({
      type: 'text',
      color: '#000000',
      fontSize: 14,
    });
  });

  it('nested views produce commands in correct order (parent before children)', () => {
    const parent = makeNode('View', { width: 300, height: 300, backgroundColor: '#aaa' });
    const child = makeNode('View', { width: 100, height: 100, backgroundColor: '#bbb' });
    appendChild(parent, child);
    layout(parent);

    const cmds = generateCommands(parent);
    expect(cmds).toHaveLength(2);
    expect(cmds[0]).toMatchObject({ type: 'rect', color: '#aaa' });
    expect(cmds[1]).toMatchObject({ type: 'rect', color: '#bbb' });
  });

  it('overflow hidden produces clip-start and clip-end commands', () => {
    const root = makeNode('View', {
      width: 200,
      height: 200,
      overflow: 'hidden',
      backgroundColor: '#fff',
    });
    const child = makeNode('View', { width: 50, height: 50, backgroundColor: '#000' });
    appendChild(root, child);
    layout(root);

    const cmds = generateCommands(root);
    const types = cmds.map((c) => c.type);
    expect(types).toEqual(['rect', 'clip-start', 'rect', 'clip-end']);

    const clipStart = cmds[1];
    const clipEnd = cmds[3];
    expect(clipStart).toMatchObject({
      type: 'clip-start',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
    expect(clipEnd).toMatchObject({ type: 'clip-end' });
    // clip-start and clip-end share the same id
    expect((clipStart as any).id).toBe((clipEnd as any).id);
  });

  it('overflow scroll also produces clip commands', () => {
    const root = makeNode('View', {
      width: 100,
      height: 100,
      overflow: 'scroll',
    });
    const child = makeNode('View', { width: 50, height: 50, backgroundColor: '#000' });
    appendChild(root, child);
    layout(root);

    const cmds = generateCommands(root);
    const types = cmds.map((c) => c.type);
    expect(types).toEqual(['clip-start', 'rect', 'clip-end']);
  });

  it('opacity property is included in commands', () => {
    const root = makeNode('View', {
      width: 100,
      height: 100,
      backgroundColor: '#ff0000',
      opacity: 0.5,
    });
    layout(root);

    const cmds = generateCommands(root);
    expect(cmds).toHaveLength(1);
    expect((cmds[0] as any).opacity).toBe(0.5);
  });

  it('borderRadius is included in rect commands', () => {
    const root = makeNode('View', {
      width: 100,
      height: 100,
      backgroundColor: '#ff0000',
      borderRadius: 10,
    });
    layout(root);

    const cmds = generateCommands(root);
    expect(cmds).toHaveLength(1);
    expect((cmds[0] as any).borderRadius).toBe(10);
  });

  it('borderRadius is included in border commands', () => {
    const root = makeNode('View', {
      width: 100,
      height: 100,
      borderWidth: 1,
      borderColor: '#000',
      borderRadius: 8,
    });
    layout(root);

    const cmds = generateCommands(root);
    expect(cmds).toHaveLength(1);
    expect((cmds[0] as any).borderRadius).toBe(8);
  });

  it('text inherits style from parent text container', () => {
    const container = makeNode('View', { width: 400, height: 400 });
    const textContainer = makeNode('Text', {
      width: 300,
      height: 40,
      color: '#123456',
      fontSize: 20,
      fontWeight: 'bold',
      fontFamily: 'monospace',
      textAlign: 'center',
    });
    const textNode = makeNode('__text', {});
    textNode.text = 'Styled Text';
    appendChild(textContainer, textNode);
    appendChild(container, textContainer);
    layout(container);

    const cmds = generateCommands(container);
    expect(cmds).toHaveLength(1);
    const textCmd = cmds[0];
    expect(textCmd).toMatchObject({
      type: 'text',
      text: 'Styled Text',
      color: '#123456',
      fontSize: 20,
      fontWeight: 'bold',
      fontFamily: 'monospace',
      textAlign: 'center',
    });
  });

  it('individual border widths override the general borderWidth', () => {
    const root = makeNode('View', {
      width: 100,
      height: 100,
      borderWidth: 2,
      borderTopWidth: 4,
      borderRightWidth: 6,
      borderColor: '#000',
    });
    layout(root);

    const cmds = generateCommands(root);
    expect(cmds).toHaveLength(1);
    expect((cmds[0] as any).widths).toEqual([4, 6, 2, 2]);
  });

  it('child commands use accumulated parent coordinates', () => {
    const root = makeNode('View', { width: 300, height: 300, padding: 20 });
    const child = makeNode('View', {
      width: 50,
      height: 50,
      backgroundColor: '#f00',
    });
    appendChild(root, child);
    layout(root);

    const cmds = generateCommands(root);
    expect(cmds).toHaveLength(1);
    const rectCmd = cmds[0] as any;
    // Child should be offset by parent padding
    expect(rectCmd.x).toBe(20);
    expect(rectCmd.y).toBe(20);
  });

  it('clipId is passed to child commands inside overflow hidden', () => {
    const root = makeNode('View', {
      width: 200,
      height: 200,
      overflow: 'hidden',
    });
    const child = makeNode('View', {
      width: 50,
      height: 50,
      backgroundColor: '#f00',
    });
    appendChild(root, child);
    layout(root);

    const cmds = generateCommands(root);
    const clipStart = cmds.find((c) => c.type === 'clip-start') as any;
    const childRect = cmds.find((c) => c.type === 'rect') as any;
    expect(childRect.clipId).toBe(clipStart.id);
  });
});
