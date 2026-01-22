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
import { cordialRequest, response } from "@/lib/relay";
// import { Nonce } from "@/lib/types";

export default defineUnlistedScript(() => {
  console.log("♥️ Running the Cordial Provider");
  // TODO: Introduce a notion of instance?
  // The worry is that e.g. two ETH providers will compete
  // over then chain (say Polymarket wants Polygon, Uniswap wants Ethereum).
  // const instance = Nonce.new();
  window.addEventListener("message", response);
  cordialRequest("cordial:ping");
  // TODO: Only expose providers if the origin is allowed (can tell by response of ping)
  // This would be easy to do.. but we also have to then expose
  // it later on (if the user allows the origin by clicking on the extension)
  const eth = new Ethereum(/*instance*/);
  setTimeout(eth.start.bind(eth), 0);
  const sol = new Solana(/*instance*/);
  setTimeout(sol.start.bind(sol), 0);
  // clobber the global name space for easy debug access
  (window as unknown as { cordial: unknown }).cordial = { eth, sol };
});
