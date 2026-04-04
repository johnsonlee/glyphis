import { describe, it, expect } from 'bun:test';

describe('Android Platform', () => {
  it('android platform module exports render', async () => {
    const mod = await import('../src/platform/android');
    expect(typeof mod.render).toBe('function');
  });
});

describe('Android build script', () => {
  it('script exists', async () => {
    const file = Bun.file('scripts/build-android.ts');
    expect(await file.exists()).toBe(true);
  });
});
