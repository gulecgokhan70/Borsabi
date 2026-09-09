import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: { include: ['tests/integration/*.test.ts'], maxWorkers: 1, testTimeout: 20000, hookTimeout: 20000 },
});
