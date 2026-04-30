/*
- provider sends a `Request` with the `request` function, returning a promise
- relayRequest forwards it to extension
- relayResponse forwards extension's response
- `response` function resolves the promise

While this messaging path returns a Result inside the Response,
the final resolution requires handling the exceptions that
are thrown when rejecting the promise
*/

import superjson from "superjson";
import { Debug } from "./debug";
import {
  Broadcast,
  Configurator,
  Eth,
  Nonce,
  None,
  Option,
  Params,
  Provider,
  Request,
  Response,
  Sol,
} from "./types";

// Map object keys are compared by reference (object identity), not value
// Currently, Nonce is the primitive type string so it works.
type Resolver = (value: unknown) => void;
type Rejecter = (reason?: unknown) => void;

interface PendingRequest {
  id: Nonce;
  method: string;
  provider: Provider;
  reject: Rejecter;
  resolve: Resolver;
  timeoutId: number;
}

export type Promises = Map<Nonce, PendingRequest>;

const PROMISES: Promises = new Map();
const HEARTBEAT_INTERVAL = 5_000;
const HEARTBEAT_RETRY = 1_000;
const REQUEST_TIMEOUT = 5 * 60_000;
let HEARTBEAT_STARTED = false;

let CONFIGURATOR: Option<Configurator> = None;

// function pendingLabel(pending: PendingRequest): string {
//   return `${pending.provider} :: ${pending.id} :: ${pending.method}`;
// }

function requestLabel(request: Request): string {
  return `${request.header.provider} :: ${request.header.id} :: ${request.method}`;
}

function rejectPending(id: Nonce, reason: unknown) {
  const pending = PROMISES.get(id);
  if (!pending) return;

  PROMISES.delete(id);
  clearTimeout(pending.timeoutId);

  Debug.record("provider", "request-rejected-local", {
    id,
    method: pending.method,
    provider: pending.provider,
    reason: reason instanceof Error ? reason.message : String(reason),
  });
  // console.error(
  //   `Rejecting pending request ${pendingLabel(pending)} ::`,
  //   reason,
  // );
  pending.reject(reason);
}

async function sendToExtension(request: Request) {
  const requestJson: string = superjson.stringify(request ?? null);
  Debug.record("content", "runtime-message-send", {
    id: request.header.id,
    method: request.method,
    provider: request.header.provider,
  });
  return browser.runtime
    .sendMessage(requestJson)
    .then((responseJson) => relayResponse(responseJson))
    .catch((error) => {
      Debug.record("content", "runtime-message-failed", {
        error: error instanceof Error ? error.message : String(error),
        id: request.header.id,
        method: request.method,
        provider: request.header.provider,
      });
      console.error(
        `Extension message failed for ${requestLabel(request)}:`,
        error,
      );
      rejectPending(request.header.id, error);
    });
}

async function heartbeatLoop() {
  try {
    await cordialRequest("cordial:ping");
    setTimeout(heartbeatLoop, HEARTBEAT_INTERVAL);
  } catch (error) {
    console.error("Heartbeat failed:", error);
    setTimeout(heartbeatLoop, HEARTBEAT_RETRY);
  }
}

export const Relay = {
  init(configurator: Configurator) {
    CONFIGURATOR = configurator;
  },

  heartbeat() {
    if (HEARTBEAT_STARTED) return;
    HEARTBEAT_STARTED = true;
    void heartbeatLoop();
  },

  logout(): Promise<unknown> {
    return cordialRequest("cordial:logout");
  },

  ping(): Promise<unknown> {
    return cordialRequest("cordial:ping");
  },
};

export function cordialRequest(
  method: string,
  params?: Params,
): Promise<unknown> {
  return request("cordial", method, params);
}

export function ethRequest(method: string, params?: Params): Promise<unknown> {
  return request("ETH", method, params);
}

export function solRequest(method: string, params?: Params): Promise<unknown> {
  return request("SOL", method, params);
}

// TODO: We could tighten the response from unknown
// via generics, that tie it to the (provider, method) pair.
export function request(
  provider: Provider,
  method: string,
  params?: Params,
): Promise<unknown> {
  const { promise, resolve, reject } = Promise.withResolvers();
  const request = Request.new(provider, method, params);
  const id = request.header.id;
  const timeoutId = window.setTimeout(() => {
    Debug.record("provider", "request-timeout", {
      id,
      method,
      provider,
      timeoutMs: REQUEST_TIMEOUT,
    });
    rejectPending(id, new Error(`Request timed out: ${provider} ${method}`));
  }, REQUEST_TIMEOUT);
  PROMISES.set(id, { id, provider, method, resolve, reject, timeoutId });
  Debug.record("provider", "request-created", {
    id,
    method,
    provider,
    timeoutMs: REQUEST_TIMEOUT,
  });
  const log = `▶️ ${provider} :: ${id} :: ${method}`;
  // console.log(`❓ ${provider} :: ${id} :: ${method} ::`, params);
  if (params) {
    console.log(`${log} ::`, params);
  } else {
    console.log(log);
  }

  window.postMessage(request, "*");
  return promise;
}

// It is crucial to stringify the requests and responses ourselves
// when crossing the extension messaging boundary.
//
// The default transport uses JSON.stringify, which messes up types,
// for instance Uint8Array turns into {0: x, 1: y,.. } etc.
//
// This `superjson` library instead adds type hints, to ensure
// proper deserialization.
//
// https://github.com/mozilla/webextension-polyfill/issues/643
// https://issues.chromium.org/issues/40321352

export function relayRequest(event: MessageEvent<Request>) {
  // checks
  if (event.source !== window) return;
  const request: Request = event.data;
  if (!request || request.kind !== "cordial:provider:request") return;

  // console.log("  provider 👉 relay ::", request);
  void sendToExtension(request);
}

function relayResponse(responseJson: Option<string>) {
  if (!responseJson) {
    Debug.record("content", "runtime-message-empty-response");
    // console.error("Empty extension response");
    return;
  }

  try {
    const response: Response = superjson.parse(responseJson ?? null);
    // console.log("    relay 👈 extension ::", response);

    // checks
    if (!response || response.kind !== "cordial:extension:response") {
      Debug.record("content", "runtime-message-invalid-response");
      // console.error("Invalid extension response", response);
      return;
    }

    // relay
    Debug.record("content", "provider-response-posted", {
      id: response.header.id,
      method: response.method,
      ok: response.result.ok,
      provider: response.header.provider,
    });
    window.postMessage(response);
  } catch (error) {
    Debug.record("content", "runtime-message-parse-failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error("Failed to parse extension response:", error);
  }
}

export function message(event: MessageEvent<Broadcast | Response>) {
  const data: Broadcast | Response = event.data;
  switch (data.kind) {
    case "cordial:extension:broadcast":
      return broadcast(data);
    case "cordial:extension:response":
      return response(data);
  }
}

export function broadcast(broadcast: Broadcast) {
  // console.log("received broadcast in app", broadcast);
  if (!CONFIGURATOR || broadcast.method !== "cordial:config") return;
  const value: unknown = broadcast.value;
  switch (broadcast.provider) {
    case "ETH":
      CONFIGURATOR.eth(value as Option<Eth.Config>);
      break;
    case "SOL":
      CONFIGURATOR.sol(value as Option<Sol.Config>);
      break;
  }
}

export function response(response: Response) {
  const header = response.header;
  const id = header.id;
  const provider = header.provider;

  // console.log("  provider 👈 relay ::", response);
  const request = PROMISES.get(id);
  if (!request) {
    Debug.record("provider", "response-without-pending-request", {
      id,
      method: response.method,
      provider,
    });
    console.error("No such request for", id);
    return;
  }
  PROMISES.delete(id);
  clearTimeout(request.timeoutId);
  const result = response.result;
  // const log = `✍ ${provider} :: ${id} :: ${response.method} ::`;
  const log = `⬅️ ${provider} :: ${id} :: ${response.method} ::`;
  if (result.ok) {
    Debug.record("provider", "request-resolved", {
      id,
      method: response.method,
      provider,
    });
    console.log(log, result.value);
    request.resolve(result.value);
  } else {
    Debug.record("provider", "request-rejected", {
      error: result.error,
      id,
      method: response.method,
      provider,
    });
    console.error(log, result.error);
    if (
      typeof result.error === "object" &&
      result.error !== null &&
      "code" in result.error &&
      result.error.code === 4001
    ) {
      console.info("[cordial-extension:relay] rejecting provider request", {
        id,
        provider,
        method: response.method,
        error: result.error,
      });
    }
    request.reject(result.error);
  }
}

export function relayBroadcast(broadcastJson: string) {
  try {
    const broadcast: Broadcast = superjson.parse(broadcastJson);
    // console.log("received broadcast:", broadcast);
    window.postMessage(broadcast);
  } catch (error) {
    console.error("Failed to parse broadcast:", error);
  }
}
