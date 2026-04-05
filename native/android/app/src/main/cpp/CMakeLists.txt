cmake_minimum_required(VERSION 3.22)
project(glyphis_jsc)

# JSC headers from jsc-android npm package.
set(JSC_DIST_DIR "${CMAKE_SOURCE_DIR}/../../../../../../node_modules/jsc-android/dist")

# Yoga source directory (relative to cpp dir -> repo root/vendor/yoga)
set(YOGA_DIR "${CMAKE_SOURCE_DIR}/../../../../../../vendor/yoga")

# Create symlink so #include <JavaScriptCore/JavaScript.h> resolves
file(CREATE_LINK
    "${JSC_DIST_DIR}/include"
    "${CMAKE_BINARY_DIR}/JavaScriptCore"
    SYMBOLIC
)

# Yoga C++ source files
set(YOGA_SOURCES
    ${YOGA_DIR}/yoga/YGConfig.cpp
    ${YOGA_DIR}/yoga/YGEnums.cpp
    ${YOGA_DIR}/yoga/YGNode.cpp
    ${YOGA_DIR}/yoga/YGNodeLayout.cpp
    ${YOGA_DIR}/yoga/YGNodeStyle.cpp
    ${YOGA_DIR}/yoga/YGPixelGrid.cpp
    ${YOGA_DIR}/yoga/YGValue.cpp
    ${YOGA_DIR}/yoga/algorithm/AbsoluteLayout.cpp
    ${YOGA_DIR}/yoga/algorithm/Baseline.cpp
    ${YOGA_DIR}/yoga/algorithm/Cache.cpp
    ${YOGA_DIR}/yoga/algorithm/CalculateLayout.cpp
    ${YOGA_DIR}/yoga/algorithm/FlexLine.cpp
    ${YOGA_DIR}/yoga/algorithm/PixelGrid.cpp
    ${YOGA_DIR}/yoga/config/Config.cpp
    ${YOGA_DIR}/yoga/debug/AssertFatal.cpp
    ${YOGA_DIR}/yoga/debug/Log.cpp
    ${YOGA_DIR}/yoga/event/event.cpp
    ${YOGA_DIR}/yoga/node/LayoutResults.cpp
    ${YOGA_DIR}/yoga/node/Node.cpp
)

add_library(glyphis_jsc SHARED
    jsc_bridge.cpp
    platform_bridge.cpp
    yoga_bridge.cpp
    polyfills.cpp
    ${YOGA_SOURCES}
)

# Everything needs C++20 (Yoga headers use std::floating_point, std::bit_width)
target_compile_features(glyphis_jsc PRIVATE cxx_std_20)

target_include_directories(glyphis_jsc PRIVATE
    ${CMAKE_BINARY_DIR}
    ${JSC_DIST_DIR}/include
    ${YOGA_DIR}
)

find_library(log-lib log)

# Extract libjsc.so from the AAR for linking
# The AAR is a zip file containing jni/<abi>/libjsc.so
set(JSC_AAR "${JSC_DIST_DIR}/org/webkit/android-jsc/r250231/android-jsc-r250231.aar")
set(JSC_EXTRACT_DIR "${CMAKE_BINARY_DIR}/jsc-extracted")

execute_process(
    COMMAND ${CMAKE_COMMAND} -E make_directory ${JSC_EXTRACT_DIR}
)
execute_process(
    COMMAND unzip -o -q ${JSC_AAR} jni/${ANDROID_ABI}/libjsc.so -d ${JSC_EXTRACT_DIR}
    RESULT_VARIABLE UNZIP_RESULT
)

add_library(jsc SHARED IMPORTED)
set_target_properties(jsc PROPERTIES
    IMPORTED_LOCATION "${JSC_EXTRACT_DIR}/jni/${ANDROID_ABI}/libjsc.so"
)

target_link_libraries(glyphis_jsc
    jsc
    ${log-lib}
)
