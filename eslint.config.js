import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';

// 다른 모듈의 내부 파일을 직접 import하지 못하게 막는다. 각 폴더의 index.js만 공개 API다.
const moduleBoundary = {
  patterns: [
    {
      group: ['../*/*', '!../*/index.js'],
      message: '다른 모듈은 index.js를 통해서만 import합니다. (AGENTS.md 모듈 경계)',
    },
  ],
};

export default defineConfig([
  globalIgnores(['node_modules/', 'coverage/', 'dist/']),
  { files: ['**/*.js'], plugins: { js }, extends: ['js/recommended'] },
  {
    files: ['**/*.js'],
    rules: {
      eqeqeq: ['error', 'always'],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.js', 'demo/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/**/*.js'],
    rules: { 'no-restricted-imports': ['error', moduleBoundary] },
  },
  {
    // diff는 순수 함수다. DOM 전역에 접근하면 lint에서 막는다.
    files: ['src/diff/**/*.js'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'document', message: 'diff/는 DOM에 접근하지 않습니다.' },
        { name: 'window', message: 'diff/는 DOM에 접근하지 않습니다.' },
      ],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../src/*/*', '!../src/*/index.js'],
              message: '테스트도 각 모듈의 index.js(공개 API)만 import합니다.',
            },
          ],
        },
      ],
    },
  },
  {
    // JSX는 demo/ 앱 코드에서만 쓴다 (AGENTS.md JSX 사용 규칙)
    files: ['demo/**/*.jsx'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      // h는 JSX 변환 결과에서만 쓰여 소스에는 사용처가 보이지 않는다
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^h$' }],
    },
  },
  {
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
]);
