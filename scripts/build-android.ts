import { resolve, join } from 'path';
import { mkdir, writeFile, exists } from 'fs/promises';
import { createNativeEntry, bundleForNative } from './build-common';

async function buildAndroid() {
  const rootDir = resolve(import.meta.dir, '..');
  const entryPoint = process.argv[2] || 'examples/calculator/app.ts';
  const buildDir = join(rootDir, '.glyphis-build', 'android');
  const nativeDir = join(rootDir, 'native', 'android');
  const assetsDir = join(nativeDir, 'app', 'src', 'main', 'assets');

  console.log('Building Glyphis Android app...');
  console.log(`  Entry: ${entryPoint}`);

  await mkdir(buildDir, { recursive: true });
  await mkdir(assetsDir, { recursive: true });

  // Step 1: Create native entry
  const { entryPath } = await createNativeEntry({
    rootDir: rootDir,
    entryPoint: entryPoint,
    buildDir: buildDir,
    scriptName: 'build-android.ts',
  });

  // Step 2: Bundle with Bun.build
  console.log('  Bundling JS...');
  const bundleJS = await bundleForNative({
    entryPath: entryPath,
    rootDir: rootDir,
    minify: true,
    extraDefine: {
      'import.meta.url': '""',
    },
  });

  const outBundlePath = join(assetsDir, 'bundle.js');
  await writeFile(outBundlePath, bundleJS);
  await writeFile(join(buildDir, 'bundle.js'), bundleJS);
  console.log(`  Bundle: ${(bundleJS.length / 1024).toFixed(1)} KB`);

  // Check for Gradle wrapper
  const gradlewPath = join(nativeDir, 'gradlew');
  if (!(await exists(gradlewPath))) {
    console.log('\n  Gradle wrapper not found. Run:');
    console.log(`    cd ${nativeDir}`);
    console.log('    gradle wrapper');
    console.log(`\n  Bundle saved to: ${outBundlePath}`);
    return;
  }

  // Build APK
  console.log('  Building APK...');
  const gradleProc = Bun.spawn([
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

  const gradleExitCode = await gradleProc.exited;
  if (gradleExitCode !== 0) {
    const stderr = await new Response(gradleProc.stderr).text();
    console.error('Gradle build failed:');
    console.error(stderr.split('\n').slice(-15).join('\n'));
    process.exit(1);
  }

  const apkPath = join(nativeDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  console.log('\n  Build successful!');
  console.log(`  APK: ${apkPath}\n`);
  console.log('  To install on emulator:');
  console.log(`    adb install ${apkPath}`);
}

buildAndroid().catch(console.error);
