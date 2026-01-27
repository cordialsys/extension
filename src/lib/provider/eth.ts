// Copyright 2025 Cordial Systems, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// Following
// https://eips.ethereum.org/EIPS/eip-1193
// https://eips.ethereum.org/EIPS/eip-6963

import { EventEmitter } from "@/lib/event_emitter";
import { ethRequest } from "@/lib/relay";
import { Eth, Option } from "@/lib/types";

const INFO: Eth.Info = {
  uuid: "db69fd17-3a07-453d-92c9-e51a6027de1d",
  name: "Cordial Wallet (ETH)",
  icon: `data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgNDQgNDQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgc3R5bGU9ImZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDoyIj48cGF0aCBkPSJNMjAuNDY5IDMwLjgwMmM1LjcwNyAwIDEwLjMzMy00LjYyNiAxMC4zMzMtMTAuMzMzcy00LjYyNi0xMC4zMzQtMTAuMzMzLTEwLjMzNGMtNS43MDggMC0xMC4zMzQgNC42MjctMTAuMzM0IDEwLjMzNHM0LjYyNiAxMC4zMzMgMTAuMzM0IDEwLjMzM20wIDMuOWM3Ljg2IDAgMTQuMjMzLTYuMzcyIDE0LjIzMy0xNC4yMzNTMjguMzI5IDYuMjM2IDIwLjQ2OSA2LjIzNiA2LjIzNSAxMi42MDggNi4yMzUgMjAuNDY5czYuMzczIDE0LjIzMyAxNC4yMzQgMTQuMjMzIiBzdHlsZT0iZmlsbDojMzczZDNkIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgyLjE0MSAxLjUzMSkiLz48cGF0aCBkPSJtMjMuOTA0LjI4LS42NDMgMy44NDZhMTYuOCAxNi44IDAgMCAwLTUuNTE3IDBMMTcuMTAxLjI4YTIwLjcgMjAuNyAwIDAgMSA2LjgwMyAwTTEzLjMzNiAxLjI4NWwxLjM2NSAzLjY1M2ExNi42IDE2LjYgMCAwIDAtNC43NjQgMi43NTFMNy40NDkgNC42ODRhMjAuNSAyMC41IDAgMCAxIDUuODg3LTMuMzk5TTQuNjkyIDcuNDM2bDMuMDEgMi40ODRhMTYuNiAxNi42IDAgMCAwLTIuNzU2IDQuNzU3bC0zLjY1OC0xLjM2M2EyMC40IDIwLjQgMCAwIDEgMy40MDQtNS44NzhNLjI4MSAxNy4wNzNBMjAuNSAyMC41IDAgMCAwIDAgMjAuNDY5cS4wMDIgMS43MzcuMjgxIDMuMzk2bDMuODUyLS42NDJhMTYuNiAxNi42IDAgMCAxLS4yMjgtMi43NTRxLjAwMS0xLjQxMy4yMjgtMi43NTR6bTEuMDA3IDEwLjU1MSAzLjY1OC0xLjM2M2ExNi42IDE2LjYgMCAwIDAgMi43NTYgNC43NTZsLTMuMDEgMi40ODRhMjAuNCAyMC40IDAgMCAxLTMuNDA0LTUuODc3bTYuMTYxIDguNjI5IDIuNDg4LTMuMDA1YTE2LjYgMTYuNiAwIDAgMCA0Ljc2NCAyLjc1MWwtMS4zNjUgMy42NTNhMjAuNSAyMC41IDAgMCAxLTUuODg3LTMuMzk5bTkuNjUyIDQuNDA0LjY0My0zLjg0NWExNi44IDE2LjggMCAwIDAgNS41MTcgMGwuNjQzIDMuODQ1YTIwLjYgMjAuNiAwIDAgMS0zLjQwMS4yODFjLTEuMTU5IDAtMi4yOTYtLjA5Ni0zLjQwMi0uMjgxbTEwLjU2OS0xLjAwNS0xLjM2Ni0zLjY1M2ExNi42IDE2LjYgMCAwIDAgNC43NjQtMi43NTFsMi40ODkgMy4wMDVhMjAuNSAyMC41IDAgMCAxLTUuODg3IDMuMzk5bTguNjQzLTYuMTUxLTMuMDEtMi40ODRhMTYuNiAxNi42IDAgMCAwIDIuNzU2LTQuNzU2bDMuNjU5IDEuMzYzYTIwLjUgMjAuNSAwIDAgMS0zLjQwNSA1Ljg3NyIgc3R5bGU9ImZpbGw6I2Q3M2Q3NCIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMi4xNDEgMS41MzEpIi8+PC9zdmc+`,
  rdns: "systems.cordial.treasury",
};

async function requestConfig(): Promise<Option<Eth.Config>> {
  return ethRequest("cordial:config") as Promise<Option<Eth.Config>>;
}

export class Ethereum extends EventEmitter implements Eth.Provider {
  async config(): Promise<Option<Eth.Config>> {
    return requestConfig();
  }

  async start() {
    console.log("Initializing Cordial Ethereum Provider");
    try {
      const config = await requestConfig();
      console.log("Initial EVM config", config);
      if (!config) return;

      window.addEventListener("eip6963:requestProvider", this.announce);
      this.announce();
    } catch (error) {
      console.error(`Ethereum provider start error: ${error}`);
    }
  }

  private announce() {
    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", {
        detail: { info: INFO, provider: this },
      }),
    );
    console.log("📢 Announced Cordial Ethereum provider");
  }

  async request(args: Eth.Request): Promise<unknown> {
    const { method, params } = args as Eth.Request;

    // if (method === "wallet_switchEthereumChain") {
    //   this.emit("chainChanged", params?.chainId)
    //   return { };
    // }

    if (!method) throw new Error("Invalid Ethereum request");
    return ethRequest(method, params);
  }
}
