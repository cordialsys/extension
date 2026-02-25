import { Login } from "./login";

async function openSidePanel(tabId: number) {
  await browser.sidePanel.open({ tabId }).catch((error) => {
    console.log("Could not open side panel:", error);
  });
}

// Click has the following meanings:
// a) not logged in -> login
// b) logged in -> open side panel
//
// Note that this is all annoyingly buggy.
// https://issues.chromium.org/issues/40929586
// https://groups.google.com/a/chromium.org/g/chromium-extensions/c/WRGFOAHxoaY/m/r_D0ldVGAAAJ
// https://github.com/w3c/webextensions/issues/521
export async function onClicked(tab: globalThis.Browser.tabs.Tab) {
  // console.log("tab", tab);
  // console.log(`extension icon clicked on page "${tab.title}" (${tab.url})`);

  if (!tab.id) {
    console.log("no tab id:", tab);
    return;
  }

  await openSidePanel(tab.id);

  const login = await Login.load();

  // Not logged in => login
  if (!login) return await Login.login();
}
