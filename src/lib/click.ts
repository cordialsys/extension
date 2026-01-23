import { Config } from "./config";
import { Login } from "./login";

// Click has the following meanings:
// a) turned off -> turn on
// b) turned on
//    1) origin not allowed -> allow origin
//    1) origin allowed -> unallow origin
//
// Question: How to "turn off"?
export async function onClicked(tab: globalThis.Browser.tabs.Tab) {
  // console.log("tab", tab);
  // console.log(`extension icon clicked on page "${tab.title}" (${tab.url})`);

  const login = await Login.load();

  // a) Not logged in => login
  if (!login) return await Login.login();

  // b) Logged in => toggle origin allowanc
  if (!tab.url || !tab.id) return;

  const url = new URL(tab.url);
  const origin = url.origin;

  await Config.toggle(origin, tab.id);
}
