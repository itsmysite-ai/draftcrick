const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Enable require.context for expo-router (required for production web export)
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro resolve packages from both the project and monorepo node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Enable package exports resolution (needed for ESM-only packages like copy-anything v4)
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = [
  "browser",
  "require",
  "default",
];

// Native-only modules that need web shims (registerWebModule fails in static export)
const nativeOnlyModules = new Set([
  "expo-haptics",
  "expo-device",
  "expo-location",
  "expo-notifications",
  "expo-constants",
]);
const webShimPath = path.resolve(projectRoot, "web-shims/expo-modules.js");

// Custom resolver to handle ESM-only packages that lack a "main" field
// and to handle pnpm's node_modules structure
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force these modules to resolve from root to avoid moti's nested copies
  // (moti ships 4.1.7/0.8.1 but Expo Go has native code for 4.1.1/0.5.1)
  const forceRootModules = {
    "react-native-worklets": "src/index.ts",
    "react-native-reanimated": "src/index.ts",
  };
  if (forceRootModules[moduleName]) {
    const rootPkg = path.join(monorepoRoot, "node_modules", moduleName);
    const entry = path.join(rootPkg, forceRootModules[moduleName]);
    if (fs.existsSync(entry)) {
      return { filePath: entry, type: "sourceFile" };
    }
  }
  // On web, redirect native-only Expo modules to no-op shim
  if (platform === "web" && nativeOnlyModules.has(moduleName)) {
    return { filePath: webShimPath, type: "sourceFile" };
  }
  // Map of ESM-only packages to their entry files (relative to package dir)
  const esmOnlyPackages = {
    "copy-anything": "dist/index.js",
    "is-what": "dist/index.js",
  };

  if (esmOnlyPackages[moduleName]) {
    // Search for the package in known node_modules locations
    const searchPaths = [
      path.join(monorepoRoot, "node_modules", moduleName),
      path.join(projectRoot, "node_modules", moduleName),
    ];

    for (const pkgDir of searchPaths) {
      const entryFile = path.join(pkgDir, esmOnlyPackages[moduleName]);
      if (fs.existsSync(entryFile)) {
        console.log(`[metro-resolve] ${moduleName} -> ${entryFile}`);
        return {
          filePath: entryFile,
          type: "sourceFile",
        };
      }
    }
  }

  // Force zustand subpath imports (e.g. "zustand/middleware") to CJS builds
  // to avoid import.meta usage in ESM builds that Metro can't handle
  if (moduleName.startsWith("zustand/")) {
    const subpath = moduleName.slice("zustand/".length); // e.g. "middleware"
    const searchPaths = [
      path.join(monorepoRoot, "node_modules", "zustand", `${subpath}.js`),
      path.join(projectRoot, "node_modules", "zustand", `${subpath}.js`),
    ];
    for (const cjsPath of searchPaths) {
      if (fs.existsSync(cjsPath)) {
        console.log(`[metro-resolve] ${moduleName} -> ${cjsPath}`);
        return { filePath: cjsPath, type: "sourceFile" };
      }
    }
  }

  // Fall back to the default resolver
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Add extra node modules to resolve from the monorepo root
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      // Try to resolve from project node_modules first
      const projectNodeModule = path.join(projectRoot, "node_modules", name);
      // Fall back to monorepo root node_modules
      const monorepoNodeModule = path.join(monorepoRoot, "node_modules", name);

      // Return monorepo root as fallback
      return monorepoNodeModule;
    },
  }
);

module.exports = config;
