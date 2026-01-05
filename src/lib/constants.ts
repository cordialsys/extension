// TODO: use fetchTimeout, see https://dmitripavlutin.com/timeout-fetch-request/

// browser.actions is MV3, for firefox MV2 need browser.browserAction
export const browser_action = browser.action ?? browser.browserAction;

// TODO: Should this depend on how long we're still logged into Clerk?
// 15 minutes
export const LOGIN_REFRESH: number = 15 * 60 * 1000;

// TODO: Replace with long-polling for immediate updates
// 5 seconds
export const CONFIG_REFRESH: number = 5 * 1000;

export const GRAY = {
  16: "/icons/gray/16.png",
  24: "/icons/gray/24.png",
  48: "/icons/gray/48.png",
  128: "/icons/gray/128.png",
};

export const COLOR = {
  16: "/icons/16.png",
  24: "/icons/24.png",
  48: "/icons/48.png",
  128: "/icons/128.png",
};
