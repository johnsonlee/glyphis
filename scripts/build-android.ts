import { resolve, join } from 'path';
import { mkdir, writeFile, exists } from 'fs/promises';

async function buildAndroid() {
  const rootDir = resolve(import.meta.dir, '..');
  const entryPoint = process.argv[2] || 'examples/react-counter/app.tsx';
  const buildDir = join(rootDir, '.glyph-build', 'android');
  const nativeDir = join(rootDir, 'native', 'android');
  const assetsDir = join(nativeDir, 'app', 'src', 'main', 'assets');

  console.log('Building Glyph Android app...');
  console.log(`  Entry: ${entryPoint}`);

  // Step 1: Create directories
  await mkdir(buildDir, { recursive: true });
  await mkdir(assetsDir, { recursive: true });

  // Step 2: Bundle JS
  console.log('  Bundling JS...');
  const result = await Bun.build({
    entrypoints: [resolve(rootDir, entryPoint)],
    target: 'browser',
    format: 'iife',
    minify: true,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  if (!result.success) {
    console.error('Build failed:', result.logs.map(l => l.message).join('\n'));
    process.exit(1);
  }

  const bundleJS = await result.outputs[0].text();
  await writeFile(join(assetsDir, 'bundle.js'), bundleJS);
  await writeFile(join(buildDir, 'bundle.js'), bundleJS);
  console.log(`  Bundle: ${(bundleJS.length / 1024).toFixed(1)} KB`);

  // Step 3: Check for Gradle wrapper
  const gradlewPath = join(nativeDir, 'gradlew');
  if (!(await exists(gradlewPath))) {
    console.log('');
    console.log('  Gradle wrapper not found. Run the following to set up:');
    console.log(`    cd ${nativeDir}`);
    console.log('    gradle wrapper');
    console.log('  Then re-run this script.');
    console.log('');
    console.log(`  Bundle saved to: ${join(assetsDir, 'bundle.js')}`);
    return;
  }

  // Step 4: Build with Gradle
  console.log('  Building APK...');
  const proc = Bun.spawn([
    join(nativeDir, 'gradlew'),
    'assembleDebug',
  ], {
    cwd: nativeDir,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      ANDROID_HOME: process.env.ANDROID_HOME || join(process.env.HOME!, 'Library', 'Android', 'sdk'),
    },
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    console.error('Gradle build failed:');
    console.error(stderr.split('\n').slice(-15).join('\n'));
    process.exit(1);
  }

  const apkPath = join(nativeDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  console.log('');
  console.log('  Build successful!');
  console.log(`  APK: ${apkPath}`);
  console.log('');
  console.log('  To install on emulator:');
  console.log(`    adb install ${apkPath}`);
}

buildAndroid().catch(console.error);
