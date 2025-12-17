import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
  manifest: {
    // Required, don't open popup, only action
    action: {},
    icons: {
      16: "/icons/gray/16.png",
      24: "/icons/gray/24.png",
      48: "/icons/gray/48.png",
      128: "/icons/gray/128.png",
    },
    host_permissions: [
      "https://auth.cordial.systems/*",
      "https://auth.cordialapis.com/*",
      "https://admin.cordialapis.com/*",
    ],
    permissions: ["storage", "tabs"],
  },
  webExt: {
    startUrls: ["https://example.com/"],
  },
});
