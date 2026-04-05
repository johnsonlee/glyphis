import { useState, useCallback, useMemo } from '../../src/hooks';
import { Box } from '../../src/components/Box';
import { Text } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { createElement } from '../../src/jsx';
import { render } from '../../src/platform/web';

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
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#FAFAFA',
      padding: 20,
    },
  },
    createElement(Text, {
      style: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
      },
    }, 'Glyphis Counter'),

    createElement(Text, {
      style: {
        fontSize: 72,
        fontWeight: 'bold',
        color: countColor,
        marginBottom: 32,
      },
    }, String(count)),

    createElement(Box, {
      style: {
        flexDirection: 'row',
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
        justifyContent: 'center',
        alignItems: 'center',
      },
    },
      createElement(Text, {
        style: {
          fontSize: 20,
          fontWeight: 'bold',
          color: '#FFFFFF',
        },
      }, 'My First Glyphis App'),
    ),
    createElement(Counter, {}),
  );
}

const canvas = document.getElementById('glyphis-root') as HTMLCanvasElement;
if (canvas) {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * (window.devicePixelRatio || 1);
  canvas.height = rect.height * (window.devicePixelRatio || 1);
  render(createElement(App, {}), canvas);
}
