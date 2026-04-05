import { join, resolve } from 'path';
import { mkdir, writeFile, exists } from 'fs/promises';
import { createNativeEntry, bundleForNative } from './build-common';

async function buildMacOS() {
  const rootDir = resolve(import.meta.dir, '..');
  const entryPoint = process.argv[2] || 'examples/calculator/app.ts';
  const buildDir = join(rootDir, '.glyphis-build', 'macos');
  const nativeDir = join(rootDir, 'native', 'macos');
  const resourceDir = join(nativeDir, 'GlyphisShell', 'Resources');
  const yogaDir = join(rootDir, 'vendor', 'yoga');

  console.log('Building Glyphis macOS app...');
  console.log(`  Entry: ${entryPoint}`);

  await mkdir(buildDir, { recursive: true });
  await mkdir(resourceDir, { recursive: true });

  // Step 1: Create native entry
  const { entryPath } = await createNativeEntry({
    rootDir: rootDir,
    entryPoint: entryPoint,
    buildDir: buildDir,
    scriptName: 'build-macos.ts',
  });

  // Step 2: Bundle JS
  console.log('  Bundling JS...');
  const bundleJS = await bundleForNative({
    entryPath: entryPath,
    rootDir: rootDir,
    minify: false,
  });

  await writeFile(join(buildDir, 'bundle.js'), bundleJS);
  await writeFile(join(resourceDir, 'bundle.js'), bundleJS);
  console.log(`  Bundle: ${(bundleJS.length / 1024).toFixed(1)} KB`);

  // Step 3: Compile Yoga C++ to static library
  console.log('  Compiling Yoga...');
  const yogaCppFiles = [
    'yoga/YGConfig.cpp', 'yoga/YGEnums.cpp', 'yoga/YGNode.cpp',
    'yoga/YGNodeLayout.cpp', 'yoga/YGNodeStyle.cpp', 'yoga/YGPixelGrid.cpp',
    'yoga/YGValue.cpp', 'yoga/algorithm/AbsoluteLayout.cpp',
    'yoga/algorithm/Baseline.cpp', 'yoga/algorithm/Cache.cpp',
    'yoga/algorithm/CalculateLayout.cpp', 'yoga/algorithm/FlexLine.cpp',
    'yoga/algorithm/PixelGrid.cpp', 'yoga/config/Config.cpp',
    'yoga/debug/AssertFatal.cpp', 'yoga/debug/Log.cpp',
    'yoga/event/event.cpp', 'yoga/node/LayoutResults.cpp',
    'yoga/node/Node.cpp',
  ];

  const yogaLib = join(buildDir, 'libyoga.a');
  const compileYoga = Bun.spawn([
    'c++', '-std=c++20', '-O2', `-I${yogaDir}`,
    ...yogaCppFiles.map(f => join(yogaDir, f)),
    '-c',
  ], { cwd: buildDir, stdout: 'pipe', stderr: 'pipe' });

  let yogaExit = await compileYoga.exited;
  if (yogaExit !== 0) {
    console.error('Yoga compile failed:', await new Response(compileYoga.stderr).text());
    process.exit(1);
  }

  const arProc = Bun.spawn(['sh', '-c', `libtool -static -o ${yogaLib} ${buildDir}/*.o`],
    { cwd: buildDir, stdout: 'pipe', stderr: 'pipe' });
  await arProc.exited;

  // Step 4: Compile Swift + link with Yoga
  console.log('  Compiling native app...');
  const swiftFiles = [
    join(nativeDir, 'GlyphisShell', 'main.swift'),
    join(nativeDir, 'GlyphisShell', 'AppDelegate.swift'),
    join(nativeDir, 'GlyphisShell', 'GlyphisRenderView.swift'),
    join(nativeDir, 'GlyphisShell', 'GlyphisRuntime.swift'),
    join(nativeDir, 'GlyphisShell', 'YogaBridge.swift'),
    join(nativeDir, 'GlyphisShell', 'ImageLoader.swift'),
  ];

  const bridgingHeader = join(nativeDir, 'GlyphisShell', 'yoga-bridge.h');
  const outputPath = join(buildDir, 'GlyphisApp');

  const proc = Bun.spawn([
    'swiftc',
    '-o', outputPath,
    ...swiftFiles,
    '-import-objc-header', bridgingHeader,
    `-I${yogaDir}`,
    '-L' + buildDir,
    '-lyoga',
    '-lc++',
    '-framework', 'Cocoa',
    '-framework', 'JavaScriptCore',
    '-O',
  ], { cwd: rootDir, stdout: 'pipe', stderr: 'pipe' });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    console.error('swiftc failed:');
    console.error(stderr);
    process.exit(1);
  }

  // Step 5: Sign (no longer need JIT entitlement -- no WASM)
  const signProc = Bun.spawn([
    'codesign', '--force', '--sign', '-', outputPath,
  ], { cwd: rootDir, stdout: 'pipe', stderr: 'pipe' });
  await signProc.exited;

  console.log('\n  Build successful!');
  console.log(`  Executable: ${outputPath}\n`);
  console.log('  To run (from repo root):');
  console.log(`    ${outputPath}`);
}

buildMacOS().catch(console.error);
