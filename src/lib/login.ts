import { hex } from "@scure/base";
import {
  cryptoBoxKeyPair,
  cryptoBoxOpenEasy,
} from "@serenity-kit/noble-sodium";
import { Temporal } from "temporal-polyfill";
// TODO: Consider just keeping the login in memory.
// This would remove any kind of storage requirements,
// and the login should be retained as long as the browser is open.
import { get, set } from "idb-keyval";
import { COLOR, GRAY, LOGIN_REFRESH } from "./constants";
import { sleep } from "./util";
import { None, Option } from "./types";

const LOGIN_POLL_SLEEP_MS = 1_000;
const LOGIN_POLL_MAX_ATTEMPTS = 180;

let loginFlowCounter = 0;

function redactRequest(requestHex: string): string {
  if (requestHex.length <= 16) return requestHex;
  return `${requestHex.slice(0, 8)}...${requestHex.slice(-8)}`;
}

function loginDebug(event: string, details: Record<string, unknown> = {}) {
  console.info("[cordial-extension:login]", event, {
    ...details,
  });
}

async function fetchWithCookies(url: string): Promise<Response> {
  return await fetch(url, {
    credentials: "include",
  });
}

async function initiateLoginFlow(
  identity: Identity,
  request: Request,
): Promise<Response> {
  const key = `ed25519.${identity.publicHex}`;
  return await fetchWithCookies(
    `https://auth.cordial.systems/login/flow?key=${key}&request=${request.publicHex}`,
  );
}

async function closeLoginTab(tabId: number, flowId: number) {
  await browser.tabs
    .remove(tabId)
    .then(() => {
      loginDebug("Login.new:closed-login-tab", { flowId, tabId });
    })
    .catch((error) => {
      loginDebug("Login.new:close-login-tab-failed", {
        flowId,
        tabId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

async function refreshOpenSidePanels(flowId: number) {
  await browser.runtime
    .sendMessage({ kind: "cordial:sidepanel:login-complete" })
    .then(() => {
      loginDebug("Login.new:refreshed-sidepanels", { flowId });
    })
    .catch((error) => {
      loginDebug("Login.new:refresh-sidepanels-failed", {
        flowId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

export interface Identity {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicHex: string;
}

export interface Login {
  userId: string;
  identity: Identity;
  certificate: string;
  expires: number;
}

export const Identity = {
  async new(options?: { refresh?: boolean }): Promise<Identity> {
    let ed255: Option<CryptoKeyPair> = await get("identity");
    if (!ed255 || options?.refresh) {
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
  },
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

export const Request = {
  new(): Request {
    const x255 = cryptoBoxKeyPair();
    const publicHex = hex.encode(x255.publicKey);
    return {
      publicHex,
      open: (boxed: Boxed) =>
        new TextDecoder().decode(
          cryptoBoxOpenEasy({
            ciphertext: new Uint8Array(boxed.cipher),
            nonce: new Uint8Array(boxed.nonce),
            publicKey: new Uint8Array(boxed.public_key),
            privateKey: x255.privateKey,
          }),
        ),
    };
  },
};

export async function showOff() {
  console.log("🥺 Turning off");
  await browser.action.setIcon({ path: GRAY });
}

export async function showOn() {
  console.log("🤩 Turning on");
  await browser.action.setIcon({ path: COLOR });
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

export async function loginFirstName(login: Login): Promise<string> {
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

export const Login = {
  async init() {
    // Check if we're logged in
    // The default icon set is colorful otherwise it looks bad in webstore etc.
    const login = await Login.load();
    if (!login) return await showOff();

    // stay logged in (once triggered by click on extension icon)
    Login.track();
  },

  // TODO: Would be pretty cool to set extension icon to "rotating"
  // while logging in. This can be done with timers: https://stackoverflow.com/a/44082232
  async login() {
    loginDebug("Login.login:start");
    const login = await Login.new();
    await set("login", login);

    // set extension to active
    await showOn();

    // The rest is just fooling around.
    const url = `https://admin.cordialapis.com/v1/users/${login.userId}`;
    const response = await fetch(url);
    const firstName = ((await response.json()) as { first_name: string })
      .first_name;
    console.log(`👋 Hello, ${firstName}!`);

    // refresh every five minutes
    setTimeout(Login.track, LOGIN_REFRESH);
  },

  async logout() {
    await set("login", None);
    await showOff();
  },

  async new(): Promise<Login> {
    const flowId = ++loginFlowCounter;
    loginDebug("Login.new:start", { flowId });
    const prevLogin = await Login.load();
    if (prevLogin) {
      loginDebug("Login.new:existing-login", {
        flowId,
        userId: prevLogin.userId,
        expires: prevLogin.expires,
      });
      return prevLogin;
    }
    //1. prepare request and identity keys
    const identity = await Identity.new();
    const key = `ed25519.${identity.publicHex}`;
    // console.log("key", key);

    const request = Request.new();
    const requestHex = request.publicHex;
    loginDebug("Login.new:request-created", {
      flowId,
      request: redactRequest(requestHex),
    });
    // console.log("request", requestHex);

    // 2. have the user login
    const url = `https://auth.cordial.systems/login/flow?key=${key}&request=${requestHex}`;
    let loginTabCreated: Promise<Option<number>> = Promise.resolve(None);
    if (!(await clerkLoggedIn())) {
      loginDebug("Login.new:opening-login-tab", {
        flowId,
        request: redactRequest(requestHex),
      });
      // console.log("opening tab");
      loginTabCreated = browser.tabs
        .create({ url })
        .then((tab) => {
          loginDebug("Login.new:opened-login-tab", {
            flowId,
            tabId: tab.id,
            request: redactRequest(requestHex),
          });
          return tab.id;
        })
        .catch((error) => {
          loginDebug("Login.new:open-login-tab-failed", {
            flowId,
            request: redactRequest(requestHex),
            error: error instanceof Error ? error.message : String(error),
          });
          return None;
        });
    } else {
      loginDebug("Login.new:silent-login-flow", {
        flowId,
        request: redactRequest(requestHex),
      });
      // console.log("not opening tab");
      await initiateLoginFlow(identity, request);
    }

    const login = await completeLogin(identity, request, {
      flowId,
      source: "new",
    });
    const loginTabId = await loginTabCreated;
    if (loginTabId !== undefined) {
      await closeLoginTab(loginTabId, flowId);
    }
    await refreshOpenSidePanels(flowId);

    return login;
  },

  async load(): Promise<Option<Login>> {
    // 1. verify logged in to Clerk
    if (!(await clerkLoggedIn())) return None;

    // 2. verify logged in to Cordial SaaS
    // Note we cannot read it directly.
    const url = "https://admin.cordialapis.com/v1/users/me";
    const response = await fetch(url);
    if (!response.ok) {
      console.log("could not get /v1/users/me");
      return None;
    }

    // 3. load it from DB
    const login = await get("login");
    if (!login) return login;

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
      ) !== 1
    ) {
      console.warn("certificate expired");
      return None;
    }

    // TODO: Verify login is valid
    // - do a call to admin API to check if cookie is good
    // - decode certificate to see if it's still valid for > X minutes
    return login;
  },

  // TODO: Only refresh if we're somewhat close to expiry of cookie or certificate
  async track(): Promise<Option<Login>> {
    const flowId = ++loginFlowCounter;
    loginDebug("Login.track:start", { flowId });
    if (!(await Login.load())) {
      loginDebug("Login.track:no-login", { flowId });
      setTimeout(Login.track, LOGIN_REFRESH);
      return;
    }

    if (!(await clerkLoggedIn())) {
      // can't refresh silently
      loginDebug("Login.track:not-clerk-logged-in", { flowId });
      await showOff();
      setTimeout(Login.track, LOGIN_REFRESH);
      return;
    }

    // console.log("refreshing login");
    const identity = await Identity.new({ refresh: true });
    const request = Request.new();
    const requestHex = request.publicHex;
    loginDebug("Login.track:request-created", {
      flowId,
      request: redactRequest(requestHex),
    });

    await initiateLoginFlow(identity, request);
    const login = await completeLogin(identity, request, {
      flowId,
      source: "track",
    });
    await set("login", login);
    setTimeout(Login.track, LOGIN_REFRESH);
    return login;
  },
};

async function completeLogin(
  identity: Identity,
  request: Request,
  debugContext: { flowId: number; source: string },
): Promise<Login> {
  // 3.1 fetch boxed access token
  let url = `https://auth.cordial.systems/login/get-access?request=${request.publicHex}`;
  let boxed: Boxed;
  let accessAttempts = 0;
  let retriedAfterExternalLogin = false;
  while (true) {
    accessAttempts += 1;
    loginDebug("completeLogin:get-access:attempt", {
      flowId: debugContext.flowId,
      source: debugContext.source,
      attempt: accessAttempts,
      request: redactRequest(request.publicHex),
    });
    const response = await fetchWithCookies(url);
    loginDebug("completeLogin:get-access:response", {
      flowId: debugContext.flowId,
      source: debugContext.source,
      attempt: accessAttempts,
      request: redactRequest(request.publicHex),
      status: response.status,
      ok: response.ok,
    });
    if (!response.ok) {
      if (
        response.status === 404 &&
        !retriedAfterExternalLogin &&
        (await clerkLoggedIn())
      ) {
        retriedAfterExternalLogin = true;
        loginDebug("completeLogin:get-access:retry-after-external-login", {
          flowId: debugContext.flowId,
          source: debugContext.source,
          attempt: accessAttempts,
          request: redactRequest(request.publicHex),
        });
        await initiateLoginFlow(identity, request);
      }

      if (accessAttempts >= LOGIN_POLL_MAX_ATTEMPTS) {
        throw new Error(
          `Timed out waiting for auth access token after ${accessAttempts} attempts; last status ${response.status}`,
        );
      }
      await sleep(LOGIN_POLL_SLEEP_MS);
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
  let certificateAttempts = 0;
  while (true) {
    certificateAttempts += 1;
    loginDebug("completeLogin:get-certificate:attempt", {
      flowId: debugContext.flowId,
      source: debugContext.source,
      attempt: certificateAttempts,
      request: redactRequest(request.publicHex),
    });
    const response = await fetchWithCookies(url);
    loginDebug("completeLogin:get-certificate:response", {
      flowId: debugContext.flowId,
      source: debugContext.source,
      attempt: certificateAttempts,
      request: redactRequest(request.publicHex),
      status: response.status,
      ok: response.ok,
    });
    if (!response.ok) {
      if (certificateAttempts >= LOGIN_POLL_MAX_ATTEMPTS) {
        throw new Error(
          `Timed out waiting for auth certificate after ${certificateAttempts} attempts; last status ${response.status}`,
        );
      }
      await sleep(LOGIN_POLL_SLEEP_MS);
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
  /*const response =*/ await fetchWithCookies(url);
  loginDebug("completeLogin:success", {
    flowId: debugContext.flowId,
    source: debugContext.source,
    userId,
    expires: expires.epochMilliseconds,
    accessAttempts,
    certificateAttempts,
  });
  // console.log(response);

  // all done, return
  return {
    userId,
    identity,
    certificate,
    expires: expires.epochMilliseconds,
  };
}
