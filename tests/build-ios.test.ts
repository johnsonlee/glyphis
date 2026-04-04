import { describe, it, expect } from 'bun:test';

describe('iOS build script', () => {
  it('build script exists', async () => {
    const file = Bun.file('scripts/build-ios.ts');
    expect(await file.exists()).toBe(true);
  });

  it('build script is valid TypeScript (can be parsed)', async () => {
    const file = Bun.file('scripts/build-ios.ts');
    const source = await file.text();
    expect(source).toContain('buildIOS');
    expect(source).toContain('xcodebuild');
    expect(source).toContain('generatePbxproj');
  });

  it('native Swift source files exist', async () => {
    const swiftFiles = [
      'native/ios/GlyphShell/AppDelegate.swift',
      'native/ios/GlyphShell/GlyphViewController.swift',
      'native/ios/GlyphShell/GlyphRenderView.swift',
      'native/ios/GlyphShell/GlyphRuntime.swift',
    ];
    for (const path of swiftFiles) {
      const file = Bun.file(path);
      expect(await file.exists()).toBe(true);
    }
  });

  it('Xcode project file exists', async () => {
    const file = Bun.file('native/ios/GlyphShell.xcodeproj/project.pbxproj');
    expect(await file.exists()).toBe(true);
  });

  it('Info.plist exists and is valid', async () => {
    const file = Bun.file('native/ios/GlyphShell/Info.plist');
    expect(await file.exists()).toBe(true);
    const content = await file.text();
    expect(content).toContain('com.glyph.shell');
    expect(content).toContain('GlyphShell');
  });

  it('iOS platform module exists', async () => {
    const file = Bun.file('src/platform/ios.ts');
    expect(await file.exists()).toBe(true);
    const content = await file.text();
    expect(content).toContain('NativeRenderer');
    expect(content).toContain('__glyph_native');
  });

  it('Xcode scheme exists', async () => {
    const file = Bun.file(
      'native/ios/GlyphShell.xcodeproj/xcshareddata/xcschemes/GlyphShell.xcscheme',
    );
    expect(await file.exists()).toBe(true);
  });
});
