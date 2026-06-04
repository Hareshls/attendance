// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('tflite', 'bin');

config.resolver.extraNodeModules = {
  'react-native-fs': require.resolve('./mock-react-native-fs.js'),
};

module.exports = config;
