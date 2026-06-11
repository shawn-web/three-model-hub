/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  // 单元测试文件：仅匹配 *.spec.ts（不匹配 *.e2e-spec.ts）
  testMatch: ['**/*.spec.ts'],
  // 进一步排除 e2e 文件，避免 glob 边界匹配
  testPathIgnorePatterns: ['/node_modules/', '\\.e2e-spec\\.ts$'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/test/jest.setup.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      // 单元测试专用 tsconfig：包含 jest globals 类型
      tsconfig: 'test/tsconfig.unit.json',
    }],
  },
}
