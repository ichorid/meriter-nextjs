const nodeExternals = require('webpack-node-externals');

module.exports = function (options, webpack) {
  const plugins = options.plugins.filter(
    (plugin) => plugin.constructor.name !== 'ForkTsCheckerWebpackPlugin'
  );

  return {
    ...options,
    externals: [
      nodeExternals({
        allowlist: [],
      }),
    ],
    plugins: plugins,
  };
};

