// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web ships a wasm build of SQLite.
config.resolver.assetExts.push('wasm');

module.exports = config;
