import { watch } from 'fs';
import { join, resolve, extname } from 'path';

export interface DevServerOptions {
  port?: number;
  entryPoint: string;
  rootDir?: string;
}

export const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.ts': 'text/javascript',
  '.tsx': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

export function getHTML(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Glyphis Dev</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #f0f0f0; display: flex; justify-content: center; align-items: center; }
    #glyphis-root {
      width: 390px; height: 844px;
      background: white;
      border-radius: 20px;
      box-shadow: 0 0 40px rgba(0,0,0,0.15);
      overflow: hidden;
    }
    @media (max-width: 430px) {
      #glyphis-root { width: 100%; height: 100%; border-radius: 0; box-shadow: none; }
      body { background: white; }
    }
  </style>
</head>
<body>
  <canvas id="glyphis-root"></canvas>
  <script>
    var evtSource = new EventSource('/__hmr');
    evtSource.onmessage = function(e) {
      if (e.data === 'reload') {
        window.location.reload();
      }
    };
    evtSource.onerror = function() {
      setTimeout(function() { window.location.reload(); }, 1000);
    };
  </script>
  <div id="glyphis-debug-toggle" style="position:fixed;top:8px;right:8px;z-index:9999;">
    <button onclick="toggleDebug()" style="padding:4px 8px;font-size:11px;background:#333;color:#fff;border:none;border-radius:4px;cursor:pointer;opacity:0.7;">Debug</button>
  </div>
  <script>
    function toggleDebug() {
      var url = new URL(window.location.href);
      if (url.searchParams.get('debug') === 'true') {
        url.searchParams.delete('debug');
      } else {
        url.searchParams.set('debug', 'true');
      }
      window.location.href = url.toString();
    }
  </script>
  <script type="module" src="/bundle.js"></script>
</body>
</html>`;
}

export async function buildBundle(entryPoint: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [entryPoint],
    target: 'browser',
    format: 'esm',
    minify: false,
    sourcemap: 'inline',
    define: {
      'process.env.NODE_ENV': '"development"',
    },
  });

  if (!result.success) {
    const errors = result.logs.map((l) => l.message).join('\n');
    console.error('Build failed:', errors);
    return `document.body.innerHTML = '<pre style="color:red">${errors.replace(/'/g, "\\'")}</pre>';`;
  }

  return await result.outputs[0].text();
}

export function parseCliArgs(args: string[]): { port: number; entryPoint: string } {
  let port = 3000;
  let entryPoint = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' || args[i] === '-p') {
      port = parseInt(args[++i], 10);
    } else if (!args[i].startsWith('-')) {
      entryPoint = args[i];
    }
  }

  return { port, entryPoint };
}

export interface DevServerState {
  clients: Set<ReadableStreamDefaultController>;
  cachedBundle: string | null;
}

export function createFetchHandler(
  resolvedEntry: string,
  rootDir: string,
  state: DevServerState,
): (req: Request) => Promise<Response> {
  return async function handleFetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/__hmr') {
      const stream = new ReadableStream({
        start(controller) {
          state.clients.add(controller);
          controller.enqueue(new TextEncoder().encode('data: connected\n\n'));
        },
        cancel(controller) {
          state.clients.delete(controller);
        },
      });
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (url.pathname === '/bundle.js') {
      if (!state.cachedBundle) {
        state.cachedBundle = await buildBundle(resolvedEntry);
      }
      return new Response(state.cachedBundle, {
        headers: { 'Content-Type': 'application/javascript' },
      });
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(getHTML(), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const filePath = join(rootDir, url.pathname);
    try {
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const ext = extname(filePath);
        return new Response(file, {
          headers: { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' },
        });
      }
    } catch {
      // fall through to 404
    }

    return new Response('Not Found', { status: 404 });
  };
}

export function notifyClients(clients: Set<ReadableStreamDefaultController>): void {
  for (const client of clients) {
    try {
      client.enqueue(new TextEncoder().encode('data: reload\n\n'));
    } catch {
      clients.delete(client);
    }
  }
}

export async function startDevServer(options: DevServerOptions): Promise<{
  server: ReturnType<typeof Bun.serve>;
  stop: () => void;
}> {
  const { port = 3000, entryPoint, rootDir = process.cwd() } = options;
  const resolvedEntry = resolve(rootDir, entryPoint);

  const state: DevServerState = {
    clients: new Set(),
    cachedBundle: null,
  };

  const watcher = watch(rootDir, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    if (filename.includes('node_modules') || filename.includes('.git')) return;
    if (/\.(ts|tsx|js|jsx)$/.test(filename)) {
      console.log(`  > ${filename} changed, rebuilding...`);
      state.cachedBundle = null;
      notifyClients(state.clients);
    }
  });

  const fetchHandler = createFetchHandler(resolvedEntry, rootDir, state);

  const server = Bun.serve({
    port,
    fetch: fetchHandler,
  });

  console.log(`
  Glyphis Dev Server

  Local:   http://localhost:${port}
  Entry:   ${entryPoint}

  Ready for development.
`);

  const stop = () => {
    watcher.close();
    server.stop();
  };

  process.on('SIGINT', () => {
    stop();
    process.exit(0);
  });

  return { server, stop };
}

if (import.meta.main) {
  const entryPoint = process.argv[2] || 'examples/calculator/app.ts';
  startDevServer({ entryPoint, port: 3000 });
}
