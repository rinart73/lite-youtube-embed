module.exports = {
  env: {
    browser: false,
    es2021: true
  },
  extends: [
    'standard-with-typescript',
    'prettier'
  ],
  overrides: [
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['tsconfig.json']
  },
  rules: {
  }
}
