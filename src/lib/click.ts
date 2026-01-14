import { get } from "idb-keyval";
import { Config } from "./config";
import { turnOn } from "./login";

// Click has the following meanings:
// a) turned off -> turn on
// b) turned on
//    1) origin not allowed -> allow origin
//    1) origin allowed -> unallow origin
//
// Question: How to "turn off"?
export async function onClicked(tab: globalThis.Browser.tabs.Tab) {
  console.log("tab", tab);
  console.log(`extension icon clicked on page "${tab.title}" (${tab.url})`);

  if (!(await get("on"))) {
    await turnOn();
    return;
  }

  if (!tab.url || !tab.id) return;
  const url = new URL(tab.url);
  const origin = url.origin;

  await Config.toggle(origin, tab.id);
}
