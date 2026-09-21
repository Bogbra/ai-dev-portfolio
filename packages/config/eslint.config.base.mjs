import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Geteilte Basis-ESLint-Konfiguration für alle Workspace-Pakete.
 * TypeScript-Regeln sind explizit auf TS/TSX-Dateien beschränkt, damit
 * sie nicht mit anderen Parsern (z.B. eslint-config-next) kollidieren.
 */
export const baseConfig = tseslint.config(
  js.configs.recommended,
  {
    // TypeScript-spezifische Regeln nur für .ts und .tsx Dateien
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // consistent-type-imports benötigt type-aware linting (parserOptions.project).
      // Wird in der jeweiligen App-Config mit konfiguriertem project aktiviert.
    },
  },
  {
    ignores: ['dist/**', '.next/**', 'node_modules/**'],
  },
);
