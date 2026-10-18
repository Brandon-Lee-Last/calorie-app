const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The nutrition model is a bundled .tflite asset.
config.resolver.assetExts.push('tflite');

module.exports = config;
