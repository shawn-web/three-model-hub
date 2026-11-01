import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * 与 3D / Cesium 运行时对象、第三方插件实例交互的文件。
 * 这类对象由 CDN 在运行时注入（window.Cesium）或由 Three.js 动态构造，
 * 无法用静态类型精确建模，强行标注只会引入大量无意义的类型断言，
 * 因此在这些文件内允许显式 any；业务代码中仍严格禁止。
 */
const RUNTIME_INTEROP_FILES = [
  'src/utils/cesium-instance.ts',
  'src/utils/load-cesium.ts',
  'src/plugins/rotation-mode/index.tsx',
  'src/plugins/transform-controls/index.tsx',
  'src/components/SceneTree.tsx',
]

export default defineConfig([
  globalIgnores(['dist', 'public/cesium']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // 约定：以 _ 开头的参数 / 变量视为有意未使用（如接口占位、mock 回调）
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // 测试代码中大量构造 mock 桩对象，允许 any 以保持用例可读性
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: RUNTIME_INTEROP_FILES,
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
