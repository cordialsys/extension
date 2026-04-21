import { Option } from "./types";

const PATHS = new Map<number, string>();
const DEFI_CONTEXTS = new Map<number, DefiContext>();

export interface DefiContext {
  addExtensionOrigin?: string;
  proposalName?: string;
}

export const SidePanel = {
  defaultPath(): string {
    return "/sidepanel.html";
  },

  currentPath(tabId: number): Option<string> {
    return PATHS.get(tabId);
  },

  async setPath(tabId: number, path: string) {
    const previousPath = PATHS.get(tabId) ?? SidePanel.defaultPath();
    PATHS.set(tabId, path);
    if (previousPath === path) {
      return;
    }

    await browser.sidePanel
      .setOptions({ tabId, path, enabled: true })
      .catch((error) => {
        console.log("Could not set side panel path:", error);
      });
  },

  currentDefiContext(tabId: number): Option<DefiContext> {
    return DEFI_CONTEXTS.get(tabId);
  },

  async setDefiContext(
    tabId: number,
    nextContext: Partial<DefiContext>,
    options?: { replace?: boolean },
  ) {
    const previousContext = DEFI_CONTEXTS.get(tabId);
    const mergedContext = options?.replace
      ? {
          addExtensionOrigin: nextContext.addExtensionOrigin,
          proposalName: nextContext.proposalName,
        }
      : {
          addExtensionOrigin:
            nextContext.addExtensionOrigin ??
            previousContext?.addExtensionOrigin,
          proposalName:
            nextContext.proposalName ?? previousContext?.proposalName,
        };
    const normalizedContext =
      mergedContext.addExtensionOrigin || mergedContext.proposalName
        ? mergedContext
        : undefined;

    if (normalizedContext) {
      DEFI_CONTEXTS.set(tabId, normalizedContext);
    } else {
      DEFI_CONTEXTS.delete(tabId);
    }

    if (JSON.stringify(previousContext) === JSON.stringify(normalizedContext)) {
      return;
    }

    const [activeTab] = await browser.tabs
      .query({ active: true, lastFocusedWindow: true })
      .catch((error) => {
        console.log(
          "Could not query active tab for side panel context:",
          error,
        );
        return [];
      });

    if (activeTab?.id !== tabId) {
      return;
    }

    await browser.runtime
      .sendMessage({
        kind: "cordial:sidepanel:defi-context",
        tabId,
        addExtensionOrigin: normalizedContext?.addExtensionOrigin ?? null,
        proposalName: normalizedContext?.proposalName ?? null,
      })
      .catch((error) => {
        console.log("Could not signal side panel context:", error);
      });
  },
};
