module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true
  },
  "parser": "@typescript-eslint/parser",
  "plugins": [
    "@typescript-eslint"
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  overrides: [
  ],
  parserOptions: {
    sourceType: 'script',
    project: ['tsconfig.json']
  },
  rules: {
  }
}
