import { get, set } from "idb-keyval";

import { CONFIG_REFRESH } from "./constants";
import { loadLogin } from "./login";
import { Sdk } from "./sdk";
import { Option } from "./types";

export const Config = {
  get(): Promise<Option<Config>> {
    return get("config");
  },
};

export interface Extension {
  revision: string;
  config?: Config;
}

export interface Config {
  addresses: string[];
  origins: string[];
  treasury: Treasury;
}

export interface Treasury {
  name: string;
  url: string;
}

async function fetchConfig(userId: string): Promise<Option<Config>> {
  return await Sdk.admin.users.extension(userId);
}

export async function refreshConfig() {
  const login = await loadLogin();
  // const on = await get("on");
  // if (!on || !login) {
  if (!login) {
    setTimeout(refreshConfig, CONFIG_REFRESH);
    return;
  }
  // console.log("refreshing config");
  const config = await fetchConfig(login.userId);
  if (!config) {
    setTimeout(refreshConfig, CONFIG_REFRESH);
    return;
  }
  if (JSON.stringify(await get("config")) != JSON.stringify(config)) {
    console.log("Config changed:", config);
  }
  await set("config", config);
  // console.log("config", config);
  setTimeout(refreshConfig, CONFIG_REFRESH);
}
