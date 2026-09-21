import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import { baseConfig } from '@ai/config/eslint-base';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...baseConfig,
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      'react/display-name': 'off',
    },
  },
  {
    // next-env.d.ts wird von Next.js automatisch generiert und darf nicht gelint werden.
    // Es enthält triple-slash-Referenzen, die ESLint fälschlich als Fehler markiert.
    ignores: ['next-env.d.ts', '.next/**', 'node_modules/**'],
  },
];

export default config;
