import { hex } from "@scure/base";
import {
  cryptoBoxKeyPair,
  cryptoBoxOpenEasy,
} from "@serenity-kit/noble-sodium";
import { get, set } from "idb-keyval";
import { Temporal } from "temporal-polyfill";

export interface Identity {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicHex: string;
}

export async function showOn() {
  await browser.action.setIcon({ path: COLOR });
}

export async function showOff() {
  await browser.action.setIcon({ path: GRAY });
}

async function getOrCreateIdentity(): Identity {
  let ed255 = await get("identity");
  if (typeof ed255 == "undefined") {
    ed255 = rotateRawIdentity;
  }
  const publicExport = await crypto.subtle.exportKey("raw", ed255.publicKey);
  const publicHex = hex.encode(new Uint8Array(publicExport));
  return {
    privateKey: ed255.privateKey,
    publicKey: ed255.publicKey,
    publicHex,
  };
}

// TODO: where are the WebCrypto types?
async function rotateRawIdentity(): unknown {
  ed255 = await crypto.subtle.generateKey("Ed25519", false, ["sign", "verify"]);
  await set("identity", ed255);
  return ed255;
}

export interface Config {
  revision: string;
  api_url: string;
  treasury: string;
  addresses: string[];
}

async function fetchConfig(userId: string): Config {
  const url = `https://admin.cordialapis.com/v1/users/${userId}/extension`;
  const response = await fetch(url, { credentials: "include" });
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

function createRequest(): Request {
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
}

async function doLogin(tab): Login {
  console.log("browser action triggered,", tab);

  //1. prepare request and identity keys
  const identity = await getOrCreateIdentity();
  const key = `ed25519.${identity.publicHex}`;
  console.log("key", key);

  const x255 = createRequest();
  const request = x255.publicHex;
  console.log("request", request);

  // 2. have the user login
  let url = `https://auth.cordial.systems/login/flow?key=${key}&request=${request}`;
  browser.tabs.create({ url });

  // 3.1 fetch boxed access token
  url = `https://auth.cordial.systems/login/get-access?request=${request}`;
  let boxed;
  while (true) {
    const response = await fetch(url);
    if (!response.ok) {
      await setTimeout(() => {}, 1000);
      continue;
    }
    boxed = (await response.json()) as Boxed;
    break;
  }
  console.log("boxed:", boxed);

  // 3.2 decrypt access token
  const access_token = x255.open(boxed);
  console.log("access-token", access_token);

  // 3.3 extract user ID
  const jwt = parseJwt(access_token) as { exp: number; sub: string };
  const userId = jwt.sub.replace("user_", "");
  console.log("userId", userId);
  const expires = Temporal.Instant.fromEpochMilliseconds(jwt.exp * 1_000);
  console.log("expires", expires.toLocaleString());

  // 4.1 fetch boxed certificate
  url = `https://auth.cordial.systems/login/get-certificate?request=${request}`;
  while (true) {
    const response = await fetch(url);
    if (!response.ok) {
      await setTimeout(() => {}, 1000);
      continue;
    }
    boxed = (await response.json()) as Boxed;
    break;
  }
  console.log("boxed:", boxed);

  // 4.2 decrypt certificate
  const certificate = x255.open(boxed);
  console.log("certificate", certificate);

  // 5. set cookie
  url = `https://auth.cordialapis.com/login/set-cookie?access_token=${access_token}`;
  const response = await fetch(url, { credentials: "include" });
  console.log(response);

  // all done, return
  return {
    userId,
    identity,
    certificate,
  };
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

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });

  (browser.action ?? browser.browserAction).onClicked.addListener(
    async (tab) => {
      const login = await doLogin();
      console.log("login", login);

      // set extension to active
      await showOn();

      let url = "https://admin.cordialapis.com/v1/users";
      let response = await fetch(url, { credentials: "include" });
      const users = await response.text();
      console.log("users", users);

      url = `https://admin.cordialapis.com/v1/users/${login.userId}`;
      response = await fetch(url, { credentials: "include" });
      const user = await response.text();
      console.log("user", user);

      const config = await fetchConfig(login.userId);
      console.log("config", config);

      // if (tab.id) {
      //   await browser.tabs.sendMessage(tab.id, { type: "MOUNT_UI" });
      // }
    },
  );
});
