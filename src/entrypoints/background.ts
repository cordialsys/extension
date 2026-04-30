import { onClicked } from "@/lib/click";
import { Config } from "@/lib/config";
import { Debug } from "@/lib/debug";
import { Login } from "@/lib/login";
import { onMessage, Port } from "@/lib/handler";
import { SidePanel } from "@/lib/sidepanel";
import * as Treasury from "@/lib/sdk/treasury";
import superjson from "superjson";

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
  Debug.attachGlobal();
  await SidePanel.disableDefault();
  await Config.init();
  await Login.init();
}

type OnActivatedInfo = Parameters<
  Parameters<typeof browser.tabs.onActivated.addListener>[0]
>[0];

type OnUpdatedArgs = Parameters<
  Parameters<typeof browser.tabs.onUpdated.addListener>[0]
>;

function parseRuntimeMessage(message: unknown): unknown {
  if (typeof message !== "string") return message;

  try {
    return superjson.parse(message) as unknown;
  } catch {
    try {
      return JSON.parse(message) as unknown;
    } catch {
      return undefined;
    }
  }
}

function getRuntimeMessageKind(message: unknown) {
  const parsed = parseRuntimeMessage(message);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("kind" in parsed) ||
    typeof parsed.kind !== "string"
  ) {
    return undefined;
  }

  return parsed.kind;
}

function onTabActivated(activeInfo: OnActivatedInfo) {
  void Config.refreshAppearanceForTab(activeInfo.tabId);
}

function onTabUpdated(...args: OnUpdatedArgs) {
  const [tabId, changeInfo, tab] = args;
  if (!changeInfo.url && changeInfo.status !== "complete") return;
  void Config.refreshAppearanceForTab(tabId, tab.url);
}

function onTabCreated(tab: globalThis.Browser.tabs.Tab) {
  if (tab.id === undefined) return;
  void SidePanel.disableForTab(tab.id);
}

function onRuntimeMessage(
  message: unknown,
  sender: globalThis.Browser.runtime.MessageSender,
  respond: (response: string) => void,
) {
  const kind = getRuntimeMessageKind(message);

  if (kind === "cordial:extension:config-updated") {
    Debug.record("background", "config-updated", {
      senderUrl: sender.url,
    });
    void (async () => {
      const config = await Config.fetch();
      await Config.propagate(config);
    })();
    return;
  }

  if (kind === "cordial:extension:proposal-canceled") {
    const parsed = parseRuntimeMessage(message);
    const proposalName =
      typeof parsed === "object" &&
      parsed !== null &&
      "proposalName" in parsed &&
      typeof parsed.proposalName === "string"
        ? parsed.proposalName
        : undefined;
    Debug.record("background", "proposal-canceled", {
      proposalName,
      senderUrl: sender.url,
    });
    console.info("[cordial-extension:background] proposal-canceled", {
      proposalName,
      senderUrl: sender.url,
    });
    Treasury.Call.cancelWait(proposalName);
    return;
  }

  if (kind !== "cordial:provider:request") {
    return;
  }

  if (typeof message !== "string") {
    return;
  }

  return onMessage(message as string, sender, respond);
}

async function background() {
  Config.addContextMenu();
  browser.runtime.onConnect.addListener(Port.set);

  // Register listeners before async initialization so early requests are not missed.
  browser.action.onClicked.addListener(onClicked);
  browser.runtime.onMessage.addListener(onRuntimeMessage);
  browser.contextMenus.onClicked.addListener(Config.onContextMenu);
  browser.notifications.onButtonClicked.addListener(
    Config.onNotificationButtonClicked,
  );
  browser.tabs.onActivated.addListener(onTabActivated);
  browser.tabs.onCreated.addListener(onTabCreated);
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
