import type { AnyRenderCommand, RectCommand } from '../types';

export function batchCommands(commands: AnyRenderCommand[]): AnyRenderCommand[] {
  // For now, a simple pass-through with future optimization hooks
  // Batch consecutive rects with same color and no border-radius into merged commands
  const result: AnyRenderCommand[] = [];

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];

    // Try to merge consecutive rects with same color and no border radius
    if (cmd.type === 'rect' && !cmd.borderRadius) {
      let j = i + 1;
      const batch: RectCommand[] = [cmd];
      while (j < commands.length && commands[j].type === 'rect') {
        const next = commands[j] as RectCommand;
        if (next.color === cmd.color && !next.borderRadius) {
          batch.push(next);
          j++;
        } else {
          break;
        }
      }
      // If we batched multiple rects, emit them (could be drawn in single path)
      for (const b of batch) {
        result.push(b);
      }
      i = j - 1;
    } else {
      result.push(cmd);
    }
  }

  return result;
}

export function countDrawCalls(commands: AnyRenderCommand[]): number {
  let count = 0;
  for (const cmd of commands) {
    if (cmd.type === 'rect' || cmd.type === 'text' || cmd.type === 'image' || cmd.type === 'border') {
      count++;
    }
  }
  return count;
}
