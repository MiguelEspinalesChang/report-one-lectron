import vue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/.venv/**',
      '**/coverage/**',
    ],
  },
  ...tseslint.configs.recommended,
  // 'flat/essential' keeps correctness rules only; tighten to
  // 'flat/recommended' once the UI stabilizes.
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
]
