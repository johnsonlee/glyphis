import { join, resolve } from 'path';
import { mkdir, writeFile, exists } from 'fs/promises';
import { createNativeEntry, bundleForNative } from './build-common';

async function buildIOS() {
  const rootDir = resolve(import.meta.dir, '..');
  const entryPoint = process.argv[2] || 'examples/calculator/app.ts';
  const buildDir = join(rootDir, '.glyphis-build', 'ios');
  const nativeDir = join(rootDir, 'native', 'ios');
  const resourceDir = join(nativeDir, 'GlyphisShell', 'Resources');
  const yogaDir = join(rootDir, 'vendor', 'yoga');

  console.log('Building Glyphis iOS app...');
  console.log(`  Entry: ${entryPoint}`);

  await mkdir(buildDir, { recursive: true });
  await mkdir(resourceDir, { recursive: true });

  // Step 1: Create native entry
  const { entryPath } = await createNativeEntry({
    rootDir: rootDir,
    entryPoint: entryPoint,
    buildDir: buildDir,
    scriptName: 'build-ios.ts',
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
    '-target', 'arm64-apple-ios15.0-simulator',
    '-isysroot', '/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator.sdk',
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

  // Step 4: Build with xcodebuild (Xcode project handles Swift + Yoga linking)
  // Generate Xcode project if needed
  const xcprojDir = join(nativeDir, 'GlyphisShell.xcodeproj');
  const pbxprojPath = join(xcprojDir, 'project.pbxproj');

  if (!(await exists(pbxprojPath))) {
    console.log('  Generating Xcode project...');
    await mkdir(xcprojDir, { recursive: true });
    await writeFile(pbxprojPath, generatePbxproj());
  }

  // Build with xcodebuild
  console.log('  Building native app...');
  const proc = Bun.spawn([
    'xcodebuild',
    '-project', join(nativeDir, 'GlyphisShell.xcodeproj'),
    '-scheme', 'GlyphisShell',
    '-destination', 'generic/platform=iOS Simulator',
    '-derivedDataPath', join(buildDir, 'DerivedData'),
    'HEADER_SEARCH_PATHS=' + yogaDir,
    'LIBRARY_SEARCH_PATHS=' + buildDir,
    'OTHER_LDFLAGS=-lyoga -lc++',
    'SWIFT_OBJC_BRIDGING_HEADER=' + join(nativeDir, 'GlyphisShell', 'yoga-bridge.h'),
    'build',
  ], { cwd: nativeDir, stdout: 'pipe', stderr: 'pipe' });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    console.error('xcodebuild failed:');
    console.error(stderr.split('\n').slice(-30).join('\n'));
    process.exit(1);
  }

  const appPath = join(buildDir, 'DerivedData', 'Build', 'Products', 'Debug-iphonesimulator', 'GlyphisShell.app');
  console.log('\n  Build successful!');
  console.log(`  App: ${appPath}\n`);
  console.log('  To run in simulator:');
  console.log('    xcrun simctl boot "<device>"');
  console.log(`    xcrun simctl install booted "${appPath}"`);
  console.log('    xcrun simctl launch booted com.glyphis.shell');
}

function generatePbxproj(): string {
  return `// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 56;
	objects = {

/* Begin PBXBuildFile section */
		A1000001 /* AppDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = A2000001 /* AppDelegate.swift */; };
		A1000002 /* GlyphisViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = A2000002 /* GlyphisViewController.swift */; };
		A1000003 /* GlyphisRenderView.swift in Sources */ = {isa = PBXBuildFile; fileRef = A2000003 /* GlyphisRenderView.swift */; };
		A1000004 /* GlyphisRuntime.swift in Sources */ = {isa = PBXBuildFile; fileRef = A2000004 /* GlyphisRuntime.swift */; };
		A1000005 /* bundle.js in Resources */ = {isa = PBXBuildFile; fileRef = A2000005 /* bundle.js */; };
		A1000006 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = A2000007 /* Assets.xcassets */; };
		A1000008 /* YogaBridge.swift in Sources */ = {isa = PBXBuildFile; fileRef = A2000008 /* YogaBridge.swift */; };
		A1000009 /* ImageLoader.swift in Sources */ = {isa = PBXBuildFile; fileRef = A2000011 /* ImageLoader.swift */; };
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
		A2000001 /* AppDelegate.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppDelegate.swift; sourceTree = "<group>"; };
		A2000002 /* GlyphisViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GlyphisViewController.swift; sourceTree = "<group>"; };
		A2000003 /* GlyphisRenderView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GlyphisRenderView.swift; sourceTree = "<group>"; };
		A2000004 /* GlyphisRuntime.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GlyphisRuntime.swift; sourceTree = "<group>"; };
		A2000005 /* bundle.js */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.javascript; path = bundle.js; sourceTree = "<group>"; };
		A2000006 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
		A2000007 /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };
		A2000008 /* YogaBridge.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = YogaBridge.swift; sourceTree = "<group>"; };
		A2000009 /* yoga-bridge.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = "yoga-bridge.h"; sourceTree = "<group>"; };
		A2000010 /* GlyphisShell.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = GlyphisShell.app; sourceTree = BUILT_PRODUCTS_DIR; };
		A2000011 /* ImageLoader.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ImageLoader.swift; sourceTree = "<group>"; };
/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
		A4000003 /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
		A3000001 = {
			isa = PBXGroup;
			children = (
				A3000002 /* GlyphisShell */,
				A3000003 /* Products */,
			);
			sourceTree = "<group>";
		};
		A3000002 /* GlyphisShell */ = {
			isa = PBXGroup;
			children = (
				A2000001 /* AppDelegate.swift */,
				A2000002 /* GlyphisViewController.swift */,
				A2000003 /* GlyphisRenderView.swift */,
				A2000004 /* GlyphisRuntime.swift */,
				A2000008 /* YogaBridge.swift */,
				A2000011 /* ImageLoader.swift */,
				A2000009 /* yoga-bridge.h */,
				A2000006 /* Info.plist */,
				A2000007 /* Assets.xcassets */,
				A3000004 /* Resources */,
			);
			path = GlyphisShell;
			sourceTree = "<group>";
		};
		A3000003 /* Products */ = {
			isa = PBXGroup;
			children = (
				A2000010 /* GlyphisShell.app */,
			);
			name = Products;
			sourceTree = "<group>";
		};
		A3000004 /* Resources */ = {
			isa = PBXGroup;
			children = (
				A2000005 /* bundle.js */,
			);
			path = Resources;
			sourceTree = "<group>";
		};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		A5000001 /* GlyphisShell */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = A7000001 /* Build configuration list for PBXNativeTarget "GlyphisShell" */;
			buildPhases = (
				A4000001 /* Sources */,
				A4000002 /* Resources */,
				A4000003 /* Frameworks */,
			);
			buildRules = (
			);
			dependencies = (
			);
			name = GlyphisShell;
			productName = GlyphisShell;
			productReference = A2000010 /* GlyphisShell.app */;
			productType = "com.apple.product-type.application";
		};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		A6000001 /* Project object */ = {
			isa = PBXProject;
			attributes = {
				BuildIndependentTargetsInParallel = 1;
				LastSwiftUpdateCheck = 1540;
				LastUpgradeCheck = 1540;
			};
			buildConfigurationList = A7000002 /* Build configuration list for PBXProject "GlyphisShell" */;
			compatibilityVersion = "Xcode 14.0";
			developmentRegion = en;
			hasScannedForEncodings = 0;
			knownRegions = (
				en,
				Base,
			);
			mainGroup = A3000001;
			productRefGroup = A3000003 /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				A5000001 /* GlyphisShell */,
			);
		};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
		A4000002 /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				A1000005 /* bundle.js in Resources */,
				A1000006 /* Assets.xcassets in Resources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
		A4000001 /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				A1000001 /* AppDelegate.swift in Sources */,
				A1000002 /* GlyphisViewController.swift in Sources */,
				A1000003 /* GlyphisRenderView.swift in Sources */,
				A1000004 /* GlyphisRuntime.swift in Sources */,
				A1000008 /* YogaBridge.swift in Sources */,
				A1000009 /* ImageLoader.swift in Sources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXSourcesBuildPhase section */

/* Begin XCBuildConfiguration section */
		A8000001 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				CODE_SIGN_STYLE = Automatic;
				INFOPLIST_FILE = GlyphisShell/Info.plist;
				IPHONEOS_DEPLOYMENT_TARGET = 15.0;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				PRODUCT_BUNDLE_IDENTIFIER = com.glyphis.shell;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Debug;
		};
		A8000002 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				CODE_SIGN_STYLE = Automatic;
				INFOPLIST_FILE = GlyphisShell/Info.plist;
				IPHONEOS_DEPLOYMENT_TARGET = 15.0;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				PRODUCT_BUNDLE_IDENTIFIER = com.glyphis.shell;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_OPTIMIZATION_LEVEL = "-O";
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Release;
		};
		A8000003 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				CLANG_ANALYZER_NONNULL = YES;
				CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;
				CLANG_CXX_LANGUAGE_STANDARD = "gnu++20";
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				CLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;
				CLANG_WARN_BOOL_CONVERSION = YES;
				CLANG_WARN_COMMA = YES;
				CLANG_WARN_CONSTANT_CONVERSION = YES;
				CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;
				CLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;
				CLANG_WARN_DOCUMENTATION_COMMENTS = YES;
				CLANG_WARN_EMPTY_BODY = YES;
				CLANG_WARN_ENUM_CONVERSION = YES;
				CLANG_WARN_INFINITE_RECURSION = YES;
				CLANG_WARN_INT_CONVERSION = YES;
				CLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;
				CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF = YES;
				CLANG_WARN_OBJC_LITERAL_CONVERSION = YES;
				CLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;
				CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES;
				CLANG_WARN_RANGE_LOOP_ANALYSIS = YES;
				CLANG_WARN_STRICT_PROTOTYPES = YES;
				CLANG_WARN_SUSPICIOUS_MOVE = YES;
				CLANG_WARN_UNGUARDED_AVAILABILITY = YES_AGGRESSIVE;
				CLANG_WARN_UNREACHABLE_CODE = YES;
				CLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
				CODE_SIGN_IDENTITY = "-";
				COPY_PHASE_STRIP = NO;
				DEBUG_INFORMATION_FORMAT = dwarf;
				ENABLE_STRICT_OBJC_MSGSEND = YES;
				ENABLE_TESTABILITY = YES;
				GCC_C_LANGUAGE_STANDARD = gnu17;
				GCC_DYNAMIC_NO_PIC = NO;
				GCC_NO_COMMON_BLOCKS = YES;
				GCC_OPTIMIZATION_LEVEL = 0;
				GCC_PREPROCESSOR_DEFINITIONS = (
					"DEBUG=1",
					"$(inherited)",
				);
				GCC_WARN_64_TO_32_BIT_CONVERSION = YES;
				GCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;
				GCC_WARN_UNDECLARED_SELECTOR = YES;
				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
				GCC_WARN_UNUSED_FUNCTION = YES;
				GCC_WARN_UNUSED_VARIABLE = YES;
				MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
				MTL_FAST_MATH = YES;
				ONLY_ACTIVE_ARCH = YES;
				SDKROOT = iphoneos;
				SWIFT_ACTIVE_COMPILATION_CONDITIONS = "$(inherited) DEBUG";
				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
			};
			name = Debug;
		};
		A8000004 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				CLANG_ANALYZER_NONNULL = YES;
				CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;
				CLANG_CXX_LANGUAGE_STANDARD = "gnu++20";
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				CLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;
				CLANG_WARN_BOOL_CONVERSION = YES;
				CLANG_WARN_COMMA = YES;
				CLANG_WARN_CONSTANT_CONVERSION = YES;
				CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;
				CLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;
				CLANG_WARN_DOCUMENTATION_COMMENTS = YES;
				CLANG_WARN_EMPTY_BODY = YES;
				CLANG_WARN_ENUM_CONVERSION = YES;
				CLANG_WARN_INFINITE_RECURSION = YES;
				CLANG_WARN_INT_CONVERSION = YES;
				CLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;
				CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF = YES;
				CLANG_WARN_OBJC_LITERAL_CONVERSION = YES;
				CLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;
				CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES;
				CLANG_WARN_RANGE_LOOP_ANALYSIS = YES;
				CLANG_WARN_STRICT_PROTOTYPES = YES;
				CLANG_WARN_SUSPICIOUS_MOVE = YES;
				CLANG_WARN_UNGUARDED_AVAILABILITY = YES_AGGRESSIVE;
				CLANG_WARN_UNREACHABLE_CODE = YES;
				CLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
				CODE_SIGN_IDENTITY = "-";
				COPY_PHASE_STRIP = NO;
				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
				ENABLE_NS_ASSERTIONS = NO;
				ENABLE_STRICT_OBJC_MSGSEND = YES;
				GCC_C_LANGUAGE_STANDARD = gnu17;
				GCC_NO_COMMON_BLOCKS = YES;
				GCC_OPTIMIZATION_LEVEL = s;
				GCC_WARN_64_TO_32_BIT_CONVERSION = YES;
				GCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;
				GCC_WARN_UNDECLARED_SELECTOR = YES;
				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
				GCC_WARN_UNUSED_FUNCTION = YES;
				GCC_WARN_UNUSED_VARIABLE = YES;
				MTL_ENABLE_DEBUG_INFO = NO;
				MTL_FAST_MATH = YES;
				SDKROOT = iphoneos;
				SWIFT_COMPILATION_MODE = wholemodule;
				VALIDATE_PRODUCT = YES;
			};
			name = Release;
		};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
		A7000001 /* Build configuration list for PBXNativeTarget "GlyphisShell" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				A8000001 /* Debug */,
				A8000002 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		A7000002 /* Build configuration list for PBXProject "GlyphisShell" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				A8000003 /* Debug */,
				A8000004 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
/* End XCConfigurationList section */

	};
	rootObject = A6000001 /* Project object */;
}
`;
}

buildIOS().catch(console.error);
