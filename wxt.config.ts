import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: [], //"@wxt-dev/module-svelte"],
  manifest: {
    // Required, don't open popup, only action
    action: {},
    name: "Cordial Treasury",
    icons: {
      16: "/icons/color/16.png",
      24: "/icons/color/24.png",
      48: "/icons/color/48.png",
      128: "/icons/color/128.png",
    },
    // Need access to public Propose API, and get Treasury API for free
    host_permissions: ["https://treasury.cordialapis.com/*"],
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAloJLJ8XRkwR+gieAIt1Uc3DfHOZ7nB4LAr74ZkAkM2VBeoTMD8pXJiruJ/FOHNVDmDStBdW00szVFFp2ikySkPFIT/8RXEtVRAuLSLK9q0tVuoTFtFNvaDTMXf5YNV0dOxCv2HHjf/j5xpXNRyAbI2rnkiENJI0cu3zLCPYEufHoT5BhSAeXgtsEtKePHycCfvwLB8hmXZzYXlYX3Yobgssa2KFwL0yx/skVhnxOu3wKLUvzSrCGia6g83TfWjKlJCixMGAPaVdHhQRNTfdh19D2db2mRr/f60XfDCcw+FwVZarM906fd0x+ft1q8JKN32TnIWv0GFUW0Q87iHIeIQIDAQAB",
    optional_host_permissions: ["https://*/*", "http://*/*"],
    permissions: ["activeTab", "contextMenus", "notifications"],
    web_accessible_resources: [
      {
        resources: ["provider.js"],
        matches: ["*://*/*"],
      },
    ],
  },
  webExt: {
    startUrls: [
      "https://www.orca.so",
      "https://app.uniswap.org",
      "https://jup.ag",
      "https://polymarket.com",
    ],
  },
});
