module.exports = function (api) {
  api.cache(true);
  const isProduction = process.env.NODE_ENV === 'production';

  const plugins = [];

  // Strip console logs in production builds to prevent reverse engineering and sensitive data leaks
  if (isProduction) {
    plugins.push([
      'babel-plugin-transform-remove-console',
      { exclude: ['error'] },
    ]);
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
