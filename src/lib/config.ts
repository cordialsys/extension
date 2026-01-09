import { get, set } from "idb-keyval";

import { CONFIG_REFRESH } from "./constants";
import { Login } from "./login";
import { Sdk } from "./sdk";
import { ConfigT, ExtensionT, TreasuryT } from "./sdk/admin";
import { Option } from "./types";

export const Config = {
  // fetches the latest config if logged in
  async fetch(): Promise<Option<Config>> {
    const login = await Login.load();
    if (!login) {
      return undefined;
    }
    return await Sdk.admin.users.extension(login.userId);
  },

  // loads the currently active config, assumed fetched/refreshed in the background
  async load(): Promise<Option<Config>> {
    return get("config");
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
};

export interface Config extends ConfigT {}
export interface Extension extends ExtensionT {}
export interface Treasury extends TreasuryT {}
