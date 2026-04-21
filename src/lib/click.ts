import { Config } from "./config";
import { Login } from "./login";
import { SidePanel } from "./sidepanel";
import { Option } from "./types";

function parseOrigin(tabUrl: Option<string>): Option<string> {
  if (!tabUrl) return;

  try {
    const parsed = new URL(tabUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
    return parsed.origin;
  } catch {
    return;
  }
}

async function openSidePanel(tabId: number) {
  await browser.sidePanel.open({ tabId }).catch((error) => {
    console.log("Could not open side panel:", error);
  });
}

// Click has the following meanings:
// a) not logged in -> login
// b) logged in -> open side panel
// c) if origin is not allowed, keep /defi open and push connect context
//
// Note that this is all annoyingly buggy.
// https://issues.chromium.org/issues/40929586
// https://groups.google.com/a/chromium.org/g/chromium-extensions/c/WRGFOAHxoaY/m/r_D0ldVGAAAJ
// https://github.com/w3c/webextensions/issues/521
export async function onClicked(tab: globalThis.Browser.tabs.Tab) {
  // console.log("tab", tab);
  // console.log(`extension icon clicked on page "${tab.title}" (${tab.url})`);

  if (tab.id === undefined) {
    console.log("no tab id:", tab);
    return;
  }

  await openSidePanel(tab.id);
  void Config.refreshAppearanceForTab(tab.id, tab.url);

  const login = await Login.load();

  // Not logged in => login
  if (!login) {
    await Login.login();
    await Config.refreshAppearanceForTab(tab.id, tab.url);
    return;
  }

  const origin = parseOrigin(tab.url);
  if (!origin) {
    await SidePanel.setPath(tab.id, SidePanel.defaultPath());
    await SidePanel.setDefiContext(
      tab.id,
      { addExtensionOrigin: undefined },
      { replace: false },
    );
    return;
  }

  await SidePanel.setPath(tab.id, SidePanel.defaultPath());
  await SidePanel.setDefiContext(
    tab.id,
    { addExtensionOrigin: Config.allowed(origin) ? undefined : origin },
    { replace: false },
  );
}
