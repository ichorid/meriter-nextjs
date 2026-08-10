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
        // Bundle all shared-types entrypoints (root + Phase 1 subpaths) — runtime
        // `node dist/.../main` must not require unresolved subpath exports in Docker.
        allowlist: [/^@meriter\/shared-types/],
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

