import { startDevServer } from './index';
import { parseCliArgs } from './index';

const { port, entryPoint } = parseCliArgs(process.argv.slice(2));

if (!entryPoint) {
  console.error('Usage: glyphis dev <entry-point> [--port <port>]');
  console.error('Example: glyphis dev src/app.tsx --port 3000');
  process.exit(1);
}

startDevServer({ entryPoint, port });
