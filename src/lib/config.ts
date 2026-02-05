import { COLOR, CONFIG_REFRESH } from "./constants";
import { Login } from "./login";
import { Sdk } from "./sdk";
import * as A from "./sdk/admin";
import { None, Option } from "./types";
import { evm, svm } from "./handler";

let REVISION: Option<string> = None;
let CONFIG: Option<Config> = None;

const CONTEXT_MENU_ID = "treasury-api-access";

export const Config = {
  current(): Option<Config> {
    return CONFIG;
  },

  // fetches the latest config if logged in
  async fetch(): Promise<Option<Config>> {
    const login = await Login.load();
    if (!login) return None;

    const result = await Sdk.admin.users.extension.get(login.userId);
    if (!result.ok) {
      return None;
    }
    const extension = result.value as Extension;
    REVISION = extension.revision;
    // console.log("extension:", extension);
    return extension.config;
  },

  async poll(): Promise<Option<Config>> {
    const login = await Login.load();
    if (!login) return None;

    // 1. If we have no REVISION, fetch it
    if (!REVISION) return await Config.fetch();

    // 2. If we do, try to poll it
    // console.log("POLLING CONFIG, was", REVISION, Config.current());
    const result = await Sdk.admin.users.extension.poll(login.userId, REVISION);
    // console.log("POLLING CONFIG RESULT:", result);
    if (!result.ok) {
      // might be a timeout
      return await Config.fetch();
    }

    const extension = result.value as Extension;
    REVISION = extension.revision;
    return extension.config;
  },

  async track() {
    const config = await Config.poll();

    if (JSON.stringify(Config.current()) !== JSON.stringify(config)) {
      console.log("Config changed", config);
      Config.notify("Config changed", JSON.stringify(config, null, 2));
      await Config.propagate(config);
    }

    setTimeout(Config.track, CONFIG_REFRESH);
  },

  chainAddresses(chain: string): string[] {
    const config = Config.current();
    if (!config) return [];
    const prefix = `chains/${chain}/addresses/`;
    // TODO: Lookup actual address
    return config.addresses
      .filter((a) => a.startsWith(prefix))
      .map((a) => a.slice(prefix.length));
  },

  addContextMenu() {
    browser.contextMenus.create({
      enabled: false,
      id: CONTEXT_MENU_ID,
      title: "No API access required at this time",
      contexts: ["action"],
    });
  },

  inactiveContextMenu(api?: string) {
    let title = "No API access configured at this time";
    if (api) title = `API: ${api}`;

    browser.contextMenus.update(
      CONTEXT_MENU_ID,
      { enabled: false, title },
      () => {
        const error = browser.runtime.lastError;
        if (error) console.log("update error:", error);
      },
    );
  },

  grantContextMenu(api: string) {
    browser.contextMenus.update(CONTEXT_MENU_ID, {
      enabled: true,
      title: `Grant API access: ${api}`,
    });
    Config.notifyApi("Grant access", "Grant access to Treasury API");
  },

  matchPattern(api: string): string {
    const apiWithTrailingSlash = new URL(api).toString();
    return `${apiWithTrailingSlash}*`;
  },

  async propagate(config: Option<Config>) {
    if (config) {
      const api = Config.matchPattern(config.treasury.url);
      const has = await browser.permissions.contains({ origins: [api] });
      if (!has) Config.grantContextMenu(api);
      else Config.inactiveContextMenu(api);
    } else {
      Config.inactiveContextMenu(None);
    }
    CONFIG = config;
    await evm.propagate(None, config);
    await svm.propagate(config);
  },

  onNotificationButtonClicked(notificationId: string, buttonIndex: number) {
    console.log("notification", notificationId);
    if (buttonIndex === 0) Config.requestPermission();
  },

  onContextMenu(info: Browser.contextMenus.OnClickData) {
    if (info.menuItemId !== CONTEXT_MENU_ID) Config.requestPermission();
  },

  // It's IMPORTANT to not introduce `async` in here, otherwise it will no
  // longer be recognized as "user gesture" driven.
  requestPermission() {
    const config = CONFIG;
    if (!config) return;
    const api = Config.matchPattern(config.treasury.url);

    // Again.. don't use the async version of `permissions.contains` or the user gesture
    // status will be lost.
    browser.permissions.contains({ origins: [api] }, (has) => {
      if (has) return;

      browser.permissions.request({ origins: [api] }, (granted) => {
        const error = browser.runtime.lastError;
        if (error) {
          console.error("Permission request error:", error);
          Config.notify(
            "Permission request error",
            error?.message ?? "Unknown error",
          );
          return;
        }

        const treasury =
          CONFIG?.treasury.name.slice("treasuries/".length) ?? "<none>";
        if (granted) {
          console.log("✅ Permission granted for", api);
          Config.inactiveContextMenu(api);
          Config.notify(
            "Permission granted!",
            `You can now access treasury ${treasury}`,
          );
        } else {
          console.log("❌ User denied permission for", api);
          Config.notify(
            "Permission denied.",
            `Please grant permission to access treasury ${treasury}`,
          );
        }
      });
    });
  },

  allowed(origin: string): boolean {
    const config = Config.current();
    if (!config) return false;
    return config.origins.includes(origin);
  },

  async toggle(origin: string, tab: number) {
    const config = Config.current();
    const login = await Login.load();
    if (!config || !login) {
      console.log("Click handler with no config or no login");
      Config.updateAppearance(config, tab, false);
      return;
    }
    const allowed = config.origins.includes(origin);
    console.log(`Origin ${origin} currently allowed? ${allowed}`);
    if (allowed) {
      config.origins = config.origins.filter((o) => o !== origin);
      const result = await Sdk.admin.users.extension.set(login.userId, config);
      if (!result.ok) return;
      await Config.propagate(config);
      Config.updateAppearance(config, tab, false);
    } else {
      config.origins.push(origin);
      const result = await Sdk.admin.users.extension.set(login.userId, config);
      if (!result.ok) return;
      await Config.propagate(config);
      Config.updateAppearance(config, tab, true);
    }
  },

  async init() {
    const config = await Config.fetch();
    await Config.propagate(config);
    Config.track();
  },

  notify(title: string, message: string) {
    browser.notifications.create({
      type: "basic",
      iconUrl: COLOR[48],
      title,
      message,
    });
  },

  notifyApi(title: string, message: string) {
    browser.notifications.create({
      type: "basic",
      iconUrl: COLOR[48],
      title,
      message,
      buttons: [{ title: "Allow" }],
    });
  },

  async updateAppearance(
    config: Option<Config>,
    tab: number,
    allowed: boolean,
  ) {
    const text = allowed ? "✓" : "✗";
    const color = allowed ? "#0F0" : "#F00";
    browser.action.setBadgeText({ tabId: tab, text });
    browser.action.setBadgeBackgroundColor({ tabId: tab, color });
    // console.log("setting badge with config", config);
    browser.action.setTitle({
      title: JSON.stringify(config, null, 2) ?? "No config yet",
    });
  },
};

export interface Config extends A.ExtensionConfig {}
export interface Extension extends A.Extension {}
export interface Treasury extends A.ExtensionTreasury {}
