// Copyright 2025 Cordial Systems, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import { get } from "idb-keyval";

import { browser_action, COLOR } from "@/lib/constants";
import { refreshConfig } from "@/lib/config";
import {
  loadLogin,
  loginFirstName,
  refreshLogin,
  turnOff,
  turnOn,
} from "@/lib/login";
import { handleRequest } from "@/lib/handler";

// host: "app.uniswap.org"
// id: (2) ['abc123', 0]
// method: "eth_requestAccounts"
// origin: "https://app.uniswap.org"
// source: "provider"
// type: "cordial:provider:request"

async function onClicked(tab: globalThis.Browser.tabs.Tab) {
  console.log(`extension icon clicked on page "${tab.title}" (${tab.url})`);

  if (!(await get("on"))) {
    await turnOn();
  } else {
    await turnOff();
  }
}

// figure out what state we're in, and ensure the keys
// - on
// - login
// - ...
// are setup
async function init() {
  await refreshConfig();
  if (!(await get("on"))) {
    // console.log("didn't get `on`");
    return await turnOff();
  }
  const login = await loadLogin();
  if (!login) {
    console.log("didn't get `login`");
    return await turnOff();
  }

  setTimeout(refreshLogin, 5 * 1000);
  const firstName = await loginFirstName(login);
  console.log(`👋 Welcome back, ${firstName}`);
  await browser_action.setIcon({ path: COLOR });
}

async function background() {
  await init();
  browser_action.onClicked.addListener(onClicked);
  browser.runtime.onMessage.addListener(handleRequest);
}

export default defineBackground(() => {
  console.log("♥️ Running the Cordial Extension", browser.runtime.id);

  setTimeout(background, 0);
});
