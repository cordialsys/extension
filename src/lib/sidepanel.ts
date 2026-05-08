import { Debug } from "./debug";
import { Option } from "./types";

export interface NavigationContext {
  kind: "cordial:defi:navigate-context";
  addExtensionOrigin?: string;
  proposalName?: string;
  treasuryId?: string;
}

const PENDING_NAVIGATION_BY_TAB = new Map<number, NavigationContext>();

function defaultNavigation(): NavigationContext {
  return { kind: "cordial:defi:navigate-context" };
}

async function signalNavigation(tabId: number, context: NavigationContext) {
  Debug.record("background", "sidepanel-navigate-signal", {
    addExtensionOrigin: context.addExtensionOrigin,
    proposalName: context.proposalName,
    tabId,
  });
  await browser.runtime.sendMessage({
    context,
    kind: "cordial:sidepanel:navigate",
    tabId,
  });
}

export const SidePanel = {
  defaultPath(tabId?: number): string {
    if (tabId === undefined) return "/sidepanel.html";

    const search = new URLSearchParams();
    search.set("tabId", String(tabId));
    return `/sidepanel.html?${search.toString()}`;
  },

  defaultNavigation,

  getPendingNavigation(tabId: number): Option<NavigationContext> {
    return PENDING_NAVIGATION_BY_TAB.get(tabId);
  },

  async disableDefault() {
    await browser.sidePanel.setOptions({ enabled: false }).catch((error) => {
      console.log("Could not disable default side panel:", error);
    });
  },

  async disableForTab(tabId: number) {
    await browser.sidePanel
      .setOptions({ tabId, enabled: false })
      .catch((error) => {
        console.log("Could not disable side panel for tab:", error);
      });
  },

  addExtensionOriginNavigation(origin: string): NavigationContext {
    return {
      ...defaultNavigation(),
      addExtensionOrigin: origin,
    };
  },

  proposalNavigation(
    proposalName: string,
    treasuryId: Option<string>,
  ): NavigationContext {
    return {
      ...defaultNavigation(),
      proposalName,
      treasuryId: treasuryId ?? undefined,
    };
  },

  async setNavigation(tabId: number, context: NavigationContext) {
    PENDING_NAVIGATION_BY_TAB.set(tabId, context);
    Debug.record("background", "sidepanel-set-navigation", {
      addExtensionOrigin: context.addExtensionOrigin,
      proposalName: context.proposalName,
      tabId,
    });
    await browser.sidePanel
      .setOptions({ tabId, path: SidePanel.defaultPath(tabId), enabled: true })
      .catch((error) => {
        console.log("Could not set side panel path:", error);
      });

    await signalNavigation(tabId, context).catch((error) => {
      console.log("Could not signal side panel navigation:", error);
    });
  },

  async openNavigation(tabId: number, context: NavigationContext) {
    PENDING_NAVIGATION_BY_TAB.set(tabId, context);
    Debug.record("background", "sidepanel-open-navigation", {
      addExtensionOrigin: context.addExtensionOrigin,
      proposalName: context.proposalName,
      tabId,
    });
    await browser.sidePanel
      .setOptions({ tabId, path: SidePanel.defaultPath(tabId), enabled: true })
      .catch((error) => {
        console.log("Could not set side panel path:", error);
      });

    const navigated = await signalNavigation(tabId, context)
      .then(() => true)
      .catch((error) => {
        Debug.record("background", "sidepanel-navigate-signal-failed", {
          error: error instanceof Error ? error.message : String(error),
          proposalName: context.proposalName,
          tabId,
        });
        return false;
      });

    if (navigated) {
      Debug.record("background", "sidepanel-navigate-signal-succeeded", {
        proposalName: context.proposalName,
        tabId,
      });
      return;
    }

    await browser.sidePanel
      .open({ tabId })
      .then(() => {
        Debug.record("background", "sidepanel-opened", {
          proposalName: context.proposalName,
          tabId,
        });
      })
      .catch((error) => {
        Debug.record("background", "sidepanel-open-failed", {
          error: error instanceof Error ? error.message : String(error),
          proposalName: context.proposalName,
          tabId,
        });
        console.log("Could not open side panel for proposal:", error);
      });
  },
};
