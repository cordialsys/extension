// "unlisted script" that is injected by content.ts into the defi app
import { Ethereum } from "@/lib/provider/eth";
import { Solana } from "@/lib/provider/sol";
import { Relay, message } from "@/lib/relay";

export default defineUnlistedScript(() => {
  console.log("♥️ Starting the Cordial Provider");

  // listen to broadcasts + responses from the extension
  window.addEventListener("message", message);

  // construct the providers
  const eth = new Ethereum();
  const sol = new Solana();

  Relay.init({
    eth: eth.configure.bind(eth),
    sol: sol.configure.bind(sol),
  });

  // make providers available in global name space for easy debug access
  // e.g. can do `await cordial.eth.config()` or  `await cordial.eth.reconfigure()`
  const attach = window as unknown as { cordial: unknown };
  attach.cordial = {
    eth,
    sol,
    logout: Relay.logout,
    ping: Relay.ping,
  };

  // Focus events alone can be missed depending on tab/window transitions.
  // Ping on multiple resume signals and throttle duplicate bursts.
  const PING_THROTTLE_MS = 500;
  let lastPingAt = 0;

  const ping = () => {
    void Relay.ping().catch((error) => {
      console.error("Provider ping failed:", error);
    });
  };

  const pingIfReady = () => {
    const now = Date.now();
    if (now - lastPingAt < PING_THROTTLE_MS) return;
    lastPingAt = now;
    ping();
  };

  pingIfReady();
  window.addEventListener("focus", pingIfReady);
  window.addEventListener("pageshow", pingIfReady);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pingIfReady();
  });
});
