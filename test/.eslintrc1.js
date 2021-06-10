module.exports = {
  root: true,
  env: {
    es2021: true,
    mocha: true,
  },
  plugins: ['prettier'],
  extends: ['plugin:prettier/recommended', 'airbnb-base'],
  rules: { 'prettier/prettier': 'error' },
  settings: {
    'import/core-modules': ['vscode'],
  },
};
