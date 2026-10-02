import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';

export default [{
  files: ['lib/trading-engine/**/*.ts'],
  languageOptions: { parser, parserOptions: { ecmaVersion: 2020, sourceType: 'module' } },
  plugins: { '@typescript-eslint': plugin },
  rules: {
    ...plugin.configs.recommended.rules,
    '@typescript-eslint/no-explicit-any': 'error',
  },
}];
