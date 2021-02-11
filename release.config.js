module.exports = {
  verifyConditions: ['semantic-release-vsce', '@semantic-release/github'],
  prepare: {
    path: 'semantic-release-vsce',
    packageVsix: true,
  },
  publish: [
    'semantic-release-vsce',
    {
      path: '@semantic-release/github',
      assets: '*.vsix',
    },
  ],
};
