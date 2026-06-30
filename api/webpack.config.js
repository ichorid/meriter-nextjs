const nodeExternals = require('webpack-node-externals');
const path = require('path');

module.exports = function (options, webpack) {
  const plugins = options.plugins.filter(
    (plugin) => plugin.constructor.name !== 'ForkTsCheckerWebpackPlugin'
  );

  return {
    ...options,
    externals: [
      nodeExternals({
        allowlist: ['@meriter/shared-types'],
      }),
    ],
    resolve: {
      ...options.resolve,
      alias: {
        ...options.resolve?.alias,
        '@meriter/shared-types': path.resolve(__dirname, '../libs/shared-types/dist'),
      },
    },
    plugins: plugins,
  };
};

