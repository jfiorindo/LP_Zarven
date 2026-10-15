import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', '.qa/**'] },
  js.configs.recommended,
  { files: ['*.js'], languageOptions: { globals: globals.browser } },
  { files: ['**/*.mjs'], languageOptions: { globals: globals.node } },
  { files: ['scripts/check-motion.mjs', 'scripts/profile-motion.mjs'], languageOptions: { globals: globals.browser } },
  { rules: { 'no-unused-vars': ['error', { caughtErrors: 'none' }] } },
];
