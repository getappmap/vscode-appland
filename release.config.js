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
        publishCmd: 'yarn package',
      },
    ],
    [
      '@semantic-release/exec',
      {
        publishCmd: 'yarn publish -p $VSCE_TOKEN',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json', 'resources/versions.json'],
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: '*.vsix',
      },
    ],
  ],
};
