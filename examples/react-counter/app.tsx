import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Button } from '../../src/react/components';
import { render } from '../../src/react/platform-web';

function Counter() {
  const [count, setCount] = useState(0);

  const increment = useCallback(() => setCount(c => c + 1), []);
  const decrement = useCallback(() => setCount(c => c - 1), []);
  const reset = useCallback(() => setCount(0), []);

  const countColor = useMemo(() => {
    if (count > 0) return '#4CAF50';
    if (count < 0) return '#F44336';
    return '#000000';
  }, [count]);

  return React.createElement(View, {
    style: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA', padding: 20 },
  },
    React.createElement(Text, { style: { fontSize: 32, fontWeight: 'bold', marginBottom: 8 } }, 'React Counter'),
    React.createElement(Text, { style: { fontSize: 72, fontWeight: 'bold', color: countColor, marginBottom: 32 } }, String(count)),
    React.createElement(View, { style: { flexDirection: 'row', gap: 12 } },
      React.createElement(Button, { title: '-', onPress: decrement, color: '#F44336', style: { width: 60 } }),
      React.createElement(Button, { title: 'Reset', onPress: reset, color: '#9E9E9E', style: { width: 80 } }),
      React.createElement(Button, { title: '+', onPress: increment, color: '#4CAF50', style: { width: 60 } }),
    ),
  );
}

function App() {
  return React.createElement(View, { style: { flex: 1, backgroundColor: '#FFFFFF' } },
    React.createElement(View, { style: { height: 44, backgroundColor: '#2196F3' } }),
    React.createElement(View, {
      style: { height: 56, backgroundColor: '#2196F3', justifyContent: 'center', alignItems: 'center' },
    },
      React.createElement(Text, { style: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' } }, 'Glyph + React'),
    ),
    React.createElement(Counter, {}),
  );
}

const canvas = document.getElementById('glyph-root') as HTMLCanvasElement;
if (canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  render(React.createElement(App, {}), canvas);
}
