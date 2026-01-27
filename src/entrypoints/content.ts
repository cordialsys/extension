import { relayBroadcast, relayRequest } from "@/lib/relay";

export default defineContentScript({
  matches: ["*://*/*"],
  async main() {
    // Initialize the relay
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
