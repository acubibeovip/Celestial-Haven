import globals from 'globals';
import tseslint from 'typescript-eslint';

const browserOnlyGlobals = Object.keys(globals.browser)
  .filter((name) => !Object.hasOwn(globals.es2025, name));

export default tseslint.config(
  { ignores: ['tests/lint-fixtures/**', 'dist/**', 'playwright-report/**', 'test-results/**'] },
  tseslint.configs.recommended,
  {
    files: ['src/{domain,shared}/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          regex: '^(?!(?!.*(?:^|/)\\.\\.(?:/|$))(?:@(?:domain|shared)/|\\./)[^\\\\]+$)',
          message: 'Domain and shared code may only import pure modules via @domain, @shared, or local child paths.',
        }],
      }],
      'no-restricted-globals': ['error', ...browserOnlyGlobals, 'globalThis', 'require', 'process', 'module'],
      '@typescript-eslint/triple-slash-reference': ['error', {
        lib: 'never',
        path: 'never',
        types: 'never',
      }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression, TSImportType, TSImportEqualsDeclaration, TSNamespaceExportDeclaration',
          message: 'Use static ES imports so pure module dependencies can be checked.',
        },
      ],
    },
  },
  {
    files: ['src/ui/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          regex: '(^|/)(@domain|domain)(/|$)',
          message: 'UI must access game state through application contracts.',
        }],
      }],
      'no-restricted-syntax': ['error', {
        selector: 'ImportExpression > Literal[value=/(^|\\/)(@domain|domain)(\\/|$)/], TSImportType Literal[value=/(^|\\/)(@domain|domain)(\\/|$)/]',
        message: 'UI must access game state through application contracts.',
      }],
    },
  },
);
