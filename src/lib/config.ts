import { get, set } from "idb-keyval";

import { CONFIG_REFRESH } from "./constants";
import { loadLogin } from "./login";

export interface Treasury {
  name: string;
  url: string;
}

export interface Config {
  revision: string;
  addresses?: string[];
  origins?: string[];
  treasury?: Treasury;
}

async function fetchConfig(userId: string): Promise<Config | undefined> {
  const url = `https://admin.cordialapis.com/v1/users/${userId}/extension`;
  const response = await fetch(url);
  if (!response.ok) {
    return undefined;
  }
  return (await response.json()) as Config;
}

export async function refreshConfig() {
  const login = await loadLogin();
  const on = await get("on");
  if (!on || !login) {
    setTimeout(refreshConfig, CONFIG_REFRESH);
    return;
  }
  // console.log("refreshing config");
  const config = await fetchConfig(login.userId);
  if (!config) {
    setTimeout(refreshConfig, CONFIG_REFRESH);
    return;
  }
  await set("config", config);
  // console.log("config", config);
  setTimeout(refreshConfig, CONFIG_REFRESH);
}
