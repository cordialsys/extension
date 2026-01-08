import { Config } from "./config";
import { browser_action } from "./constants";
import { Sdk } from "./sdk";
import { Eth, Option, Request, Response, Sol } from "./types";

export function handleRequest(
  request: Request,
  sender: globalThis.Browser.runtime.MessageSender,
  respond: (response: Response) => void,
) {
  if (!request || request.kind !== "cordial:provider:request") {
    return;
  }

  // Bit weird.. if handleRequest is async, then the responder doesn't work
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage#sending_an_asynchronous_response_using_sendresponse
  //
  // Seems with Chrome 144 (out January 7, 2026), should be able to use async/await normally.
  handleAsync(request, sender).then((response) => respond(response));
  return true;
}

async function handleAsync(
  request: Request,
  sender: globalThis.Browser.runtime.MessageSender,
): Promise<Response> {
  const config = await Config.get();
  // console.log("sender", sender);
  const origin = sender.origin;
  const tab = sender.tab?.id;
  const header = request.header;
  const id = header.id;
  const provider = header.provider;
  console.log(
    `👉 ${provider} request :: ${id} :: ${request.method} ::`,
    request.params,
  );

  const response = await handleInner(request, config, origin, tab);
  const result = response.result;
  if (result.ok) {
    console.log(`👈 ${provider} response :: ${id} ::`, result.value);
  } else {
    console.error(`👈 ${provider} response :: ${id} ::`, result.error);
  }
  return response;
}

async function handleInner(
  request: Request,
  config: Option<Config>,
  origin: Option<string>,
  tab: Option<number>,
): Promise<Response> {
  const header = request.header;
  const provider = header.provider;

  const notAllowed = !config || !origin || !config.origins.includes(origin);

  if (config) {
    browser_action.setTitle({ title: JSON.stringify(config, null, 2) });
  }
  if (notAllowed && tab) {
    console.log(`Origin ${origin} not allowed`);
    await browser_action.setBadgeText({ tabId: tab, text: "✗" });
    await browser_action.setBadgeBackgroundColor({ tabId: tab, color: "#F00" });
  } else {
    // console.log(`Origin ${origin} allowed`);
    await browser_action.setBadgeText({ tabId: tab, text: "✓" });
    await browser_action.setBadgeBackgroundColor({ tabId: tab, color: "#0F0" });
  }

  if (request.method === "cordial_ping") {
    return Response.ok(header, "pong");
  }

  if (provider === "SOL") {
    if (notAllowed) {
      const error = Eth.Code.Unauthorized;
      return Response.err(header, error);
    }
    // const request = the_request;
    if (request.method === "cordial_preconnect") {
      const treasury = await Sdk.treasury.treasury(
        config.treasury.url,
        config.treasury.name,
      );
      // console.log("treasury:", treasury);
      if (!treasury) {
        return Response.err(header, "not ok");
      }
      let chain: string;
      if (treasury.network === "mainnet") {
        chain = Sol.MAINNET;
      } else {
        const network = await Sdk.oracle.testnetChainNetwork("SOL");
        if (!treasury) {
          return Response.err(header, "not ok");
        }
        // console.log("network", network);
        if (network === "devnet") {
          chain = Sol.DEVNET;
        } else if (network === "testnet") {
          chain = Sol.TESTNET;
        } else {
          return Response.err(header, "not ok");
        }
        // TODO: Query connector.cordialapis.com to get configured !mainnet
      }
      const prefix = "chains/SOL/addresses/";
      const addresses: string[] = config.addresses
        .filter((a) => a.startsWith(prefix))
        .map((a) => a.slice(prefix.length));
      return Response.ok(header, {
        addresses,
        chain,
      } as Sol.Changes);
    }

    return Response.ok(header, `method ${request.method} not implemented`);
  }

  if (provider === "ETH") {
    if (notAllowed) {
      const error = Eth.Code.Unauthorized;
      return Response.err(header, error);
    }
    // https://docs.base.org/base-account/reference/core/provider-rpc-methods/eth_requestAccounts
    // eth_requestAccounts should return an error if user doesn't give permission
    // eth_accounts should return an empty array
    // We can probably handle both the same way (return empty array)
    if (
      request.method === "eth_requestAccounts" ||
      request.method === "eth_accounts"
    ) {
      const result = [
        "0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97",
        "0x25306c5a4f24c10cbdddda531e8b3450da3d1751",
      ];
      return Response.ok(header, result);
    }
    if (request.method === "eth_chainId") {
      const result = "0xaa36a7";
      return Response.ok(header, result);
    }
    if (request.method === "eth_blockNumber") {
      const result = "0x111111";
      return Response.ok(header, result);
    }

    // unsupported method;
    const error = Eth.Code.Unsupported;
    return Response.err(header, error);
  }

  return Response.err(header, "unreachable");
}
