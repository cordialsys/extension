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

export const SidePanel = {
  defaultPath(): string {
    return "/sidepanel.html";
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
    await browser.sidePanel
      .setOptions({ tabId, path: SidePanel.defaultPath(), enabled: true })
      .catch((error) => {
        console.log("Could not set side panel path:", error);
      });

    const search = searchFromPath(path);
    await browser.runtime
      .sendMessage({ kind: "cordial:sidepanel:navigate", tabId, search })
      .catch((error) => {
        console.log("Could not signal side panel navigation:", error);
      });
  },
};
