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

// import { EventEmitter as NodeEmitter } from "events";

type Event = string | symbol;
type Listener = (...args: unknown[]) => void;
type Listeners = { [event: Event]: Listener[] };
type Resolver = (value: unknown) => void;
type Rejecter = (reason?: unknown) => void;
type RequestId = [string, number];
type Requests = Map<RequestId, [Resolver, Rejecter]>;

export class EventEmitter {
  private listeners: Listeners = {};

  // aka `addListener`
  on(event: Event, listener: Listener): EventEmitter {
    if (!this.listeners[event]?.push(listener))
      this.listeners[event] = [listener];
    return this;
  }

  // aka `off`
  removeListener(event: Event, listener: Listener): EventEmitter {
    const list = this.listeners[event];
    if (list) {
      this.listeners[event] = list.filter((existing) => existing !== listener);
    }
    return this;
  }

  emit(event: Event, ...args: unknown[]) {
    this.listeners[event]?.forEach((listener) => listener(args));
  }
}

export class Ethereum extends EventEmitter implements Provider {
  // use a nonce specific per instance, so multiple tabs will not get mixed up
  private instanceId: string = "abc123";
  private requestCounter: number = 0;
  private requests: Requests = new Map();

  constructor() {
    super();
    this.announce();
    window.addEventListener("eip6963:requestProvider", this.announce);
    window.addEventListener("message", this.backward);
    console.log("💪 Instantiated the Cordial Ethereum Provider");
  }

  async request(args: Request): Promise<unknown> {
    const { method, params } = args as Request;

    if (!method) throw new Error("Invalid Ethereum request");
    switch (method) {
      case "eth_accounts":
      case "eth_blockNumber":
      case "eth_chainId":
      case "eth_requestAccounts": // does https://eips.ethereum.org/EIPS/eip-1102 change anything?
      case "eth_sendTransaction":
      case "eth_swithEthereumChain":
        console.log(method, params);
        return this.forward(method, params);

      default:
        throw providerError(-32601, `Method ${method} not supported`);
    }
  }

  // forward requests to relay
  private forward(method: string, params?: unknown): Promise<unknown> {
    const id = this.requestId();
    const { promise, resolve, reject } = Promise.withResolvers();
    this.requests.set(id, [resolve, reject]);
    window.postMessage(
      {
        host: window.location.host,
        origin: window.location.origin,
        source: "provider",
        type: "cordial:request",
        id,
        method,
        params,
      },
      "*",
    );
    return promise;
  }

  // forward responses from relay ("backwards" from point of view of app)
  private backward(event: MessageEvent) {
    const data = event.data;
    const request = this.requests.get(data.id);
    if (!request) return;
    this.requests.delete(data.id);
    const [resolve, reject] = request;
    if (data.error) {
      reject(providerError(-32603, String(data.error)));
    } else {
      resolve(data.result);
    }
  }

  private requestId(): RequestId {
    // TODO: use a nonce
    return [this.instanceId, this.requestCounter++];
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
  }
}

// export const ETHEREUM = new Ethereum();

interface Provider {
  request(args: Request): Promise<unknown>;
}

interface Request {
  method: string;
  params?: unknown[] | object;
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

export default defineUnlistedScript(() => {});
