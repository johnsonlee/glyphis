import { createElement } from '../src/jsx';
import { useState, useCallback, useMemo } from '../src/hooks';
import { createReconciler } from '../src/reconciler';
import type { ReconcilerHost } from '../src/reconciler';
import { computeLayout } from '../src/layout';
import { fiberToLayoutInput, buildLayoutMap } from '../src/platform/web';
import { generateRenderCommands } from '../src/render-tree';
import { Box } from '../src/components/Box';
import { Text } from '../src/components/Text';
import { Button } from '../src/components/Button';
import type { Fiber, Renderer, Style, AnyRenderCommand } from '../src/types';
import type { LayoutOutput } from '../src/layout';

// ---------------------------------------------------------------------------
// Mock renderer -- no browser needed
// ---------------------------------------------------------------------------

const mockRenderer: Renderer = {
  clear() {},
  render() {},
  getWidth() { return 390; },
  getHeight() { return 844; },
  measureText(text: string, fontSize: number, _fontFamily: string, _fontWeight: string) {
    return { width: text.length * fontSize * 0.6, height: fontSize * 1.2 };
  },
};

// ---------------------------------------------------------------------------
// Counter component (copied from examples/counter/app.tsx, no DOM refs)
// ---------------------------------------------------------------------------

function Counter() {
  const [count, setCount] = useState(0);

  const increment = useCallback(() => setCount((c: number) => c + 1), []);
  const decrement = useCallback(() => setCount((c: number) => c - 1), []);
  const reset = useCallback(() => setCount(0), []);

  const countColor = useMemo(() => {
    if (count > 0) return '#4CAF50';
    if (count < 0) return '#F44336';
    return '#000000';
  }, [count]);

  return createElement(Box, {
    style: {
      flex: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      backgroundColor: '#FAFAFA',
      padding: 20,
    },
  },
    createElement(Text, {
      style: {
        fontSize: 32,
        fontWeight: 'bold' as const,
        marginBottom: 8,
      },
    }, 'Glyph Counter'),

    createElement(Text, {
      style: {
        fontSize: 72,
        fontWeight: 'bold' as const,
        color: countColor,
        marginBottom: 32,
      },
    }, String(count)),

    createElement(Box, {
      style: {
        flexDirection: 'row' as const,
        gap: 12,
      },
    },
      createElement(Button, {
        title: '-',
        onPress: decrement,
        color: '#F44336',
        style: { width: 60 },
      }),
      createElement(Button, {
        title: 'Reset',
        onPress: reset,
        color: '#9E9E9E',
        style: { width: 80 },
      }),
      createElement(Button, {
        title: '+',
        onPress: increment,
        color: '#4CAF50',
        style: { width: 60 },
      }),
    ),
  );
}

function App() {
  return createElement(Box, {
    style: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
  },
    createElement(Box, {
      style: {
        height: 44,
        backgroundColor: '#2196F3',
      },
    }),
    createElement(Box, {
      style: {
        height: 56,
        backgroundColor: '#2196F3',
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
      },
    },
      createElement(Text, {
        style: {
          fontSize: 20,
          fontWeight: 'bold' as const,
          color: '#FFFFFF',
        },
      }, 'My First Glyph App'),
    ),
    createElement(Counter, {}),
  );
}

// ---------------------------------------------------------------------------
// Run the pipeline
// ---------------------------------------------------------------------------

async function main() {
  let rootFiber: Fiber | null = null;

  const host: ReconcilerHost = {
    createNode(_fiber: Fiber) { return {}; },
    updateNode() {},
    removeNode() {},
    commitEffects(fiber: Fiber) {
      rootFiber = findRoot(fiber);
    },
  };

  function findRoot(fiber: Fiber): Fiber {
    let current = fiber;
    while (current.parent) current = current.parent;
    return current;
  }

  const reconciler = createReconciler(host);

  // 1. Kick off reconciliation
  const appElement = createElement(App, {});
  reconciler.render(appElement, {});

  // 2. Wait for microtask to complete reconciliation
  await new Promise<void>(r => queueMicrotask(r));

  if (!rootFiber) {
    console.error('ERROR: rootFiber is null after reconciliation');
    process.exit(1);
  }

  // 3. Build layout input from fiber tree
  const layoutInput = fiberToLayoutInput(rootFiber, mockRenderer);

  // 4. Set root dimensions
  const WIDTH = 390;
  const HEIGHT = 844;
  layoutInput.style = { ...layoutInput.style, width: WIDTH, height: HEIGHT };

  // 5. Compute layout
  const layoutOutput = computeLayout(layoutInput, WIDTH, HEIGHT);

  // 6. Build layout map (fiber -> layout output)
  const layoutMap = buildLayoutMap(rootFiber, layoutOutput);

  // 7. Print the layout tree
  console.log('=== LAYOUT TREE ===\n');
  printLayoutTree(rootFiber, layoutMap, 0, 0, 0);

  // 8. Generate and print render commands
  const commands = generateRenderCommands(rootFiber, layoutMap);
  console.log('\n=== RENDER COMMANDS (rect + text only) ===\n');
  printRenderCommands(commands);
}

// ---------------------------------------------------------------------------
// Pretty-print helpers
// ---------------------------------------------------------------------------

function printLayoutTree(
  fiber: Fiber,
  layoutMap: Map<Fiber, LayoutOutput>,
  offsetX: number,
  offsetY: number,
  depth: number,
): void {
  const layout = layoutMap.get(fiber);

  if (layout) {
    const absX = offsetX + layout.x;
    const absY = offsetY + layout.y;
    const indent = '  '.repeat(depth);

    const tag = fiberLabel(fiber);
    const dims = `${Math.round(layout.width)}x${Math.round(layout.height)}`;
    const pos = `(${Math.round(absX)},${Math.round(absY)})`;

    let extra = '';

    // Key style properties
    const style: Style = fiber.props.style || {};
    const styleParts: string[] = [];
    if (style.flex !== undefined) styleParts.push(`flex:${style.flex}`);
    if (style.flexDirection) styleParts.push(`flexDirection:${style.flexDirection}`);
    if (style.justifyContent) styleParts.push(`justifyContent:${style.justifyContent}`);
    if (style.alignItems) styleParts.push(`alignItems:${style.alignItems}`);
    if (style.height !== undefined) styleParts.push(`height:${style.height}`);
    if (style.width !== undefined) styleParts.push(`width:${style.width}`);
    if (style.padding !== undefined) styleParts.push(`padding:${style.padding}`);
    if (style.gap !== undefined) styleParts.push(`gap:${style.gap}`);
    if (style.backgroundColor) styleParts.push(`bg:${style.backgroundColor}`);
    if (style.fontSize) styleParts.push(`fontSize:${style.fontSize}`);
    if (style.fontWeight) styleParts.push(`fontWeight:${style.fontWeight}`);
    if (style.color) styleParts.push(`color:${style.color}`);
    if (style.borderRadius !== undefined) styleParts.push(`borderRadius:${style.borderRadius}`);
    if (style.opacity !== undefined && style.opacity < 1) styleParts.push(`opacity:${style.opacity}`);

    if (styleParts.length > 0) extra += ` style: {${styleParts.join(', ')}}`;

    // Text content
    if (fiber.tag === 'text' && fiber.props.nodeValue) {
      extra += ` "${fiber.props.nodeValue}"`;
    }

    console.log(`${indent}${tag} (${dims}) @ ${pos}${extra}`);

    // Recurse with updated offsets
    let child = fiber.child;
    while (child) {
      printLayoutTree(child, layoutMap, absX, absY, depth + 1);
      child = child.sibling;
    }
  } else {
    // Component/fragment fibers: skip in tree but recurse into children
    let child = fiber.child;
    while (child) {
      printLayoutTree(child, layoutMap, offsetX, offsetY, depth);
      child = child.sibling;
    }
  }
}

function fiberLabel(fiber: Fiber): string {
  if (fiber.tag === 'root') return 'Root';
  if (fiber.tag === 'text') return 'TextNode';
  if (fiber.tag === 'fragment') return 'Fragment';
  if (typeof fiber.type === 'function') return (fiber.type as Function).name || 'Component';
  if (typeof fiber.type === 'string') return fiber.type;
  return 'Unknown';
}

function printRenderCommands(commands: AnyRenderCommand[]): void {
  for (const cmd of commands) {
    if (cmd.type === 'rect') {
      console.log(
        `RECT  (${Math.round(cmd.width)}x${Math.round(cmd.height)}) @ (${Math.round(cmd.x)},${Math.round(cmd.y)}) color:${cmd.color}` +
        (cmd.borderRadius ? ` borderRadius:${JSON.stringify(cmd.borderRadius)}` : ''),
      );
    } else if (cmd.type === 'text') {
      console.log(
        `TEXT  "${cmd.text}" @ (${Math.round(cmd.x)},${Math.round(cmd.y)}) w:${Math.round(cmd.width)} color:${cmd.color} fontSize:${cmd.fontSize} fontWeight:${cmd.fontWeight}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
main().catch(err => {
  console.error(err);
  process.exit(1);
});
