import { browser_action, CONFIG_REFRESH } from "./constants";
import { Login } from "./login";
import { Sdk } from "./sdk";
import * as A from "./sdk/admin";
import { None, Option } from "./types";
import { evm, svm } from "./handler";

let CONFIG: Option<Config> = None;

export const Config = {
  // fetches the latest config if logged in
  async fetch(): Promise<Option<Config>> {
    const login = await Login.load();
    if (!login) return login;
    return await Sdk.admin.users.extension.maybe(login.userId);
  },

  current(): Option<Config> {
    return CONFIG;
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

  async propagate(config: Option<Config>) {
    CONFIG = config;
    await evm.propagate(None, config);
    await svm.propagate(config);
  },

  allowed(origin: string): boolean {
    const config = Config.current();
    if (!config) return false;
    return config.origins.includes(origin);
  },

  async toggle(origin: string, tab: number) {
    const config = Config.current();
    const login = await Login.load();
    if (!config || !login) return;
    const allowed = config.origins.includes(origin);
    console.log(`Origin ${origin} currently allowed? ${allowed}`);
    if (allowed) {
      config.origins = config.origins.filter((o) => o !== origin);
      const result = await Sdk.admin.users.extension.set(login.userId, config);
      if (!result.ok) return;
      await Config.propagate(config);
      Config.setBadge(config, tab, false);
    } else {
      config.origins.push(origin);
      const result = await Sdk.admin.users.extension.set(login.userId, config);
      if (!result.ok) return;
      await Config.propagate(config);
      Config.setBadge(config, tab, true);
    }
  },

  async init() {
    const config = await Config.fetch();
    await Config.propagate(config);
  },

  async track() {
    const config = await Config.fetch();

    if (JSON.stringify(Config.current()) !== JSON.stringify(config)) {
      console.log("Config changed", config);
      await Config.propagate(config);
    }

    setTimeout(Config.track, CONFIG_REFRESH);
  },

  async setBadge(config: Option<Config>, tab: number, allowed: boolean) {
    const text = allowed ? "✓" : "✗";
    const color = allowed ? "#0F0" : "#F00";
    browser_action.setBadgeText({ tabId: tab, text });
    browser_action.setBadgeBackgroundColor({ tabId: tab, color });
    browser_action.setTitle({
      title: JSON.stringify(config, null, 2) ?? "No config yet",
    });
  },
};

export interface Config extends A.ExtensionConfig {}
export interface Extension extends A.Extension {}
export interface Treasury extends A.ExtensionTreasury {}
