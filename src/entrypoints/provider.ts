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

  // This is UGLY.
  // Unfortunately, some dapps like Lido don't follow the newer standards
  // and only look at `window.ethereum` for the EVM provider.
  (window as unknown as { ethereum: unknown }).ethereum = eth;

  // Some dapps like to disconnect after page changes, so giving it some "kicks"
  // preemptively can help to keep it connected.
  //
  // Focus events alone can be missed depending on tab/window transitions.
  // Resync on multiple resume signals and retry after short delays for dapps
  // that mount wallet listeners after the provider script starts.
  const RESYNC_BURST_THROTTLE_MS = 500;
  const RESYNC_RETRY_DELAYS_MS = [250, 1000, 2000, 4000] as const;
  let lastResyncBurstAt = 0;
  let resyncRetryTimers: number[] = [];

  const resync = () => {
    void Relay.ping().catch((error) => {
      console.error("Provider ping failed:", error);
    });
    void eth.reconfigure({ force: true }).catch((error) => {
      console.error("Ethereum provider resync failed:", error);
    });
  };

  const scheduleResyncBurst = () => {
    const now = Date.now();
    if (now - lastResyncBurstAt < RESYNC_BURST_THROTTLE_MS) return;
    lastResyncBurstAt = now;

    for (const timer of resyncRetryTimers) window.clearTimeout(timer);
    resyncRetryTimers = RESYNC_RETRY_DELAYS_MS.map((delay) =>
      window.setTimeout(resync, delay),
    );

    resync();
  };

  scheduleResyncBurst();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleResyncBurst, {
      once: true,
    });
    window.addEventListener("load", scheduleResyncBurst, { once: true });
  }

  window.addEventListener("focus", scheduleResyncBurst);
  window.addEventListener("pageshow", scheduleResyncBurst);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleResyncBurst();
  });
});
