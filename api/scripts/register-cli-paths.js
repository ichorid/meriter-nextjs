/**
 * ts-node CLI resolver: map monorepo path aliases (same as Jest moduleNameMapper).
 */
const path = require('path');
const Module = require('module');

const apiRoot = path.resolve(__dirname, '..');

const aliasPrefixes = [
  {
    prefix: '@meriter/shared-types/',
    target: path.join(apiRoot, '../libs/shared-types/src'),
  },
  {
    prefix: '@meriter/shared-types',
    target: path.join(apiRoot, '../libs/shared-types/src'),
    exact: true,
  },
  { prefix: '@common/abstracts/', target: path.join(apiRoot, 'libs/abstracts/src') },
  {
    prefix: '@common/abstracts',
    target: path.join(apiRoot, 'libs/abstracts/src'),
    exact: true,
  },
  { prefix: '@common/extapis/', target: path.join(apiRoot, 'libs/extapis/src') },
  {
    prefix: '@common/extapis',
    target: path.join(apiRoot, 'libs/extapis/src'),
    exact: true,
  },
  { prefix: '@common/lambdas/', target: path.join(apiRoot, 'libs/lambdas/src') },
  {
    prefix: '@common/lambdas',
    target: path.join(apiRoot, 'libs/lambdas/src'),
    exact: true,
  },
  { prefix: '@common/tg-sync/', target: path.join(apiRoot, 'libs/tg-sync/src') },
  {
    prefix: '@common/tg-sync',
    target: path.join(apiRoot, 'libs/tg-sync/src'),
    exact: true,
  },
];

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  for (const alias of aliasPrefixes) {
    if (alias.exact && request === alias.prefix) {
      return originalResolveFilename.call(
        this,
        alias.target,
        parent,
        isMain,
        options,
      );
    }
    if (!alias.exact && request.startsWith(alias.prefix)) {
      const subpath = request.slice(alias.prefix.length);
      return originalResolveFilename.call(
        this,
        path.join(alias.target, subpath),
        parent,
        isMain,
        options,
      );
    }
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
