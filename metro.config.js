const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Configure resolver
config.resolver.unstable_enablePackageExports = true;

const finalConfig = withNativeWind(config, {
  input: "./global.css",
  inlineRem: 16,
});

// Block problematic cache directories from being transformed
// Apply after withNativeWind to ensure it's not overridden
finalConfig.resolver.blockList = [
  ...(finalConfig.resolver.blockList || []),
  /react-native-css-interop\/\.cache\/.*/,
];

module.exports = finalConfig;
