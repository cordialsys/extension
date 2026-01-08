import { ProviderRequest, Response } from "./types";

export function fromProvider(event: MessageEvent<ProviderRequest>) {
  // checks
  if (event.source !== window) return;
  const request = event.data;
  if (!request || request.kind !== "cordial:provider:request") return;

  // relay
  console.log("  provider 👉 relay ::", request);
  browser.runtime.sendMessage(request, fromExtension);
}

function fromExtension(response: Response) {
  console.log("    relay 👈 extension ::", response);

  // checks
  if (!response || response.kind !== "cordial:extension:response") return;

  // relay
  window.postMessage(response);
}
