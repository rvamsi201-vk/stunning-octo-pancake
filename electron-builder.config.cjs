const { existsSync } = require('node:fs');

/** electron-builder fails if extraResources "from" is missing; include OAuth file only when present. */
const extraResources = existsSync('.env.packaged')
  ? [{ from: '.env.packaged', to: 'google-oauth.env' }]
  : [];

module.exports = {
  appId: 'com.commandcentre.desktop',
  productName: 'Command Centre',
  asar: false,
  files: ['dist/**/*', 'dist-electron/**/*', 'package.json'],
  extraResources,
  directories: { output: 'release' },
  mac: { category: 'public.app-category.productivity', target: ['dmg', 'zip'] },
};
