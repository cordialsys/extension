import { Config } from "@/lib/config";
import { SidePanel } from "@/lib/sidepanel";
import { Port } from "@/lib/handler";
import { Error, Result, Sdk } from "@/lib/sdk";
import { Err, Eth, None, Ok, Option, Some } from "@/lib/types";

import * as z from "zod";
import * as T from "@/lib/sdk/treasury";

// Invariant: If this is set, then Config.addresses should be non-empty
let CONFIG: Option<Eth.Config> = None;

export function config(): Option<Eth.Config> {
  return CONFIG;
}

function notifyConfig(config: Option<Eth.Config>) {
  const notify = CONFIG !== config;
  CONFIG = config;
  if (notify) {
    console.log("EVM config changed", config);
    Port.broadcast({
      provider: "ETH",
      kind: "cordial:extension:broadcast",
      method: "cordial:config",
      value: config,
    });
  }
}

function clearConfig() {
  notifyConfig(None);
}

function setConfig(config: Eth.Config) {
  notifyConfig(Some(config));
}

async function showProposal(proposalName: string, tab: number) {
  const path = SidePanel.proposalPath(proposalName, Config.treasuryId());
  await SidePanel.setPath(tab, path);
}

export async function propagate(
  maybeID: Option<Eth.Id>,
  config: Option<Config>,
) {
  // console.log("updating EVM config with", config);
  if (!config) return clearConfig();
  const treasuryR = await Sdk.treasury.treasury();
  // console.log("treasuryR", treasuryR);
  if (!treasuryR.ok) return clearConfig();
  const treasury = treasuryR.value;

  // Pick a chain ID that has addresses (if any)
  let ID = maybeID;
  if (!ID) {
    for (const [chain, id] of Object.entries(Eth.Mainnet)) {
      if (Config.chainAddresses(chain).length) {
        ID = id;
        break;
      }
    }
  }
  // need this case? could also clearConfig();
  if (!ID) {
    ID = "0x1";
  }
  const chain = Eth.Chains[ID];

  // ensure id
  const mainnet = treasury.network === "mainnet";
  if (!(import.meta.env.VITE_MAINNET_ONLY ?? false)) {
    // Hack: suppress this
    // Connector API lists !mainnet MATIC as "testnet" instead of chain ID
    // In general our chain registry is a mess
    //
    if (!mainnet) {
      // console.log("EVM not mainnet");
      const network = await Sdk.connector.testnetChainNetwork(chain);
      if (!network) return clearConfig();
      // console.log("network", network);
      const id = Eth.Id.normalize(network);
      // console.log("id", id);
      if (!id) return clearConfig();
      if (id !== ID) return clearConfig();
    }
  }

  // set addresses
  const addresses = Config.chainAddresses(chain);
  if (!addresses.length) return clearConfig();

  // finally update config
  return setConfig({ addresses, chain, id: ID, mainnet });
}

export async function ethereumSignature(
  proposal: T.Call,
  tab: number,
): Promise<Result<string>> {
  // 1. propose
  const proposalNameR = await Sdk.propose.chains.calls.create(proposal);
  if (!proposalNameR.ok) return proposalNameR;
  const proposalName = proposalNameR.value;
  console.log("proposal name:", proposalName);
  await showProposal(proposalName, tab);

  // 2. wait for call
  const callR = await T.Call.byProposal(proposalName);
  if (!callR.ok) return callR;
  const call = callR.value;
  console.log("call name:", call.name);

  const signatureName = (call.response as T.CallSignature).signature as string;
  console.log("signature name:", call);

  // 3. wait for signature
  const signatureR = await T.Signature.completed(signatureName);
  if (!signatureR.ok) return signatureR;
  let signature = signatureR.value.signature as string;

  // 4. add 27 to the last (recovery) byte
  const recovery = parseInt(signature.slice(-2), 16);
  const v = recovery + 27;
  signature = signature.slice(0, -2) + v.toString(16);

  const ethSignature = `0x${signature}`;
  return Ok(ethSignature);
}

export async function personal_sign(
  params: unknown,
  tab: number,
): Promise<Result<string>> {
  if (!CONFIG) return Err(Error.permissionDenied("Not configured"));
  // 1. transform
  const proposalR = T.Call.newPersonalSign(CONFIG.id, params);
  if (!proposalR.ok) return proposalR;
  const proposal = proposalR.value;
  console.log("proposal for `personal_sign`:", proposal);

  return ethereumSignature(proposal, tab);
}

export async function eth_signTypedData_v4(
  params: unknown,
  tab: number,
): Promise<Result<string>> {
  if (!CONFIG) return Err(Error.permissionDenied("Not configured"));
  const proposalR = T.Call.newSignTypedData(CONFIG.id, params);
  if (!proposalR.ok) return proposalR;
  const proposal = proposalR.value;
  console.log("proposal for `eth_signTypedData_v4`:", proposal);

  return ethereumSignature(proposal, tab);
}

export async function eth_signTransaction(
  params: unknown,
): Promise<Result<{ v: string; r: string; s: string }>> {
  console.log(params);
  // https://docs.metamask.io/snaps/reference/keyring-api/chain-methods#eth_signtransaction
  return Err(Error.unimplemented("eth_signTransaction not yet implemented"));
}

export async function eth_sendTransaction(
  params: unknown,
  tab: number,
): Promise<Result<string>> {
  if (!CONFIG) return Err(Error.permissionDenied("Not configured"));
  // 1. transform
  const proposalR = T.Call.newEvmTransaction(
    CONFIG.id,
    "eth_sendTransaction",
    params,
  );
  if (!proposalR.ok) return proposalR;
  const proposal = proposalR.value;
  console.log("proposal for `eth_sendTransaction`:", proposal);

  // 2. submit
  const proposalNameR = await Sdk.propose.chains.calls.create(proposal);
  if (!proposalNameR.ok) return proposalNameR;
  const proposalName = proposalNameR.value;
  console.log("proposal name:", proposalName);
  await showProposal(proposalName, tab);

  // 3. wait for call
  const callR = await T.Call.byProposal(proposalName);
  if (!callR.ok) return callR;
  const call = callR.value;
  console.log("call name:", call.name);

  const txName = (call.response as T.CallTransaction).transaction as string;
  console.log("transaction name:", call);

  // 4. wait for signature
  const txR = await T.Transaction.completed(txName);
  if (!txR.ok) return txR;
  const hash = txR.value.hash as string;

  // already 0x-prefixed?
  // const ethHash = `0x${hash}`;
  return Ok(hash);
}

// https://docs.base.org/base-account/reference/core/provider-rpc-methods/eth_requestAccounts
// eth_requestAccounts should return an error if user doesn't give permission
export function eth_requestAccounts(): Result<string[]> {
  // For instance Polymarket can't handle this
  // if (!CONFIG) return Err(Error.permissionDenied("No accounts authorized"));
  if (!CONFIG) return Ok([]);
  return Ok(CONFIG.addresses);
}

// eth_accounts should return an empty array
export function eth_accounts(): string[] {
  if (!CONFIG) return [];
  return CONFIG.addresses;
}

// https://eips.ethereum.org/EIPS/eip-2255
export async function wallet_getCapabilities(
  params: unknown,
): Promise<Result<unknown>> {
  const _ = params;
  // Uniswap sends undefined..
  // It's supposed to send
  // https://docs.metamask.io/wallet/reference/json-rpc-methods/wallet_getcapabilities
  // console.log("wallet_getCapabilities params:", params);
  return Ok({});
}

export async function wallet_switchEthereumChain(
  params: unknown,
): Promise<Result<unknown>> {
  const EthChain = z
    .looseObject({
      chainId: z.string().or(z.number()),
    })
    .array()
    .length(1);
  const result = EthChain.safeParse(params);
  if (!result.success) return Err(Error.unimplemented(`Chain not supported`));

  const requestedId = result.data[0].chainId;
  const idMaybe = Eth.Id.normalize(requestedId);

  if (!idMaybe || !Object.keys(Eth.Chains).includes(idMaybe)) {
    return Err(Error.unimplemented(`Chain ${requestedId} not supported`));
  }

  const id = idMaybe as Eth.Id;
  // const chain = Eth.Chains[id];
  // console.log(`switching to ${chain} with ID ${id}`);

  await propagate(id, Config.current());
  return Ok(null);
}

export async function wallet_requestPermissions(
  params: unknown,
): Promise<Result<unknown>> {
  const EthAccounts = z
    .looseObject({
      eth_accounts: z.object(), //.optional(),
    })
    .array()
    .length(1);
  const result = EthAccounts.safeParse(params);
  if (result.success) {
    const parsed = result.data;
    if (parsed.length > 0) {
      return Ok([{ parentCapability: "eth_accounts" }]);
    }
  }
  return Err(Error.unimplemented(`💔 Permission in ${params} not supported`));
}

export function eth_chainId(): Result<Eth.Id> {
  if (!CONFIG) return Err(Error.permissionDenied("Not configured"));
  return Ok(CONFIG.id);
}

export async function eth_blockNumber(): Promise<Result<string>> {
  if (!CONFIG) return Err(Error.permissionDenied("Not configured"));
  const blockNumber = await Sdk.connector.blockNumber(
    CONFIG.chain,
    CONFIG.mainnet,
  );
  return Ok(`0x${Number(blockNumber).toString(16)}`);
}

// preparing this as Uniswap calls it
// should be able to dispatch to Connector API call
export async function eth_getCode(params: unknown): Promise<Result<string>> {
  const Tags = z.enum(["earliest", "latest", "pending", "safe", "finalized"]);
  const GetCode = z.tuple([Eth.HexValue, z.union([Eth.HexValue, Tags])]);
  const result = GetCode.safeParse(params);
  if (!result.success) {
    console.log("eth_getCode with", params, "invalid:", result.error);
    return Err(
      Error.invalidArgument(`Invalid eth_getCode params: ${result.error}`),
    );
  }
  // console.log("eth_getCode with", result.data);
  return Err(Error.unimplemented(`💔 Method eth_getCode not supported`));
}
