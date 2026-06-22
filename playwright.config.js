const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  use: { channel: 'chrome' },     // reuse installed Google Chrome
  reporter: [['list']],
});
