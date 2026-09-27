#!/usr/bin/env node
'use strict';
// Materialize the same local web sources used by Android into a standalone Xcode app.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const ios = path.join(root, 'ios');
const web = path.join(ios, 'BYND', 'www');
execFileSync(process.execPath, [path.join(__dirname, 'assemble-sources.cjs')], { cwd: root, stdio: 'inherit' });
fs.mkdirSync(web, { recursive: true });
function copyWeb(source, destination) {
    const stat = fs.lstatSync(source);
    if (stat.isSymbolicLink()) throw new Error(`Web assets cannot be symbolic links: ${source}`);
    if (stat.isDirectory()) {
        fs.mkdirSync(destination, { recursive: true });
        for (const name of fs.readdirSync(source)) copyWeb(path.join(source, name), path.join(destination, name));
    } else if (stat.isFile() && !/\.part\.js$/.test(source)) {
        const contents = fs.readFileSync(source);
        if (fs.existsSync(destination)) {
            if (fs.readFileSync(destination).equals(contents)) return;
            // Windows copies can inherit read-only file attributes. These are our generated assets.
            fs.chmodSync(destination, 0o666);
        }
        fs.writeFileSync(destination, contents);
    }
}
// Never copy development artifacts, secrets, backups or native build directories.
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() ? ['assets', 'apps', 'core', 'systems', 'ui', '表情包'].includes(entry.name) : /\.(html|js|css|svg|png|webmanifest)$/.test(entry.name)) {
        copyWeb(path.join(root, entry.name), path.join(web, entry.name));
    }
}
const version = fs.readFileSync(path.join(root, 'core/storage/backup.js'), 'utf8').match(/APP_VERSION = 'v(\d+\.\d+\.\d+)'/)[1];
const build = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8').match(/versionCode (\d+)/)[1];
const id = number => String(number).padStart(24, '0');
const fileNames = ['App.swift', 'HealthWebView.swift', 'HealthKitReader.swift'];
const files = fileNames.map((name, i) => `${id(20 + i)} = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${name}; sourceTree = "<group>";};`).join('\n');
const builds = fileNames.map((_, i) => `${id(30 + i)} = {isa = PBXBuildFile; fileRef = ${id(20 + i)};};`).join('\n');
const targetSettings = `CODE_SIGN_ENTITLEMENTS = BYND/BYND.entitlements; CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = ${build}; GENERATE_INFOPLIST_FILE = NO; INFOPLIST_FILE = BYND/Info.plist; IPHONEOS_DEPLOYMENT_TARGET = 16.0; MARKETING_VERSION = ${version}; PRODUCT_BUNDLE_IDENTIFIER = cc.ccwu.bynd; PRODUCT_NAME = "$(TARGET_NAME)"; SDKROOT = iphoneos; SUPPORTED_PLATFORMS = "iphoneos iphonesimulator"; SWIFT_VERSION = 5.0; TARGETED_DEVICE_FAMILY = 1;`;
const project = `// !$*UTF8*$!
{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {
${files}
${builds}
${id(1)} = {isa = PBXProject; attributes = { LastUpgradeCheck = 1600; TargetAttributes = {${id(2)} = {CreatedOnToolsVersion = 16.0; SystemCapabilities = {com.apple.HealthKit = {enabled = 1;};};};};}; buildConfigurationList = ${id(10)}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en, Base); mainGroup = ${id(3)}; productRefGroup = ${id(5)}; projectDirPath = ""; projectRoot = ""; targets = (${id(2)});};
${id(2)} = {isa = PBXNativeTarget; buildConfigurationList = ${id(11)}; buildPhases = (${id(6)}, ${id(7)}, ${id(8)}); buildRules = (); dependencies = (); name = BYND; productName = BYND; productReference = ${id(9)}; productType = "com.apple.product-type.application";};
${id(3)} = {isa = PBXGroup; children = (${id(4)}, ${id(5)}); sourceTree = "<group>";};
${id(4)} = {isa = PBXGroup; children = (${fileNames.map((_, i) => id(20 + i)).join(',')}, ${id(23)}, ${id(24)}, ${id(25)}); path = BYND; sourceTree = "<group>";};
${id(5)} = {isa = PBXGroup; children = (${id(9)}); name = Products; sourceTree = "<group>";};
${id(6)} = {isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (${fileNames.map((_, i) => id(30 + i)).join(',')}); runOnlyForDeploymentPostprocessing = 0;};
${id(7)} = {isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;};
${id(8)} = {isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = (${id(33)}); runOnlyForDeploymentPostprocessing = 0;};
${id(9)} = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = BYND.app; sourceTree = BUILT_PRODUCTS_DIR;};
${id(10)} = {isa = XCConfigurationList; buildConfigurations = (${id(40)}, ${id(41)}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;};
${id(11)} = {isa = XCConfigurationList; buildConfigurations = (${id(42)}, ${id(43)}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;};
${id(23)} = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>";};
${id(24)} = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = BYND.entitlements; sourceTree = "<group>";};
${id(25)} = {isa = PBXFileReference; lastKnownFileType = folder; path = www; sourceTree = "<group>";};
${id(33)} = {isa = PBXBuildFile; fileRef = ${id(25)};};
${id(40)} = {isa = XCBuildConfiguration; buildSettings = {CLANG_ENABLE_MODULES = YES; SWIFT_OPTIMIZATION_LEVEL = "-Onone";}; name = Debug;};
${id(41)} = {isa = XCBuildConfiguration; buildSettings = {CLANG_ENABLE_MODULES = YES; SWIFT_COMPILATION_MODE = wholemodule;}; name = Release;};
${id(42)} = {isa = XCBuildConfiguration; buildSettings = {${targetSettings}}; name = Debug;};
${id(43)} = {isa = XCBuildConfiguration; buildSettings = {${targetSettings}}; name = Release;};
}; rootObject = ${id(1)}; }
`;
fs.mkdirSync(path.join(ios, 'BYND.xcodeproj'), { recursive: true });
fs.writeFileSync(path.join(ios, 'BYND.xcodeproj', 'project.pbxproj'), project);
console.log(`Prepared iOS project ${version} (${build}). Open ios/BYND.xcodeproj on macOS; choose your signing team.`);
