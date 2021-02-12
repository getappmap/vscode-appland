module.exports = {
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    [
      {
        path: '@semantic-release/npm',
        npmPublish: false,
      },
    ],
    'semantic-release-vsce',
    '@semantic-release/git',
    [
      {
        path: '@semantic-release/github',
        assets: '*.vsix',
      },
    ],
  ],
};
