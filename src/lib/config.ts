import { get, set } from "idb-keyval";

import { browser_action, CONFIG_REFRESH } from "./constants";
import { Login } from "./login";
import { Sdk } from "./sdk";
import * as A from "./sdk/admin";
import { Option } from "./types";

export const Config = {
  // fetches the latest config if logged in
  async fetch(): Promise<Option<Config>> {
    const login = await Login.load();
    if (!login) return login;
    return await Sdk.admin.users.extension.maybe(login.userId);
  },

  // loads the currently active config, assumed fetched/refreshed in the background
  async load(): Promise<Option<Config>> {
    return get("config");
  },

  async allowed(origin: string): Promise<boolean> {
    const config = await Config.load();
    if (!config) return false;
    return config.origins.includes(origin);
  },

  async toggle(origin: string, tab: number) {
    const config = await Config.load();
    const login = await Login.load();
    if (!config || !login) return;
    const allowed = config.origins.includes(origin);
    console.log(`Origin ${origin} currently allowed? ${allowed}`);
    if (allowed) {
      config.origins = config.origins.filter((o) => o !== origin);
      const result = await Sdk.admin.users.extension.set(login.userId, config);
      if (!result.ok) return;
      await set("config", config);
      Config.setBadge(config, tab, false);
    } else {
      config.origins.push(origin);
      const result = await Sdk.admin.users.extension.set(login.userId, config);
      if (!result.ok) return;
      await set("config", config);
      Config.setBadge(config, tab, true);
    }
  },

  async track() {
    const config = await Config.fetch();

    if (!config) {
      setTimeout(Config.track, CONFIG_REFRESH);
      return;
    }

    if (JSON.stringify(await Config.load()) !== JSON.stringify(config)) {
      console.log("Config changed:", config);
      await set("config", config);
    }

    setTimeout(Config.track, CONFIG_REFRESH);
  },

  async setBadge(config: Option<Config>, tab: number, allowed: boolean) {
    const text = allowed ? "✓" : "✗";
    const color = allowed ? "#0F0" : "#F00";
    browser_action.setBadgeText({ tabId: tab, text });
    browser_action.setBadgeBackgroundColor({ tabId: tab, color });
    browser_action.setTitle({ title: JSON.stringify(config, null, 2) });
  },
};

export interface Config extends A.ExtensionConfig {}
export interface Extension extends A.Extension {}
export interface Treasury extends A.ExtensionTreasury {}
