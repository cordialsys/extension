// Copyright 2025 Cordial Systems, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import { COLOR } from "@/lib/constants";
import { onClicked } from "@/lib/click";
import { Config } from "@/lib/config";
import { Login, /*loginFirstName,*/ showOff } from "@/lib/login";
import { onMessage, Port } from "@/lib/handler";

// figure out what state we're in, and ensure the keys
// - on
// - login
// - ...
// are setup
async function init() {
  // start tracking config (whether or not we're logged in)
  await Config.init();
  Config.track();

  // check if we're logged in
  const login = await Login.load();
  if (!login) return await showOff();

  // stay logged in (once triggered by click on extension icon)
  setTimeout(Login.track, 5 * 1000);

  // const firstName = await loginFirstName(login);
  // console.log(`👋 Welcome back, ${firstName}`);

  await browser.action.setIcon({ path: COLOR });
}

async function background() {
  browser.runtime.onConnect.addListener(Port.set);
  await init();
  browser.action.onClicked.addListener(onClicked);
  browser.runtime.onMessage.addListener(onMessage);
}

export default defineBackground(() => {
  console.log("♥️ Running the Cordial Extension", browser.runtime.id);

  setTimeout(background, 0);
});
