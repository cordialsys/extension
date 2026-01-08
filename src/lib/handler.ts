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
      if (!treasury) {
        return Response.err(header, "not ok");
      }
      let chain = Sol.MAINNET;
      if (treasury.network !== "mainnet") {
        const network = await Sdk.connector.testnetChainNetwork("SOL");
        if (!network) {
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
      // const addresses = [
      //   "0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97",
      //   "0x25306c5a4f24c10cbdddda531e8b3450da3d1751",
      // ];
      const addresses = eth_accounts(config);
      return Response.ok(header, addresses);
    }
    if (request.method === "eth_chainId") {
      const chainId = await eth_chainId(config);
      if (!chainId) return Response.err(header, "not ok");
      return Response.ok(header, chainId);
    }
    if (request.method === "eth_blockNumber") {
      const blockNumber = await eth_blockNumber(config);
      if (!blockNumber) return Response.err(header, "not ok");
      return Response.ok(header, blockNumber);
    }

    // unsupported method;
    const error = Eth.Code.Unsupported;
    return Response.err(header, error);
  }

  return Response.err(header, "unreachable");
}

function eth_accounts(config: Config): string[] {
  const prefix = "chains/ETH/addresses/";
  const addresses: string[] = config.addresses
    .filter((a) => a.startsWith(prefix))
    .map((a) => a.slice(prefix.length));
  return addresses;
}

async function treasury_network(config: Config): Promise<Option<string>> {
  const treasury = await Sdk.treasury.treasury(
    config.treasury.url,
    config.treasury.name,
  );
  if (!treasury) return undefined;
  return treasury.network;
}

async function eth_chainId(config: Config): Promise<Option<string>> {
  const network = await treasury_network(config);
  if (!network) return undefined;
  if (network === "mainnet") {
    return "0x1";
  } else {
    return (
      "0x" + Number(await Sdk.connector.testnetChainId("ETH")).toString(16)
    );
  }
}

async function eth_blockNumber(config: Config): Promise<Option<string>> {
  const network = await treasury_network(config);
  if (!network) return undefined;
  const mainnet = network === "mainnet";
  return (
    "0x" + Number(await Sdk.connector.blockNumber("ETH", mainnet)).toString(16)
  );
}
