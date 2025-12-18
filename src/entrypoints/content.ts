// Copyright 2025 Cordial Systems, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// const MESSAGE_TYPE_REQUEST = "cordial:request";
// const MESSAGE_TYPE_RESPONSE = "cordial:response";
// const MESSAGE_TYPE_ANNOUNCE = "cordial:announce";

// The goal of this content script (added do every page)
// is to act as a relay between the provider and the extension.
export default defineContentScript({
  matches: ["*://*/*"],
  // async main(ctx) {
  async main() {
    console.log("♥️ Running the Cordial Relay");

    await injectScript("/provider.js", {
      keepInDom: true,
    });
    console.log("💉 Injected Cordial provider.js");

    // provider-initiated communication: provider -> us -> extension (with response)
    window.addEventListener("message", (event) => {
      // checks
      if (event.source !== window) return;
      const request = event.data;
      if (!request || request.type !== "cordial:request") return;

      // relay
      console.log("provider 👉 relay ::", request);
      browser.runtime.sendMessage(request, (response) => {
        // checks
        if (!response || response.type !== "cordial:response") return;

        // relay
        console.log("provider 👈 relay ::", response);
        window.postMessage(
          {
            source: "extension",
            type: "cordial:response",
            id: response.id,
            result: response.result,
            error: response.error,
            host: window.location.host,
          },
          "*",
        );
      });
    });

    // extension-initiated communication: provider <- us <- extension
    browser.runtime.onMessage.addListener((announce, sender, respond) => {
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
    });
  },
});
