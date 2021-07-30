module.exports = {
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    [
      '@semantic-release/npm',
      {
        npmPublish: false,
      },
    ],
    [
      '@semantic-release/exec',
      {
        publishCmd: 'yarn run publish -p $VSCE_TOKEN',
      },
    ],
    '@semantic-release/git',
    [
      '@semantic-release/github',
      {
        assets: '*.vsix',
      },
    ],
  ],
};
