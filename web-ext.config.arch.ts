import { defineWebExtConfig } from 'wxt';

export default defineWebExtConfig({
  binaries: {
    edge: '/usr/bin/microsoft-edge-stable',
    chromium: '/usr/bin/chromium',
  },
});
