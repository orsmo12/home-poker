import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  { ignores: ['dist*/**', 'node_modules/**', 'supabase/functions/**'] },
  {
    files: ['**/*.{js,jsx,mjs}'],
    plugins: { react, 'react-hooks': hooks },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.serviceworker, ...globals.node, __APP_VERSION__: 'readonly' },
    },
    settings: { react: { version: '18.3' } },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }],
      'react/jsx-no-undef': 'error',
      'react/jsx-uses-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
