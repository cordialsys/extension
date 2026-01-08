/*
- provider sends a `Request` with the `request` function, returning a promise
- relayRequest forwards it to extension
- relayResponse forwards extension's response
- `response` function resolves the promise

While this messaging path returns a Result inside the Response,
the final resolution requires handling the exceptions that
are thrown when rejecting the promise
*/

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
  console.log(`👉 ${provider} request :: ${id} :: ${method} ::`, params);
  window.postMessage(request, "*");
  return promise;
}

export function relayRequest(event: MessageEvent<Request>) {
  // checks
  if (event.source !== window) return;
  const request: Request = event.data;
  if (!request || request.kind !== "cordial:provider:request") return;

  // relay
  // console.log("  provider 👉 relay ::", request);
  browser.runtime.sendMessage(request, relayResponse);
}

function relayResponse(response: Response) {
  // console.log("    relay 👈 extension ::", response);

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

  // console.log("  provider 👈 relay ::", response);
  const request = PROMISES.get(id);
  if (!request) {
    console.error("No such request for", id);
    return;
  }
  PROMISES.delete(id);
  const [resolve, reject] = request;
  const result = response.result;
  if (result.ok) {
    console.log(`👈 ${provider} response :: ${id} ::`, result.value);
    resolve(result.value);
  } else {
    console.error(`👈 ${provider} response :: ${id} ::`, result.error);
    reject(result.error);
  }
}
