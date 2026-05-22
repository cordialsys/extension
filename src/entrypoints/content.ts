import { relayBroadcast, relayRequest } from "@/lib/relay";

const EXTENSION_INSTALLED_PING_KIND = "cordial:defi:extension-installed-ping";
const EXTENSION_INSTALLED_PONG_KIND = "cordial:defi:extension-installed-pong";

// Installation detection only. Intentionally ignore Treasury's allowed-origin
// config here; wallet/provider access is checked separately.
function relayInstalledDetection(event: MessageEvent<unknown>) {
  if (event.source !== window) return;

  const message = event.data;
  if (
    !message ||
    typeof message !== "object" ||
    !("kind" in message) ||
    message.kind !== EXTENSION_INSTALLED_PING_KIND
  ) {
    return;
  }

  window.postMessage(
    {
      kind: EXTENSION_INSTALLED_PONG_KIND,
      requestId:
        "requestId" in message && typeof message.requestId === "string"
          ? message.requestId
          : undefined,
    },
    window.location.origin,
  );
}

export default defineContentScript({
  matches: ["*://*/*"],
  async main() {
    // Initialize the relay
    window.addEventListener("message", relayInstalledDetection);
    window.addEventListener("message", relayRequest);

    // Inject the provider script
    await injectScript("/provider.js", { keepInDom: true });
    console.log("💉 Injected Cordial provider.js");

    // Connect here only after the provider is injected
    const port = browser.runtime.connect({ name: "cordial:broadcast:port" });
    port.onMessage.addListener(relayBroadcast);

    console.log("♥️ Cordial Content initialized");
  },
});
