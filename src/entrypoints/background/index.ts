// Copyright 2025 Cordial Systems, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import { hex } from "@scure/base";
import {
  cryptoBoxKeyPair,
  cryptoBoxOpenEasy,
} from "@serenity-kit/noble-sodium";
import { /*del,*/ get, set } from "idb-keyval";
import { Temporal } from "temporal-polyfill";

// TODO: use fetchTimeout, see https://dmitripavlutin.com/timeout-fetch-request/

// TODO: Should this depend on how long we're still logged into Clerk?
// 15 minutes
const LOGIN_REFRESH: number = 15 * 60 * 1000;
// TODO: Replace with long-polling for immediate updates
// 5 seconds
const CONFIG_REFRESH: number = 5 * 1000;

export interface Identity {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicHex: string;
}

async function getOrCreateIdentity(): Promise<Identity> {
  return await flexIdentity(false);
}

async function newIdentity(): Promise<Identity> {
  return await flexIdentity(true);
}

async function flexIdentity(alwaysNew: boolean): Promise<Identity> {
  let ed255: CryptoKeyPair | undefined = await get("identity");
  if (!ed255 || alwaysNew) {
    ed255 = await crypto.subtle.generateKey("Ed25519", false, [
      "sign",
      "verify",
    ]);
    await set("identity", ed255);
  }
  // console.log(ed255);
  const publicExport = await crypto.subtle.exportKey("raw", ed255.publicKey);
  const publicHex = hex.encode(new Uint8Array(publicExport));
  return {
    privateKey: ed255.privateKey,
    publicKey: ed255.publicKey,
    publicHex,
  };
}

export interface Config {
  revision: string;
  api_url: string;
  treasury: string;
  addresses: string[];
}

async function fetchConfig(userId: string): Promise<Config> {
  const url = `https://admin.cordialapis.com/v1/users/${userId}/extension`;
  const response = await fetch(url);
  return (await response.json()) as Config;
}

export const GRAY = {
  16: "/icons/gray/16.png",
  24: "/icons/gray/24.png",
  48: "/icons/gray/48.png",
  128: "/icons/gray/128.png",
};

export const COLOR = {
  16: "/icons/16.png",
  24: "/icons/24.png",
  48: "/icons/48.png",
  128: "/icons/128.png",
};

interface Boxed {
  public_key: number[];
  nonce: number[];
  cipher: number[];
}

interface Request {
  publicHex: string;
  open(boxed: Boxed): string;
}

function newRequest(): Request {
  const x255 = cryptoBoxKeyPair();
  const publicHex = hex.encode(x255.publicKey);
  return {
    publicHex,
    open: function (boxed: Boxed) {
      return new TextDecoder().decode(
        cryptoBoxOpenEasy({
          ciphertext: new Uint8Array(boxed.cipher),
          nonce: new Uint8Array(boxed.nonce),
          publicKey: new Uint8Array(boxed.public_key),
          privateKey: x255.privateKey,
        }),
      );
    },
  };
}

interface Login {
  userId: string;
  identity: Identity;
  certificate: string;
  expires: number;
}

async function loginFirstName(login: Login): Promise<string> {
  const url = `https://admin.cordialapis.com/v1/users/${login.userId}`;
  const response = await fetch(url);
  const firstName = ((await response.json()) as { first_name: string })
    .first_name;
  return firstName;
}

async function clerkLoggedIn(): Promise<boolean> {
  // response to `/v1/client` is nested under `response` keys
  interface ClerkClientResponse {
    response: ClerkSessions;
  }

  // inside the response, we are interested if the `sessions` array is non-empty
  interface ClerkSessions {
    sessions: unknown[];
  }

  const url = "https://clerk.cordial.systems/v1/client";
  const response = await fetch(url);
  if (!response.ok) {
    return false;
  }
  const json = (await response.json()) as ClerkClientResponse;
  const loggedIn = json.response.sessions.length > 0;
  // console.log("💯", loggedIn);
  return loggedIn;
}

async function loadLogin(): Promise<Login | undefined> {
  // 1. verify logged in to Clerk
  if (!(await clerkLoggedIn())) {
    return undefined;
  }

  // 2. verify logged in to Cordial SaaS
  // Note we cannot read it directly.
  const url = "https://admin.cordialapis.com/v1/users/me";
  const response = await fetch(url);
  if (!response.ok) {
    console.log("could not get /v1/users/me");
    return undefined;
  }

  // 3. load it from DB
  const login = await get("login");
  if (!login) {
    return undefined;
  }

  // 4. verify it is still valid for 10 more minutes
  // console.log("certificate", login.certificate);
  // const jwt = parseJwt(login.certificate) as { exp: number; sub: string };
  // console.log("certificate jwt", jwt);
  const now = Temporal.Now.instant();
  // console.log("loaded login", login);
  const expires = Temporal.Instant.fromEpochMilliseconds(login.expires);
  if (
    Temporal.Duration.compare(
      now.until(expires),
      Temporal.Duration.from({ minutes: 10 }),
    ) != 1
  ) {
    console.warn("certificate expired");
    return undefined;
  }

  // TODO: Verify login is valid
  // - do a call to admin API to check if cookie is good
  // - decode certificate to see if it's still valid for > X minutes
  return login;
}

async function completeLogin(
  identity: Identity,
  request: Request,
): Promise<Login> {
  // 3.1 fetch boxed access token
  let url = `https://auth.cordial.systems/login/get-access?request=${request.publicHex}`;
  let boxed;
  while (true) {
    const response = await fetch(url);
    if (!response.ok) {
      await setTimeout(() => {}, 100);
      continue;
    }
    boxed = (await response.json()) as Boxed;
    break;
  }
  // console.log("boxed:", boxed);

  // 3.2 decrypt access token
  const access_token = request.open(boxed);
  // console.log("access-token", access_token);

  // 3.3 extract user ID
  const jwt = parseJwt(access_token) as { exp: number; sub: string };
  const userId = jwt.sub.replace("user_", "");
  // console.log("userId", userId);
  const expires = Temporal.Instant.fromEpochMilliseconds(jwt.exp * 1_000);
  // console.log("expires", expires.toLocaleString());

  // 4.1 fetch boxed certificate
  url = `https://auth.cordial.systems/login/get-certificate?request=${request.publicHex}`;
  while (true) {
    const response = await fetch(url);
    if (!response.ok) {
      await setTimeout(() => {}, 100);
      continue;
    }
    boxed = (await response.json()) as Boxed;
    break;
  }
  // console.log("boxed:", boxed);

  // 4.2 decrypt certificate
  const certificate = request.open(boxed);
  // console.log("certificate", certificate);

  // 5. set cookie
  url = `https://auth.cordialapis.com/login/set-cookie?access_token=${access_token}`;
  /*const response =*/ await fetch(url);
  // console.log(response);

  // all done, return
  return {
    userId,
    identity,
    certificate,
    expires: expires.epochMilliseconds,
  };
}

//async function turnOn
async function newLogin(): Promise<Login> {
  const prevLogin = await loadLogin();
  if (prevLogin) {
    // console.log("reusing previous login");
    return prevLogin;
  }
  //1. prepare request and identity keys
  const identity = await getOrCreateIdentity();
  const key = `ed25519.${identity.publicHex}`;
  // console.log("key", key);

  const request = newRequest();
  const requestHex = request.publicHex;
  // console.log("request", requestHex);

  // 2. have the user login
  const url = `https://auth.cordial.systems/login/flow?key=${key}&request=${requestHex}`;
  if (!(await clerkLoggedIn())) {
    // console.log("opening tab");
    browser.tabs.create({ url });
  } else {
    // console.log("not opening tab");
    await fetch(url);
  }

  return await completeLogin(identity, request);
}

// TODO: Only refresh if we're somewhat close to expiry of cookie or certificate
async function refreshLogin(): Promise<Login | undefined> {
  if (!(await get("on"))) {
    setTimeout(refreshLogin, LOGIN_REFRESH);
    return;
  }
  if (!(await clerkLoggedIn())) {
    // can't refresh silently
    await turnOff();
    setTimeout(refreshLogin, LOGIN_REFRESH);
    return;
  }

  // console.log("refreshing login");
  const identity = await newIdentity();
  const key = `ed25519.${identity.publicHex}`;
  const request = newRequest();
  const requestHex = request.publicHex;

  const url = `https://auth.cordial.systems/login/flow?key=${key}&request=${requestHex}`;
  await fetch(url);
  const login = await completeLogin(identity, request);
  await set("login", login);
  setTimeout(refreshLogin, LOGIN_REFRESH);
  return login;
}

async function refreshConfig() {
  const login = await loadLogin();
  const on = await get("on");
  if (!on || !login) {
    setTimeout(refreshConfig, CONFIG_REFRESH);
    return;
  }
  // console.log("refreshing config");
  const config = await fetchConfig(login.userId);
  await set("config", config);
  // console.log("config", config);
  setTimeout(refreshConfig, CONFIG_REFRESH);
}

function parseJwt(jwt: string): unknown {
  const parts = jwt.split(".");
  if (parts.length !== 3 || !parts[1]) {
    throw new Error("Invalid JWT format");
  }
  const payload = parts[1];
  const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(decoded);
}

async function onMessage(
  request: unknown,
  sender: globalThis.Browser.runtime.MessageSender,
  respond: (response?: unknown) => void,
) {
  console.log("relay 👉 extension ::", request);
  try {
    // TODO: Actually handle it
    respond({ ok: true, result: "message received" });
  } catch (e) {
    console.error("background error", e);
    try {
      respond({ ok: false, error: String(e) });
    } catch (e) {
      console.error("background error sendResponse error", e);
    }
  }
}

async function turnOff() {
  console.log("🥺 Turning off");
  await set("on", false);
  // await del("login");
  await browser.action.setIcon({ path: GRAY });
}

// TODO: Would be pretty cool to set extension icon to "rotating"
// while logging in. This can be done with timers: https://stackoverflow.com/a/44082232
async function turnOn() {
  console.log("🤩 Turning on");
  const login = await newLogin();
  await set("login", login);

  // set extension to active
  await set("on", true);
  await browser.action.setIcon({ path: COLOR });

  // // The rest is just fooling around.
  // let url = "https://admin.cordialapis.com/v1/users";
  // let response = await fetch(url);
  // const users = await response.text();
  // console.log("users", users);
  //
  const url = `https://admin.cordialapis.com/v1/users/${login.userId}`;
  const response = await fetch(url);
  const firstName = ((await response.json()) as { first_name: string })
    .first_name;
  console.log(`👋 Hello, ${firstName}, extension is active!`);

  // refresh every five minutes
  setTimeout(refreshLogin, LOGIN_REFRESH);
}

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
  await browser.action.setIcon({ path: COLOR });
}

async function background() {
  await init();
  (browser.action ?? browser.browserAction).onClicked.addListener(onClicked);
  browser.runtime.onMessage.addListener(onMessage);
}

export default defineBackground(() => {
  console.log("♥️ Running the Cordial Extension", browser.runtime.id);

  setTimeout(background, 0);
});
