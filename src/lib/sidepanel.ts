import { Debug } from "./debug";
import { Option } from "./types";

function pathWith(search: URLSearchParams): string {
  const query = search.toString();
  if (!query) return "/sidepanel.html";
  return `/sidepanel.html?${query}`;
}

function searchFromPath(path: string): string {
  try {
    const url = new URL(path, "https://extension.local");
    return url.search;
  } catch {
    return "";
  }
}

async function signalNavigation(path: string) {
  const search = searchFromPath(path);
  Debug.record("background", "sidepanel-navigate-signal", {
    proposalName: new URLSearchParams(search).get("proposal"),
    search,
  });
  await browser.runtime.sendMessage({
    kind: "cordial:sidepanel:navigate",
    search,
  });
}

export const SidePanel = {
  defaultPath(): string {
    return "/sidepanel.html";
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

  addExtensionOriginPath(origin: string): string {
    const search = new URLSearchParams();
    search.set("add-extension-origin", origin);
    return pathWith(search);
  },

  proposalPath(proposalName: string, treasuryId: Option<string>): string {
    const search = new URLSearchParams();
    search.set("proposal", proposalName);
    if (treasuryId) {
      search.set("t", treasuryId);
    }
    return pathWith(search);
  },

  async setPath(tabId: number, path: string) {
    Debug.record("background", "sidepanel-set-path", {
      path,
      tabId,
    });
    await browser.sidePanel
      .setOptions({ tabId, path: SidePanel.defaultPath(), enabled: true })
      .catch((error) => {
        console.log("Could not set side panel path:", error);
      });

    await signalNavigation(path).catch((error) => {
      console.log("Could not signal side panel navigation:", error);
    });
  },

  async openPath(tabId: number, path: string) {
    Debug.record("background", "sidepanel-open-path", {
      path,
      tabId,
    });
    await browser.sidePanel
      .setOptions({ tabId, path: SidePanel.defaultPath(), enabled: true })
      .catch((error) => {
        console.log("Could not set side panel path:", error);
      });

    const navigated = await signalNavigation(path)
      .then(() => true)
      .catch((error) => {
        Debug.record("background", "sidepanel-navigate-signal-failed", {
          error: error instanceof Error ? error.message : String(error),
          path,
          tabId,
        });
        return false;
      });

    if (navigated) {
      Debug.record("background", "sidepanel-navigate-signal-succeeded", {
        path,
        tabId,
      });
      return;
    }

    await browser.sidePanel
      .setOptions({ tabId, path, enabled: true })
      .catch((error) => {
        console.log("Could not set side panel proposal path:", error);
      });

    await browser.sidePanel
      .open({ tabId })
      .then(() => {
        Debug.record("background", "sidepanel-opened", {
          path,
          tabId,
        });
      })
      .catch((error) => {
        Debug.record("background", "sidepanel-open-failed", {
          error: error instanceof Error ? error.message : String(error),
          path,
          tabId,
        });
        console.log("Could not open side panel for proposal:", error);
      });
  },
};
