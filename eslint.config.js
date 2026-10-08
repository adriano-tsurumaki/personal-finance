// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default defineConfig(
  {
    ignores: ['.vite/**', 'out/**'],
  },
  {
    files: ['**/*.{js,cjs,mjs,ts,tsx}'],
    rules: {
      curly: ['error', 'all'],
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'if' },
        { blankLine: 'always', prev: 'if', next: '*' },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  {
    files: ['src/ts/**/*.{ts,tsx}'],
    extends: [reactHooksPlugin.configs.flat.recommended],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  //   {
  //     files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'electron/**/*.ts'], // Ajuste conforme seu projeto
  //     languageOptions: {
  //       globals: {
  //         ...globals.node,
  //       },
  //     },
  //     rules: {
  //     },
  //   }
);
