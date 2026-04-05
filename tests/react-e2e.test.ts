import { describe, it, expect } from 'bun:test';
import React, { useState, useCallback } from 'react';
import { GlyphisNode, HOST_TYPES, renderReact } from '../src/react/renderer';
import { nodeToLayoutInput, buildNodeLayoutMap } from '../src/react/node-to-layout';
import { generateNodeRenderCommands } from '../src/react/render-commands';
import { NodeEventManager, hitTestNode } from '../src/react/event-handler';
import { computeLayout } from '../src/layout';
import type { Renderer, TextCommand } from '../src/types';
import type { LayoutOutput } from '../src/layout';

const mockRenderer: Renderer = {
  clear() {},
  render() {},
  getWidth() { return 390; },
  getHeight() { return 844; },
  measureText(text: string, fontSize: number, _fontFamily: string, _fontWeight: string) {
    return { width: text.length * fontSize * 0.6, height: fontSize * 1.2 };
  },
};

function flushAll(ms = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function renderPass(rootNode: GlyphisNode) {
  const layoutInput = nodeToLayoutInput(rootNode, mockRenderer);
  layoutInput.style = { ...layoutInput.style, width: 390, height: 844 };
  const layoutOutput = computeLayout(layoutInput, 390, 844);
  const layoutMap = buildNodeLayoutMap(rootNode, layoutOutput);
  const commands = generateNodeRenderCommands(rootNode, layoutMap);
  return { commands, layoutMap, layoutOutput };
}

function findPressable(node: GlyphisNode): GlyphisNode | null {
  if (node.props.onPress) return node;
  for (const child of node.children) {
    const found = findPressable(child);
    if (found) return found;
  }
  return null;
}

function getTextCommands(commands: any[]): string[] {
  return commands
    .filter((c: any) => c.type === 'text')
    .map((c: TextCommand) => c.text);
}

describe('React end-to-end', () => {
  it('counter increments on button press', async () => {
    function Counter() {
      const [count, setCount] = useState(0);
      const inc = useCallback(() => setCount(c => c + 1), []);
      return React.createElement('glyphis-view', { style: { flex: 1, flexDirection: 'column', width: 390, height: 844 } },
        React.createElement('glyphis-text', { style: { fontSize: 24, height: 30 } }, String(count)),
        React.createElement('glyphis-view', {
          style: { width: 80, height: 40 },
          onPress: inc,
        },
          React.createElement('glyphis-text', { style: { fontSize: 16 } }, 'Click'),
        ),
      );
    }

    const rootNode = new GlyphisNode(HOST_TYPES.ROOT, {});
    renderReact(React.createElement(Counter), rootNode, () => {});
    await flushAll();

    // Initial render
    let { commands, layoutMap } = renderPass(rootNode);
    let textCmds = getTextCommands(commands);
    expect(textCmds).toContain('0');
    expect(textCmds).toContain('Click');

    // Find the pressable button node
    const btn = findPressable(rootNode);
    expect(btn).not.toBeNull();

    const btnLayout = layoutMap.get(btn!);
    expect(btnLayout).toBeDefined();

    if (btnLayout) {
      const em = new NodeEventManager();
      em.setRoot(rootNode, layoutMap);
      const cx = btnLayout.x + btnLayout.width / 2;
      const cy = btnLayout.y + btnLayout.height / 2;
      em.handlePointerDown(cx, cy);
      em.handlePointerUp(cx, cy);
    }

    await flushAll();

    // After click the count should be 1
    ({ commands } = renderPass(rootNode));
    textCmds = getTextCommands(commands);
    expect(textCmds).toContain('1');
  });

  it('toggle visibility on press', async () => {
    function Toggle() {
      const [visible, setVisible] = useState(false);
      const toggle = useCallback(() => setVisible(v => !v), []);

      return React.createElement('glyphis-view', { style: { flex: 1, flexDirection: 'column', width: 390, height: 844 } },
        React.createElement('glyphis-view', {
          style: { width: 100, height: 40 },
          onPress: toggle,
        },
          React.createElement('glyphis-text', { style: { fontSize: 14 } }, 'Toggle'),
        ),
        visible
          ? React.createElement('glyphis-text', { style: { fontSize: 20, height: 30 } }, 'Shown')
          : null,
      );
    }

    const rootNode = new GlyphisNode(HOST_TYPES.ROOT, {});
    renderReact(React.createElement(Toggle), rootNode, () => {});
    await flushAll();

    // Initial: "Shown" should NOT be present
    let { commands, layoutMap } = renderPass(rootNode);
    let textCmds = getTextCommands(commands);
    expect(textCmds).not.toContain('Shown');
    expect(textCmds).toContain('Toggle');

    // Press the toggle button
    const btn = findPressable(rootNode);
    expect(btn).not.toBeNull();

    const btnLayout = layoutMap.get(btn!);
    if (btnLayout) {
      const em = new NodeEventManager();
      em.setRoot(rootNode, layoutMap);
      const cx = btnLayout.x + btnLayout.width / 2;
      const cy = btnLayout.y + btnLayout.height / 2;
      em.handlePointerDown(cx, cy);
      em.handlePointerUp(cx, cy);
    }

    await flushAll();

    // After toggle: "Shown" should be present
    ({ commands } = renderPass(rootNode));
    textCmds = getTextCommands(commands);
    expect(textCmds).toContain('Shown');
  });

  it('full pipeline: layout, render commands, and event dispatch are consistent', async () => {
    function App() {
      const [label, setLabel] = useState('Ready');
      const press = useCallback(() => setLabel('Pressed'), []);
      return React.createElement('glyphis-view', { style: { width: 390, height: 844, flexDirection: 'column' } },
        React.createElement('glyphis-text', { style: { fontSize: 16, height: 20 } }, label),
        React.createElement('glyphis-view', {
          style: { width: 120, height: 44, backgroundColor: '#007AFF' },
          onPress: press,
        }),
      );
    }

    const rootNode = new GlyphisNode(HOST_TYPES.ROOT, {});
    renderReact(React.createElement(App), rootNode, () => {});
    await flushAll();

    // Verify layout dimensions
    let { commands, layoutMap, layoutOutput } = renderPass(rootNode);
    expect(layoutOutput.width).toBe(390);
    expect(layoutOutput.height).toBe(844);

    // Verify rect command for button background
    const rects = commands.filter(c => c.type === 'rect');
    expect(rects.length).toBeGreaterThan(0);

    // Press the button
    const btn = findPressable(rootNode);
    expect(btn).not.toBeNull();

    const btnLayout = layoutMap.get(btn!);
    if (btnLayout) {
      const em = new NodeEventManager();
      em.setRoot(rootNode, layoutMap);
      em.handlePointerDown(btnLayout.x + 5, btnLayout.y + 5);
      em.handlePointerUp(btnLayout.x + 5, btnLayout.y + 5);
    }

    await flushAll();

    ({ commands } = renderPass(rootNode));
    const textCmds = getTextCommands(commands);
    expect(textCmds).toContain('Pressed');
  });

  it('multiple clicks increment counter multiple times', async () => {
    function MultiCounter() {
      const [count, setCount] = useState(0);
      return React.createElement('glyphis-view', { style: { width: 390, height: 844, flexDirection: 'column' } },
        React.createElement('glyphis-text', { style: { fontSize: 16, height: 20 } }, String(count)),
        React.createElement('glyphis-view', {
          style: { width: 80, height: 40 },
          onPress: () => setCount(c => c + 1),
        }),
      );
    }

    const rootNode = new GlyphisNode(HOST_TYPES.ROOT, {});
    renderReact(React.createElement(MultiCounter), rootNode, () => {});
    await flushAll();

    for (let i = 0; i < 3; i++) {
      const { layoutMap } = renderPass(rootNode);
      const btn = findPressable(rootNode);
      const btnLayout = layoutMap.get(btn!);
      if (btnLayout) {
        const em = new NodeEventManager();
        em.setRoot(rootNode, layoutMap);
        em.handlePointerDown(btnLayout.x + 5, btnLayout.y + 5);
        em.handlePointerUp(btnLayout.x + 5, btnLayout.y + 5);
      }
      await flushAll();
    }

    const { commands } = renderPass(rootNode);
    const textCmds = getTextCommands(commands);
    expect(textCmds).toContain('3');
  });
});
