import { Config } from "./config";
import { browser_action } from "./constants";
import { Sdk } from "./sdk";
import {
  Eth,
  EthProviderRequest,
  Option,
  ProviderRequest,
  Response,
  Sol,
} from "./types";

export function handleRequest(
  request: ProviderRequest,
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
  request: ProviderRequest,
  sender: globalThis.Browser.runtime.MessageSender,
): Promise<Response> {
  const config = await Config.get();
  // console.log("sender", sender);
  const origin = sender.origin;
  const tab = sender.tab?.id;
  const response = await handleInner(request, config, origin, tab);
  if (response.result.ok) {
    console.log("    relay 👈 extension :: result ::", response.result.value);
  } else {
    console.log(`    relay 👈 extension :: error :: ${response.result.error}`);
  }
  return response;
}

async function handleInner(
  the_request: ProviderRequest,
  config: Option<Config>,
  origin: Option<string>,
  tab: Option<number>,
): Promise<Response> {
  const id = the_request.id;

  const notAllowed = !config || !origin || !config.origins.includes(origin);

  browser_action.setTitle({ title: JSON.stringify(config, null, 2) });
  if (notAllowed && tab) {
    console.log(`Origin ${origin} not allowed`);
    await browser_action.setBadgeText({ tabId: tab, text: "✗" });
    await browser_action.setBadgeBackgroundColor({ tabId: tab, color: "#F00" });
  } else {
    console.log(`Origin ${origin} allowed`);
    await browser_action.setBadgeText({ tabId: tab, text: "✓" });
    await browser_action.setBadgeBackgroundColor({ tabId: tab, color: "#0F0" });
  }

  if (the_request.method === "cordial_ping") {
    return Response.ok(id, "pong");
  }

  if (the_request.provider === "SOL") {
    if (notAllowed) {
      const error = Eth.ErrorCode.Unauthorized;
      return Response.err(id, error);
    }
    // const request = the_request;
    const request = the_request as EthProviderRequest;
    if (request.method === "cordial_preconnect") {
      console.log("SOL provider preconnecting");
      const treasury = await Sdk.treasury.treasury(
        config.treasury.url,
        config.treasury.name,
      );
      console.log("treasury:", treasury);
      if (!treasury) {
        return Response.err(id, "not ok");
      }
      let chain: string;
      if (treasury.network === "mainnet") {
        chain = Sol.MAINNET;
      } else {
        const network = await Sdk.oracle.testnetChainNetwork("SOL");
        if (!treasury) {
          return Response.err(id, "not ok");
        }
        console.log("network", network);
        if (network === "devnet") {
          chain = Sol.DEVNET;
        } else if (network === "testnet") {
          chain = Sol.TESTNET;
        } else {
          return Response.err(id, "not ok");
        }
        // TODO: Query connector.cordialapis.com to get configured !mainnet
      }
      const prefix = "chains/SOL/addresses/";
      const addresses: string[] = config.addresses
        .filter((a) => a.startsWith(prefix))
        .map((a) => a.slice(prefix.length));
      return Response.ok(id, {
        addresses,
        chain,
      } as Sol.Changes);
    }

    return Response.ok(id, `method ${request.method} not implemented`);
  }

  if (the_request.provider === "ETH") {
    const request = the_request as EthProviderRequest;
    console.log(
      `    relay 👉 extension :: ETH :: ${request.method} :: ${request.id}`,
    );
    if (notAllowed) {
      const error = Eth.ErrorCode.Unauthorized;
      return Response.err(id, error);
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
      return Response.ok(id, result);
    }
    if (request.method === "eth_chainId") {
      const result = "0xaa36a7";
      return Response.ok(id, result);
    }
    if (request.method === "eth_blockNumber") {
      const result = "0x111111";
      return Response.ok(id, result);
    }

    // unsupported method;
    const error = Eth.ErrorCode.Unsupported;
    return Response.err(id, error);
  }

  return Response.err(the_request.id, "unreachable");
}
