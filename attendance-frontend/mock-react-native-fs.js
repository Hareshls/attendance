// Mock react-native-fs for Expo Go
module.exports = {
  DocumentDirectoryPath: '',
  MainBundlePath: '',
  CachesDirectoryPath: '',
  readFile: async () => '',
  readDir: async () => [],
  exists: async () => false,
  downloadFile: () => ({ promise: Promise.resolve() }),
};
