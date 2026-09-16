const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const tablerPath = path.resolve(
  __dirname,
  'node_modules/@tabler/icons-react-native/dist/cjs/tabler-icons-react-native.cjs'
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@tabler/icons-react-native') {
    return {
      filePath: tablerPath,
      type: 'sourceFile',
    };
  }
  return context.resolveRequest
    ? context.resolveRequest(context, moduleName, platform)
    : require('metro-resolver').resolve(context, moduleName, platform);
};

module.exports = config;

