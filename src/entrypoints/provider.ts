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

  // send a kind of heartbeat, this can update the extension icon
  Relay.heartbeat();
});
