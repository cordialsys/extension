// Copyright 2025 Cordial Systems, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// "unlisted script" that is injected by content.ts into the defi app
import { Ethereum } from "@/lib/provider/eth";
import { Solana } from "@/lib/provider/sol";
import { cordialRequest, init, message } from "@/lib/relay";

export default defineUnlistedScript(() => {
  console.log("♥️ Starting the Cordial Provider");

  // listen to broadcasts + responses from the extension
  window.addEventListener("message", message);

  // construct the providers
  const eth = new Ethereum();
  const sol = new Solana();

  init({
    eth: eth.configure.bind(eth),
    sol: sol.configure.bind(sol),
  });

  // make providers available in global name space for easy debug access
  // e.g. can do `await cordial.eth.config()` or  `await cordial.eth.reconfigure()`
  const attach = window as unknown as { cordial: unknown };
  attach.cordial = {
    eth,
    sol,
    ping: () => cordialRequest("cordial:ping"),
  };

  // send a kind of heartbeat, this can update the extension icon
  cordialRequest("cordial:ping");
});
