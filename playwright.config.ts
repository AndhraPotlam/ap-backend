import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.TEST_API_URL || 'http://localhost:8000/api/',
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  },
  projects: [
    {
      name: 'api-integration',
    },
  ],
});
