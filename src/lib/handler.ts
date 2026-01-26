import { Config } from "./config";
import { Error, Result } from "./sdk";
import { Err, None, Ok, Option, Request, Response } from "./types";

import * as evm from "./handler/evm";
import * as svm from "./handler/svm";
export { evm, svm };

import superjson from "superjson";

const MAINNET_ONLY: boolean = !!(import.meta.env.VITE_MAINNET_ONLY ?? false);
if (MAINNET_ONLY) console.log("mainnet only");

export function onMessage(
  requestJson: string,
  sender: globalThis.Browser.runtime.MessageSender,
  respond: (response: string) => void,
) {
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
  sender: globalThis.Browser.runtime.MessageSender,
): Promise<Response> {
  const config = Config.current();

  const log = `${request.header.provider} :: ${request.header.id} :: ${sender.origin} :: ${request.method} ::`;
  console.log("➡️", log, request.params);

  const result = await process(request, config, sender.origin, sender.tab?.id);

  if (result.ok) console.log("⬅️", log, result.value);
  else console.log("◀️", log, result.error);

  return {
    header: request.header,
    kind: "cordial:extension:response",
    method: request.method,
    result,
  };
}

async function process(
  request: Request,
  config: Option<Config>,
  origin: Option<string>,
  tab: Option<number>,
): Promise<Result<unknown>> {
  const provider = request.header.provider;
  const method = request.method;

  if (!tab) return Err(Error.permissionDenied("Not a tab"));

  if (!config || !origin || !config.origins.includes(origin)) {
    await Config.setBadge(config, tab, false);
    switch (method) {
      case "cordial:config":
        return Ok(None);
      case "cordial:ping":
        return Ok("pong");
      default:
        return Err(
          Error.permissionDenied(`Origin ${origin ?? "<unknown>"} not allowed`),
        );
    }
  }

  await Config.setBadge(config, tab, true);

  if (method === "cordial:ping") return Ok("pong");

  // console.log(
  //   "request params:",
  //   JSON.stringify(superjson.serialize(request.params ?? null), null, 2),
  // );

  if (provider === "SOL") {
    // custom calls
    if (method === "cordial:config") return Ok(svm.config());

    // signing calls
    if (method === "solana:signMessage") return svm.signMessage(request.params);
    // if (method === "solana:signIn")
    //   return await svm.signIn(request.params as solTypes.SolanaSignInInput[]);

    // transacting calls
    if (method === "solana:signTransaction")
      return await svm.signTransaction(request.params);
    if (method === "solana:signAndSendTransaction")
      return await svm.signAndSendTransaction(request.params);

    return Err(Error.unimplemented(`method ${request.method} not implemented`));
  }

  if (provider === "ETH") {
    // custom calls
    if (method === "cordial:config") return Ok(evm.config());

    // signing calls
    if (method === "personal_sign") return evm.personal_sign(request.params);
    if (method === "eth_signTypedData_v4")
      return evm.eth_signTypedData_v4(request.params);

    // transacting calls
    if (method === "eth_sendTransaction")
      return evm.eth_sendTransaction(request.params);

    // helper calls
    if (method === "eth_blockNumber") return evm.eth_blockNumber();
    if (method === "eth_chainId") return Ok(evm.eth_chainId());
    if (method === "eth_requestAccounts") return evm.eth_requestAccounts();
    if (method === "eth_accounts") return Ok(evm.eth_accounts());
    if (method === "wallet_getCapabilities")
      return evm.wallet_getCapabilities(request.params);
    if (method === "wallet_requestPermissions")
      return evm.wallet_requestPermissions(request.params);
    if (method === "wallet_switchEthereumChain")
      return evm.wallet_switchEthereumChain(request.params);

    // unsupported method;
    return Err(Error.unimplemented(`💔 Method ${method} not supported`));
  }

  return Err(Error.unknown("unreachable"));
}
