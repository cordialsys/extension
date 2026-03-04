import { onClicked } from "@/lib/click";
import { Config } from "@/lib/config";
import { Login } from "@/lib/login";
import { onMessage, Port } from "@/lib/handler";

// figure out what state we're in, and ensure the keys
// - on
// - login
// - ...
// are setup
async function init() {
  const attach = globalThis as unknown as { cordial: unknown };
  attach.cordial = {
    Config,
    Login,
  };
  await Config.init();
  await Login.init();
}

type OnActivatedInfo = Parameters<
  Parameters<typeof browser.tabs.onActivated.addListener>[0]
>[0];

type OnUpdatedArgs = Parameters<
  Parameters<typeof browser.tabs.onUpdated.addListener>[0]
>;

function onTabActivated(activeInfo: OnActivatedInfo) {
  void Config.refreshAppearanceForTab(activeInfo.tabId);
}

function onTabUpdated(...args: OnUpdatedArgs) {
  const [tabId, changeInfo, tab] = args;
  if (!changeInfo.url && changeInfo.status !== "complete") return;
  void Config.refreshAppearanceForTab(tabId, tab.url);
}

async function background() {
  Config.addContextMenu();
  browser.runtime.onConnect.addListener(Port.set);

  // Register listeners before async initialization so early requests are not missed.
  browser.action.onClicked.addListener(onClicked);
  browser.runtime.onMessage.addListener(onMessage);
  browser.contextMenus.onClicked.addListener(Config.onContextMenu);
  browser.notifications.onButtonClicked.addListener(
    Config.onNotificationButtonClicked,
  );
  browser.tabs.onActivated.addListener(onTabActivated);
  browser.tabs.onUpdated.addListener(onTabUpdated);

  await init();

  const [tab] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (tab?.id !== undefined) {
    void Config.refreshAppearanceForTab(tab.id, tab.url);
  }

  // browser.sidePanel
  //   .setPanelBehavior({ openPanelOnActionClick: true })
  //   .catch((error) => console.error(error));
}

export default defineBackground(() => {
  console.log("♥️ Running the Cordial Extension", browser.runtime.id);

  void background();
});
