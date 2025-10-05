// Flat ESLint config for ESLint v9+ with TypeScript.
// CommonJS to avoid ESM type flag changes in package.json.
const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const globals = require('globals');
const nextPlugin = require('@next/eslint-plugin-next');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      '**/*.min.js',
      'src/hooks/use-callback-ref.tsx'
    ]
  },
  // Node JS configs and build scripts
  {
    files: [
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      'eslint.config.js',
      'postcss.config.js',
      'next.config.ts'
    ],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  js.configs.recommended,
  // Next.js ruleset can be re-enabled after plugin resolution
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
        project: ['./tsconfig.json']
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        React: true
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      // Register Next.js plugin under the same key used by its rule names
      '@next/next': nextPlugin,
      'react-hooks': require('eslint-plugin-react-hooks')
    },
    rules: {
      // Use TS's checks instead of core no-undef in TS files
      'no-undef': 'off',
      // Defer to @typescript-eslint/no-unused-vars
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      'no-console': 'warn',
      // Allow empty catch blocks (we intentionally swallow errors in UI flows)
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // Some regex literals intentionally escape forward slashes, reduce noise
      'no-useless-escape': 'warn',
      // Ensure hooks deps rule is available
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  }
];
