import { get, set } from "idb-keyval";

import { CONFIG_REFRESH } from "./constants";
import { loadLogin } from "./login";

export const Config = {
  get(): Promise<Config | undefined> {
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

async function fetchConfig(userId: string): Promise<Config | undefined> {
  const url = `https://admin.cordialapis.com/v1/users/${userId}/extension`;
  const response = await fetch(url);
  if (!response.ok) {
    return undefined;
  }
  const extension = (await response.json()) as Extension;
  return extension.config;
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
