import { Config } from "./config";
import { browser_action } from "./constants";
import { Sdk } from "./sdk";
import { Err, Eth, Ok, Option, Request, Response, Result, Sol } from "./types";
import * as sol from "./handler/sol";

import type * as solTypes from "@solana/wallet-standard-features";

export function handleRequest(
  request: Request,
  sender: globalThis.Browser.runtime.MessageSender,
  respond: (response: Response) => void,
) {
  if (!request || request.kind !== "cordial:provider:request") return;

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

  const log = `${request.header.provider} :: ${request.header.id} :: ${request.method} ::`;
  console.log("❓", log, request.params);

  const result = await process(request, config, sender.origin, sender.tab?.id);

  if (result.ok) console.log("✍", log, result.value);
  else console.error("✍", log, result.error);

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

  if (method === "cordial_ping") {
    return Ok("pong");
  }

  if (provider === "SOL") {
    if (notAllowed) {
      const error = Eth.Code.Unauthorized;
      return Err(error);
    }
    // const request = the_request;
    if (method === "cordial_preconnect") {
      const treasury = await Sdk.treasury.treasury(
        config.treasury.url,
        config.treasury.name,
      );
      if (!treasury) {
        return Err("not ok");
      }
      let chain = Sol.MAINNET;
      if (treasury.network !== "mainnet") {
        const network = await Sdk.connector.testnetChainNetwork("SOL");
        if (!network) {
          return Err("not ok");
        }
        // console.log("network", network);
        if (network === "devnet") {
          chain = Sol.DEVNET;
        } else if (network === "testnet") {
          chain = Sol.TESTNET;
        } else {
          return Err("not ok");
        }
        // TODO: Query connector.cordialapis.com to get configured !mainnet
      }
      const prefix = "chains/SOL/addresses/";
      const addresses: string[] = config.addresses
        .filter((a) => a.startsWith(prefix))
        .map((a) => a.slice(prefix.length));
      return Ok({
        addresses,
        chain,
      } as Sol.Changes);
    }

    if (method === "sol_signTransaction") {
      return await sol.signTransaction(
        config,
        request.params as solTypes.SolanaSignTransactionInput[],
      );
    }

    return Err(`method ${request.method} not implemented`);
  }

  if (provider === "ETH") {
    if (notAllowed) {
      const error = Eth.Code.Unauthorized;
      return Err(error);
    }
    // https://docs.base.org/base-account/reference/core/provider-rpc-methods/eth_requestAccounts
    // eth_requestAccounts should return an error if user doesn't give permission
    // eth_accounts should return an empty array
    // We can probably handle both the same way (return empty array)
    if (method === "eth_requestAccounts" || method === "eth_accounts") {
      const addresses = eth_accounts(config);
      return Ok(addresses);
    }
    if (method === "eth_chainId") {
      const chainId = await eth_chainId(config);
      if (!chainId) return Err("not ok");
      return Ok(chainId);
    }
    if (method === "eth_blockNumber") {
      const blockNumber = await eth_blockNumber(config);
      if (!blockNumber) return Err("not ok");
      return Ok(blockNumber);
    }

    // unsupported method;
    console.error(`💔 Method ${method} not supported`);
    const error = Eth.Code.Unsupported;
    return Err(error);
  }

  return Err("unreachable");
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
