import { render, View, Text, createWebPlatform, createSignal, batch, glyphisRenderer } from '../../src';
import type { Style } from '../../src';

// -- Constants --

const BOX_COUNT = 200;
const COLUMNS = 14;
const RETARGET_INTERVAL = 2000;

// -- Spring physics --

function spring(current: number, target: number, velocity: number, stiffness = 0.1, damping = 0.7) {
  const force = (target - current) * stiffness;
  const newVelocity = (velocity + force) * damping;
  return { value: current + newVelocity, velocity: newVelocity };
}

// -- Color utilities --

function randomBrightColor(): [number, number, number] {
  // Generate bright colors by keeping at least one channel high
  const base = [
    60 + Math.floor(Math.random() * 196),
    60 + Math.floor(Math.random() * 196),
    60 + Math.floor(Math.random() * 196),
  ] as [number, number, number];
  // Boost one random channel to ensure brightness
  base[Math.floor(Math.random() * 3)] = 180 + Math.floor(Math.random() * 76);
  return base;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

// -- Box state --

interface BoxState {
  x: [() => number, (v: number) => void];
  y: [() => number, (v: number) => void];
  size: [() => number, (v: number) => void];
  opacity: [() => number, (v: number) => void];
  colorR: [() => number, (v: number) => void];
  colorG: [() => number, (v: number) => void];
  colorB: [() => number, (v: number) => void];
  targetX: number;
  targetY: number;
  targetSize: number;
  targetOpacity: number;
  targetR: number;
  targetG: number;
  targetB: number;
  velX: number;
  velY: number;
  velSize: number;
  velOpacity: number;
  velR: number;
  velG: number;
  velB: number;
}

function createBox(viewportWidth: number, viewportHeight: number): BoxState {
  const initX = Math.random() * (viewportWidth - 60);
  const initY = Math.random() * (viewportHeight - 60);
  const initSize = 20 + Math.random() * 40;
  const initOpacity = 0.5 + Math.random() * 0.5;
  const [r, g, b] = randomBrightColor();

  return {
    x: createSignal(initX),
    y: createSignal(initY),
    size: createSignal(initSize),
    opacity: createSignal(initOpacity),
    colorR: createSignal(r),
    colorG: createSignal(g),
    colorB: createSignal(b),
    targetX: initX,
    targetY: initY,
    targetSize: initSize,
    targetOpacity: initOpacity,
    targetR: r,
    targetG: g,
    targetB: b,
    velX: 0,
    velY: 0,
    velSize: 0,
    velOpacity: 0,
    velR: 0,
    velG: 0,
    velB: 0,
  };
}

// -- Components --

function BoxView(props: { box: BoxState }) {
  const box = props.box;
  return glyphisRenderer.createComponent(View, {
    get style(): Style {
      const s = box.size[0]();
      return {
        position: 'absolute' as const,
        left: box.x[0](),
        top: box.y[0](),
        width: s,
        height: s,
        backgroundColor: rgbToHex(box.colorR[0](), box.colorG[0](), box.colorB[0]()),
        opacity: box.opacity[0](),
        borderRadius: 4,
      };
    },
  });
}

function App() {
  const [fps, setFps] = createSignal(0);

  // Measure viewport for positioning
  const canvas = document.getElementById('glyphis-root') as HTMLCanvasElement;
  const viewportWidth = canvas ? canvas.width / (window.devicePixelRatio || 1) : 800;
  const viewportHeight = canvas ? canvas.height / (window.devicePixelRatio || 1) : 600;

  // Usable area below header
  const headerHeight = 48;
  const containerWidth = viewportWidth;
  const containerHeight = viewportHeight - headerHeight;

  // Create boxes
  const boxes: BoxState[] = [];
  for (let i = 0; i < BOX_COUNT; i++) {
    boxes.push(createBox(containerWidth, containerHeight));
  }

  // Randomize targets
  function retarget() {
    batch(() => {
      for (const box of boxes) {
        box.targetX = Math.random() * (containerWidth - 60);
        box.targetY = Math.random() * (containerHeight - 60);
        box.targetSize = 20 + Math.random() * 40;
        box.targetOpacity = 0.5 + Math.random() * 0.5;
        const [r, g, b] = randomBrightColor();
        box.targetR = r;
        box.targetG = g;
        box.targetB = b;
      }
    });
  }

  // FPS tracking
  let frameCount = 0;
  let lastFpsTime = performance.now();

  // Animation loop
  function animate() {
    const now = performance.now();

    batch(() => {
      for (const box of boxes) {
        const sx = spring(box.x[0](), box.targetX, box.velX);
        box.x[1](sx.value);
        box.velX = sx.velocity;

        const sy = spring(box.y[0](), box.targetY, box.velY);
        box.y[1](sy.value);
        box.velY = sy.velocity;

        const ss = spring(box.size[0](), box.targetSize, box.velSize);
        box.size[1](ss.value);
        box.velSize = ss.velocity;

        const so = spring(box.opacity[0](), box.targetOpacity, box.velOpacity, 0.08, 0.75);
        box.opacity[1](so.value);
        box.velOpacity = so.velocity;

        const sr = spring(box.colorR[0](), box.targetR, box.velR, 0.08, 0.75);
        box.colorR[1](sr.value);
        box.velR = sr.velocity;

        const sg = spring(box.colorG[0](), box.targetG, box.velG, 0.08, 0.75);
        box.colorG[1](sg.value);
        box.velG = sg.velocity;

        const sb = spring(box.colorB[0](), box.targetB, box.velB, 0.08, 0.75);
        box.colorB[1](sb.value);
        box.velB = sb.velocity;
      }
    });

    // FPS calculation
    frameCount++;
    const elapsed = now - lastFpsTime;
    if (elapsed >= 1000) {
      setFps(Math.round((frameCount * 1000) / elapsed));
      frameCount = 0;
      lastFpsTime = now;
    }

    setTimeout(animate, 0);
  }

  // Start animation and retarget timer
  setTimeout(animate, 0);
  setInterval(retarget, RETARGET_INTERVAL);

  // Build box components
  const boxComponents = boxes.map(box =>
    glyphisRenderer.createComponent(BoxView, { box })
  );

  // Header
  const header = glyphisRenderer.createComponent(View, {
    style: {
      height: headerHeight,
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 16,
      backgroundColor: '#1a1a1a',
    },
    children: [
      glyphisRenderer.createComponent(Text, {
        style: { color: '#ffffff', fontSize: 18, fontWeight: '600', fontFamily: 'system-ui' },
        children: 'Animated Boxes',
      }),
      glyphisRenderer.createComponent(Text, {
        get style(): Style {
          const f = fps();
          return {
            color: f >= 50 ? '#4ade80' : f >= 30 ? '#facc15' : '#ef4444',
            fontSize: 18,
            fontWeight: '600',
            fontFamily: 'system-ui',
          };
        },
        get children() { return fps() + ' FPS'; },
      }),
      glyphisRenderer.createComponent(Text, {
        style: { color: '#888888', fontSize: 14, fontFamily: 'system-ui' },
        children: BOX_COUNT + ' boxes',
      }),
    ],
  });

  // Container for boxes (relative positioning context)
  const container = glyphisRenderer.createComponent(View, {
    style: {
      flex: 1,
      backgroundColor: '#111111',
    },
    children: boxComponents,
  });

  return glyphisRenderer.createComponent(View, {
    style: { flex: 1, backgroundColor: '#111111' },
    children: [header, container],
  });
}

// -- Bootstrap --

const canvas = document.getElementById('glyphis-root') as HTMLCanvasElement;
if (canvas) {
  const platform = createWebPlatform(canvas);
  render(() => glyphisRenderer.createComponent(App, {}), platform);
}
