import { render, View, Text, createWebPlatform, createSignal, batch, glyphisRenderer } from '../../src';
import type { Style } from '../../src';

// -- Constants --

const DB_COUNT = 25;
const QUERY_COUNT = 5;

const COLOR_GREEN = '#3c763d';
const COLOR_YELLOW = '#8a6d3b';
const COLOR_RED = '#a94442';

const BG_DARK = '#1a1a2e';
const BG_HEADER = '#533483';
const TEXT_COLOR = '#eee';

// -- Data model --

interface QueryData {
  elapsed: number;
  status: string;
}

function randomElapsed(): number {
  return Math.ceil(Math.random() * 100);
}

function statusFromElapsed(elapsed: number): string {
  if (elapsed < 10) return 'ok';
  if (elapsed < 50) return 'warning';
  return 'critical';
}

function colorFromElapsed(elapsed: number): string {
  if (elapsed < 10) return COLOR_GREEN;
  if (elapsed < 50) return COLOR_YELLOW;
  return COLOR_RED;
}

// -- Reactive state --

// Each database has a name and QUERY_COUNT signals for query data.
type DbSignals = {
  name: string;
  queries: Array<{
    get: () => QueryData;
    set: (v: QueryData) => void;
  }>;
};

function createDatabases(): DbSignals[] {
  const dbs: DbSignals[] = [];
  for (let i = 0; i < DB_COUNT; i++) {
    const queries: DbSignals['queries'] = [];
    for (let q = 0; q < QUERY_COUNT; q++) {
      const elapsed = randomElapsed();
      const [get, set] = createSignal<QueryData>({
        elapsed,
        status: statusFromElapsed(elapsed),
      });
      queries.push({ get, set });
    }
    dbs.push({
      name: `cluster${i}`,
      queries,
    });
  }
  return dbs;
}

// -- Components --

function QueryCell(props: { query: () => QueryData }) {
  const textChild = glyphisRenderer.createComponent(Text, {
    get style(): Style {
      return {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
        fontFamily: 'monospace',
        textAlign: 'center' as const,
      };
    },
    get children() {
      return props.query().elapsed.toFixed(1);
    },
  });

  return glyphisRenderer.createComponent(View, {
    get style(): Style {
      const q = props.query();
      return {
        width: 56,
        height: 28,
        backgroundColor: colorFromElapsed(q.elapsed),
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        borderRadius: 3,
        marginLeft: 2,
      };
    },
    children: textChild,
  });
}

function DbRow(props: { db: DbSignals }) {
  const nameText = glyphisRenderer.createComponent(Text, {
    style: {
      color: TEXT_COLOR,
      fontSize: 12,
      fontWeight: '600',
      fontFamily: 'monospace',
      width: 72,
    } as Style,
    children: props.db.name,
  });

  const nameCell = glyphisRenderer.createComponent(View, {
    style: {
      width: 80,
      height: 28,
      justifyContent: 'center' as const,
      alignItems: 'flex-start' as const,
      paddingLeft: 4,
    } as Style,
    children: nameText,
  });

  const queryCells = props.db.queries.map((q) =>
    glyphisRenderer.createComponent(QueryCell, {
      query: q.get,
    })
  );

  return glyphisRenderer.createComponent(View, {
    style: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      height: 32,
      marginBottom: 2,
    } as Style,
    children: [nameCell, ...queryCells],
  });
}

function Header(props: { fps: () => string }) {
  const title = glyphisRenderer.createComponent(Text, {
    style: {
      color: '#fff',
      fontSize: 20,
      fontWeight: '700',
      fontFamily: 'system-ui',
    } as Style,
    children: 'DBMon',
  });

  const fpsText = glyphisRenderer.createComponent(Text, {
    get style(): Style {
      return {
        color: '#fff',
        fontSize: 16,
        fontWeight: '400',
        fontFamily: 'monospace',
      };
    },
    get children() {
      return props.fps();
    },
  });

  return glyphisRenderer.createComponent(View, {
    style: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      backgroundColor: BG_HEADER,
      height: 44,
      paddingHorizontal: 12,
      marginBottom: 4,
      borderRadius: 4,
    } as Style,
    children: [title, fpsText],
  });
}

function App() {
  const databases = createDatabases();
  const [fps, setFps] = createSignal('0 FPS');

  // FPS tracking
  let frameCount = 0;
  let lastFpsTime = performance.now();

  function tick() {
    const now = performance.now();

    batch(() => {
      for (let i = 0; i < DB_COUNT; i++) {
        for (let q = 0; q < QUERY_COUNT; q++) {
          const elapsed = randomElapsed();
          databases[i].queries[q].set({
            elapsed,
            status: statusFromElapsed(elapsed),
          });
        }
      }
    });

    frameCount++;
    const delta = now - lastFpsTime;
    if (delta >= 1000) {
      const currentFps = Math.round((frameCount * 1000) / delta);
      setFps(`${currentFps} FPS`);
      frameCount = 0;
      lastFpsTime = now;
    }

    setTimeout(tick, 0);
  }

  // Start the update loop
  setTimeout(tick, 0);

  // Build the grid rows once; they update reactively via signals
  const rows = databases.map((db) =>
    glyphisRenderer.createComponent(DbRow, { db })
  );

  const header = glyphisRenderer.createComponent(Header, { fps });

  return glyphisRenderer.createComponent(View, {
    style: {
      flex: 1,
      backgroundColor: BG_DARK,
      padding: 8,
    } as Style,
    children: [header, ...rows],
  });
}

// -- Bootstrap --

const canvas = document.getElementById('glyphis-root') as HTMLCanvasElement;
if (canvas) {
  const platform = createWebPlatform(canvas);
  render(() => glyphisRenderer.createComponent(App, {}), platform);
}
