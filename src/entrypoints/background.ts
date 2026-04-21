import { onClicked } from "@/lib/click";
import { Config } from "@/lib/config";
import { Login } from "@/lib/login";
import { onMessage, Port } from "@/lib/handler";
import { SidePanel } from "@/lib/sidepanel";

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
type RuntimeMessageSender = Parameters<
  Parameters<typeof browser.runtime.onMessage.addListener>[0]
>[1];
type RuntimeMessageResponder = Parameters<
  Parameters<typeof browser.runtime.onMessage.addListener>[0]
>[2];

function onTabActivated(activeInfo: OnActivatedInfo) {
  void Config.refreshAppearanceForTab(activeInfo.tabId);
  void Config.syncSidePanelForTab(activeInfo.tabId);
}

function onTabUpdated(...args: OnUpdatedArgs) {
  const [tabId, changeInfo, tab] = args;
  if (!changeInfo.url && changeInfo.status !== "complete") return;
  void Config.refreshAppearanceForTab(tabId, tab.url);
  void Config.syncSidePanelForTab(tabId, tab.url);
}

// Keep ALL runtime messages on a single dispatcher.
//
// Provider RPC traffic uses the legacy sendResponse pattern in `lib/handler.ts`.
// Splitting this across multiple `runtime.onMessage` listeners, or making the
// sidepanel path async-first, can interfere with wallet detection and request
// handling in dapps. Always let the provider handler inspect the message first,
// and only fall through to sidepanel-specific messages when it declines it.
function onRuntimeMessage(
  message: unknown,
  sender: RuntimeMessageSender,
  respond: RuntimeMessageResponder,
) {
  const providerResponse = onMessage(message, sender, respond);
  if (providerResponse) {
    return providerResponse;
  }

  const parsedMessage =
    typeof message === "string"
      ? (() => {
          try {
            return JSON.parse(message) as unknown;
          } catch {
            return null;
          }
        })()
      : message;

  if (
    !parsedMessage ||
    typeof parsedMessage !== "object" ||
    !("kind" in parsedMessage)
  ) {
    return;
  }

  if (parsedMessage.kind === "cordial:sidepanel:refresh-config") {
    void Config.refreshNow();
    return;
  }

  if (parsedMessage.kind === "cordial:sidepanel:clear-proposal") {
    void browser.tabs
      .query({
        active: true,
        lastFocusedWindow: true,
      })
      .then(([tab]) => {
        if (tab?.id === undefined) return;
        return SidePanel.setDefiContext(
          tab.id,
          { proposalName: undefined },
          { replace: false },
        );
      })
      .catch((error) => {
        console.log("Could not clear current DeFi proposal context:", error);
      });
    return;
  }

  if (parsedMessage.kind !== "cordial:sidepanel:get-context") {
    return;
  }

  void browser.tabs
    .query({
      active: true,
      lastFocusedWindow: true,
    })
    .then(([tab]) => {
      if (tab?.id === undefined) {
        respond({ addExtensionOrigin: null });
        return;
      }

      respond({
        addExtensionOrigin:
          SidePanel.currentDefiContext(tab.id)?.addExtensionOrigin ??
          Config.defiContext(tab.url).addExtensionOrigin ??
          null,
        proposalName:
          SidePanel.currentDefiContext(tab.id)?.proposalName ?? null,
      });
    })
    .catch((error) => {
      console.log("Could not resolve current DeFi context:", error);
      respond({ addExtensionOrigin: null, proposalName: null });
    });

  return true;
}

async function background() {
  Config.addContextMenu();
  browser.runtime.onConnect.addListener(Port.set);

  // Register listeners before async initialization so early requests are not missed.
  //
  // IMPORTANT: do not add a second `runtime.onMessage` listener for sidepanel
  // or UI messages. Route everything through `onRuntimeMessage` above so the
  // provider bridge stays deterministic.
  browser.action.onClicked.addListener(onClicked);
  browser.runtime.onMessage.addListener(onRuntimeMessage);
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
    void Config.syncSidePanelForTab(tab.id, tab.url);
  }

  // browser.sidePanel
  //   .setPanelBehavior({ openPanelOnActionClick: true })
  //   .catch((error) => console.error(error));
}

export default defineBackground(() => {
  console.log("♥️ Running the Cordial Extension", browser.runtime.id);

  void background();
});
