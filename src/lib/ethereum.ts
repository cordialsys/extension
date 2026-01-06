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

import { EventEmitter } from "./event_emitter";
import { Eth, Nonce, Requests } from "./types";

const REQUESTS: Requests = new Map();

export class Ethereum extends EventEmitter implements Provider {
  // private requests: Requests = new Map();

  constructor() {
    super();
    window.addEventListener("eip6963:requestProvider", this.announce);
    window.addEventListener("message", this.fromRelay);
    // TODO: Only announce if the origin is allowed?
    this.announce();
  }

  async request(args: Eth.Request): Promise<unknown> {
    const { method, params } = args as Eth.Request;

    if (!method) throw new Error("Invalid Ethereum request");
    switch (method) {
      case "eth_accounts":
      case "eth_blockNumber":
      case "eth_chainId":
      case "eth_requestAccounts": // does https://eips.ethereum.org/EIPS/eip-1102 change anything?
      case "eth_sendTransaction":
      case "eth_swithEthereumChain":
        console.log(`app 👉 eth-provider ${method}(${params})`);
        return this.fromProvider(method, params);

      default:
        throw providerError(-32601, `Method ${method} not supported`);
    }
  }

  // forward requests to relay
  private fromProvider(method: string, params?: unknown): Promise<unknown> {
    const id = Nonce.new();
    const { promise, resolve, reject } = Promise.withResolvers();
    REQUESTS.set(id, [resolve, reject]);
    window.postMessage(
      {
        id,
        kind: "cordial:provider:request",
        provider: "ETH",
        method,
        params,
      },
      "*",
    );
    return promise;
  }

  // forward responses from relay ("backwards" from point of view of app)
  private fromRelay(event: MessageEvent) {
    const data = event.data;
    console.log("eth provider got data", data);
    if (data.kind !== "cordial:extension:response") {
      return;
    }
    console.log("  eth-provider 👈 relay ::", data);
    const request = REQUESTS.get(data.id);
    if (!request) {
      console.log("No such request for", data.id);
      return;
    }
    REQUESTS.delete(data.id);
    const [resolve, reject] = request;
    if (data.error) {
      console.log("app 👈 eth-provider :: rejecting ::", data.result);
      reject(providerError(-32603, String(data.error)));
    } else {
      console.log("app 👈 eth-provider :: resolving ::", data.result);
      resolve(data.result);
    }
  }

  private announce() {
    const INFO: Info = {
      uuid: "9f5b2a5a-2f4d-4a6b-9d3f-6963aaaa0001",
      name: "Cordial Treasury",
      icon: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="%23006AFF"/><path d="M16 24h32v16H16z" fill="white"/><circle cx="44" cy="32" r="3" fill="%23006AFF"/></svg>`,
      rdns: "systems.cordial.treasury",
    };

    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", {
        detail: { info: INFO, provider: this },
      }),
    );
    console.log("📢 Announced Cordial Ethereum provider");
  }
}

// export const ETHEREUM = new Ethereum();

interface Provider {
  request(args: Eth.Request): Promise<unknown>;
}

interface ProviderError extends Error {
  code: number;
  data?: unknown;
}

interface Info {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

function providerError(
  code: number,
  message: string,
  data?: unknown,
): ProviderError {
  const error = new Error(message) as ProviderError;
  error.code = code;
  error.data = data;
  return error;
}
