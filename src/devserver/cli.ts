import { startDevServer } from './index';
import { parseCliArgs } from './index';

const { port, entryPoint } = parseCliArgs(process.argv.slice(2));

if (!entryPoint) {
  console.error('Usage: glyph dev <entry-point> [--port <port>]');
  console.error('Example: glyph dev src/app.tsx --port 3000');
  process.exit(1);
}

startDevServer({ entryPoint, port });
