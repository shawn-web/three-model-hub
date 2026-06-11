import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    ignores: ['dist/**', 'node_modules/**'],
    rules: {
      // 捕获未使用导入（如 IsBoolean 残留）
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      // 允许 any（NestJS 装饰器环境需要）
      '@typescript-eslint/no-explicit-any': 'off',
      // 允许 require（NestJS 可能使用）
      '@typescript-eslint/no-require-imports': 'off',
      // 关闭 no-unused-expressions（装饰器链式调用）
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
)
