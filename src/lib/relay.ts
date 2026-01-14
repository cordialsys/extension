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
import { Nonce, Params, Provider, Request, Response } from "./types";

// Map object keys are compared by reference (object identity), not value
// Currently, Nonce is the primitive type string so it works.
type Resolver = (value: unknown) => void;
type Rejecter = (reason?: unknown) => void;
export type Promises = Map<Nonce, [Resolver, Rejecter]>;

const PROMISES: Promises = new Map();

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
  PROMISES.set(id, [resolve, reject]);
  console.log(`❓ ${provider} :: ${id} :: ${method} ::`, params);
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

  // relay
  console.log("  provider 👉 relay ::", request);
  const requestJson: string = superjson.stringify(request);
  browser.runtime.sendMessage(requestJson, relayResponse);
}

function relayResponse(responseJson: string) {
  const response: Response = superjson.parse(responseJson);
  console.log("    relay 👈 extension ::", response);

  // checks
  if (!response || response.kind !== "cordial:extension:response") return;

  // relay
  window.postMessage(response);
}

export function response(event: MessageEvent<Response>) {
  const response: Response = event.data;
  if (response.kind !== "cordial:extension:response") return;
  const header = response.header;
  const id = header.id;
  const provider = header.provider;

  console.log("  provider 👈 relay ::", response);
  const request = PROMISES.get(id);
  if (!request) {
    console.error("No such request for", id);
    return;
  }
  PROMISES.delete(id);
  const [resolve, reject] = request;
  const result = response.result;
  const log = `✍ ${provider} :: ${id} :: ${response.method} ::`;
  if (result.ok) {
    console.log(log, result.value);
    resolve(result.value);
  } else {
    console.error(log, result.error);
    reject(result.error);
  }
}
