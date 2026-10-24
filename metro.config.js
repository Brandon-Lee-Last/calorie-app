const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The nutrition model is a bundled .tflite asset.
config.resolver.assetExts.push('tflite');
// expo-sqlite's web build loads SQLite as WebAssembly (only used by the web preview; phones use native SQLite).
config.resolver.assetExts.push('wasm');

module.exports = config;
