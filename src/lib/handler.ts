import { Config } from "./config";
import { Login } from "./login";
import { Error, Result } from "./sdk";
import { Broadcast, Err, None, Ok, Option, Request, Response } from "./types";

import * as evm from "./handler/evm";
import * as svm from "./handler/svm";
export { evm, svm };

import superjson from "superjson";

const MAINNET_ONLY: boolean = !!(import.meta.env.VITE_MAINNET_ONLY ?? false);
if (MAINNET_ONLY) console.log("mainnet only");

type MessageSender = globalThis.Browser.runtime.MessageSender;
type Port = globalThis.Browser.runtime.Port;

const PORTS: Port[] = [];

export const Port = {
  set(port: Port) {
    // 1. Validate and store port
    const sender = port.sender;
    const maybeId = sender?.tab?.id;
    if (sender === None || sender.tab === None || maybeId === None) {
      return;
    }
    const id: number = maybeId;
    const url: Option<string> = sender.tab.url;
    console.log("Connecting tab", id, "running", url);
    PORTS[id] = port;

    // 2. Initialize provider if allowed
    if (!allowed(Config.current(), sender.origin)) return;

    Port.send(port, {
      provider: "ETH",
      kind: "cordial:extension:broadcast",
      method: "cordial:config",
      value: evm.config(),
    });

    Port.send(port, {
      provider: "SOL",
      kind: "cordial:extension:broadcast",
      method: "cordial:config",
      value: svm.config(),
    });
  },

  encode<T>(message: Broadcast<T>): string {
    return superjson.stringify(message);
  },

  broadcast(message: Broadcast) {
    // console.log("Broadcasting", message);
    const messageJson = Port.encode(message);
    message.value = None;
    const nullJson = Port.encode(message);
    for (const id in PORTS) {
      const port = PORTS[id];
      try {
        const nullify = allowed(Config.current(), port.sender?.origin);
        port.postMessage(nullify ? messageJson : nullJson);
      } catch {
        console.log("Tab", id, "disconnected");
        delete PORTS[id];
      }
    }
  },

  send<T>(port: Port, message: Broadcast<T>) {
    port.postMessage(Port.encode(message));
  },
};

export function onMessage(
  requestJson: unknown,
  sender: MessageSender,
  respond: (response: string) => void,
) {
  if (typeof requestJson !== "string") return;

  const request: Request = superjson.parse(requestJson ?? null);
  // console.log("request:", request);
  if (!request || request.kind !== "cordial:provider:request") return;

  // Bit weird.. if handleRequest is async, then the responder doesn't work
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage#sending_an_asynchronous_response_using_sendresponse
  //
  // Seems with Chrome 144 (out January 7, 2026), should be able to use async/await normally.
  handle(request, sender).then((response) => {
    const responseJson = superjson.stringify(response ?? null);
    respond(responseJson);
  });
  return true;
}

async function handle(
  request: Request,
  sender: MessageSender,
): Promise<Response> {
  const config = Config.current();

  const log = `${request.header.provider} :: ${request.header.id} :: ${sender.origin} :: ${request.method}`;
  if (request.params) {
    console.log(`➡️ ${log} ::`, request.params);
  } else {
    console.log(`➡️ ${log}`);
  }

  const result = await process(request, config, sender.origin, sender.tab?.id);

  if (result.ok) console.log("⬅️", log, "::", result.value);
  else console.log("◀️", log, "::", result.error);

  return {
    header: request.header,
    kind: "cordial:extension:response",
    method: request.method,
    result,
  };
}

function allowed(config: Option<Config>, origin: Option<string>): boolean {
  if (!config || !origin) return false;
  return config.origins.includes(origin);
}

async function process(
  request: Request,
  config: Option<Config>,
  origin: Option<string>,
  tab: Option<number>,
): Promise<Result<unknown>> {
  const provider = request.header.provider;
  const method = request.method;

  if (tab === None) return Err(Error.permissionDenied("Not a tab"));

  if (!allowed(config, origin)) {
    await Config.updateAppearance(config, tab, false);
    switch (method) {
      case "cordial:config":
        return Ok(None);
      case "cordial:logout":
        await Login.logout();
        return Ok(None);
      case "cordial:ping":
        return Ok("pong");
      default:
        return Err(
          Error.permissionDenied(`Origin ${origin ?? "<unknown>"} not allowed`),
        );
    }
  }

  await Config.updateAppearance(config, tab, true);

  if (method === "cordial:ping") return Ok("pong");

  // console.log(
  //   "request params:",
  //   JSON.stringify(superjson.serialize(request.params ?? null), null, 2),
  // );

  if (provider === "SOL") {
    // custom calls
    if (method === "cordial:config") return Ok(svm.config());

    // signing calls
    if (method === "solana:signMessage")
      return svm.signMessage(request.params, tab);
    // if (method === "solana:signIn")
    //   return await svm.signIn(request.params as solTypes.SolanaSignInInput[]);

    // transacting calls
    if (method === "solana:signTransaction")
      return await svm.signTransaction(request.params, tab);
    if (method === "solana:signAndSendTransaction")
      return await svm.signAndSendTransaction(request.params, tab);

    return Err(Error.unimplemented(`method ${request.method} not implemented`));
  }

  if (provider === "ETH") {
    // custom calls
    if (method === "cordial:config") return Ok(evm.config());

    // signing calls
    if (method === "personal_sign")
      return evm.personal_sign(request.params, tab);
    if (method === "eth_signTypedData_v4")
      return evm.eth_signTypedData_v4(request.params, tab);

    // transacting calls
    if (method === "eth_sendTransaction")
      return evm.eth_sendTransaction(request.params, tab);

    // helper calls
    if (method === "eth_chainId") return evm.eth_chainId();
    if (method === "eth_requestAccounts") return evm.eth_requestAccounts();
    if (method === "eth_accounts") return Ok(evm.eth_accounts());
    if (method === "wallet_getCapabilities")
      return evm.wallet_getCapabilities(request.params);
    if (method === "wallet_requestPermissions")
      return evm.wallet_requestPermissions(request.params);
    if (method === "wallet_switchEthereumChain")
      return evm.wallet_switchEthereumChain(request.params);

    // Connector API RPC
    if (method.startsWith("eth_")) return evm.eth_rpc(method, request.params);

    // unsupported method;
    return Err(Error.unimplemented(`💔 Method ${method} not supported`));
  }

  return Err(Error.unknown("unreachable"));
}
