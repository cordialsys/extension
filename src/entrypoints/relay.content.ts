/*
 * Copyright 2025 Cordial Systems, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// const MESSAGE_TYPE_REQUEST = "cordial:request";
// const MESSAGE_TYPE_RESPONSE = "cordial:response";
// const MESSAGE_TYPE_ANNOUNCE = "cordial:announce";

// This content script relays between our providers and the extension
export default defineContentScript({
  matches: ["*://*/*"],
  main() {
    // provider-initiated communication: provider -> us -> extension (with response)
    window.addEventListener("message", forward);
    // extension-initiated communication: provider <- us <- extension
    browser.runtime.onMessage.addListener(announce);
    // notify
    console.log("♥️ Running the Cordial Relay");
  },
});

interface ProviderEventData {
  type: string;
}

interface ExtensionEvent {
  type: string;
  id: unknown;
  error?: unknown;
  result?: unknown;
}

function forward(event: MessageEvent<ProviderEventData>) {
  // console.log("👉 ::", event);
  // checks
  if (event.source !== window) return;
  const request = event.data;
  if (!request || request.type !== "cordial:provider:request") return;

  // relay
  console.log("  provider 👉 relay ::", request);
  browser.runtime.sendMessage(request, backward);
}

function backward(response: ExtensionEvent) {
  console.log("    relay 👈 extension ::", response);
  // checks
  if (!response || response.type !== "cordial:response") return;

  // relay
  window.postMessage(
    {
      source: "extension",
      type: "cordial:response",
      id: response.data.id,
      result: response.data.result,
      error: response.data.error,
      host: window.location.host,
    },
    "*",
  );
}

function announce(
  announce: ExtensionEvent,
  sender: unknown, // globalThis.Browser.runtime.MessageSender,
  respond: (response?: unknown) => void,
) {
  console.log("🤛", announce);

  // checks
  if (announce.type !== "cordial:announce") return;

  // relay and confirm
  window.postMessage(
    {
      source: "extension",
      type: "cordial:announce",
      id: announce.id,
      result: announce.result,
      error: announce.error,
      host: window.location.host,
    },
    "*",
  );
  respond({ received: true });
}
