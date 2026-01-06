import { Config } from "./config";
import { Eth, EthProviderRequest, ProviderRequest, Response } from "./types";

async function handleAsync(
  request: ProviderRequest,
  sender: globalThis.Browser.runtime.MessageSender,
): Promise<Response> {
  const config = await Config.get();
  const origin = sender.origin;
  if (request.provider === "ETH") {
    const response = await handleEth(
      request as EthProviderRequest,
      config,
      origin,
    );
    if (!response.error) {
      console.log(`    relay 👈 extension :: result :: ${response.result}`);
    } else {
      console.log(`    relay 👈 extension :: error :: ${response.error}`);
    }
    return response;
  }
  if (request.provider === "SOL") {
    return Response.fail(request.id, "not implemented yet");
  }

  return Response.fail(request.id, "unreachable");
}

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

async function handleEth(
  request: EthProviderRequest,
  config: Config | undefined,
  origin: string | undefined,
): Promise<Response> {
  console.log(`    relay 👉 extension :: ${request.method} :: ${request.id}`);
  const id = request.id;

  if (!config || !origin || !config.origins.includes(origin)) {
    console.log(`Origin ${origin} not allowed`);
    const error = Eth.Error.Unauthorized;
    return Response.fail(id, error);
  } else {
    console.log(`Origin ${origin} allowed`);
  }

  // try {
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
    return Response.new(id, result);
  }
  if (request.method === "eth_chainId") {
    const result = "0xaa36a7";
    return Response.new(id, result);
  }
  if (request.method === "eth_blockNumber") {
    const result = "0x111111";
    return Response.new(id, result);
  }

  // unsupported method;
  const error = Eth.Error.Unsupported;
  return Response.fail(id, error);
  // TODO: Actually handle it
  // } catch (e) {
  //   console.error("background error", e);
  // }
}
