import { Config } from "@/lib/config";
import { Error, Result, Sdk } from "@/lib/sdk";
import { Err, Eth, None, Ok, Option, Some } from "@/lib/types";

import * as z from "zod";
import * as T from "@/lib/sdk/treasury";

let ID: Eth.Id = "0x1";
// Invariant: If this is set, then Config.addresses should be non-empty
let CONFIG: Option<Eth.Config> = None;

export function config(): Option<Eth.Config> {
  return CONFIG;
}

function notifyConfig(config: Option<Eth.Config>) {
  const notify = CONFIG !== config;
  CONFIG = config;
  if (notify) {
    // TODO: Notify providers
    console.log("EVM config changed", config);
  }
}

function clearConfig() {
  notifyConfig(None);
}

function setConfig(config: Eth.Config) {
  notifyConfig(Some(config));
}

export async function updateConfig(config: Option<Config>) {
  // console.log("updating EVM config with", config);
  if (!config) return clearConfig();
  const treasuryR = await Sdk.treasury.treasury();
  // console.log("treasuryR", treasuryR);
  if (!treasuryR.ok) return clearConfig();
  const treasury = treasuryR.value;

  const chain = Eth.Chains[ID];
  // console.log("current chain", chain);

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
  const prefix = `chains/${chain}/addresses/`;
  const addresses = config.addresses
    .filter((a) => a.startsWith(prefix))
    .map((a) => a.slice(prefix.length));
  if (!addresses.length) return clearConfig();

  // finally update config
  return setConfig({ addresses, chain, mainnet });
}

export async function ethereumSignature(
  proposal: T.Call,
): Promise<Result<string>> {
  // 1. propose
  const proposalNameR = await Sdk.propose.chains.calls.create(proposal);
  if (!proposalNameR.ok) return proposalNameR;
  const proposalName = proposalNameR.value;
  console.log("proposal name:", proposalName);
  T.prompt(proposalName);

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

  const chainId = 137; // Polygon (MATIC) chain ID
  const v = (chainId * 2) + 35; // 309
  signature = signature.slice(0, -2) + v.toString(16).slice(-2); // Maybe this last slice is a mistake, but I'm trying to convert v to a single byte

  const ethSignature = `0x${signature}`;
  return Ok(ethSignature);
}

export async function personal_sign(params: unknown): Promise<Result<string>> {
  // 1. transform
  const proposalR = T.Call.newPersonalSign(ID, params);
  if (!proposalR.ok) return proposalR;
  const proposal = proposalR.value;
  console.log("proposal for `personal_sign`:", proposal);

  return ethereumSignature(proposal);
}

export async function eth_signTypedData_v4(
  params: unknown,
): Promise<Result<string>> {
  const proposalR = T.Call.newSignTypedData(ID, params);
  if (!proposalR.ok) return proposalR;
  const proposal = proposalR.value;
  console.log("proposal for `eth_signTypedData_v4`:", proposal);

  return ethereumSignature(proposal);
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
): Promise<Result<string>> {
  // 1. transform
  const proposalR = T.Call.newEvmTransaction(ID, "eth_sendTransaction", params);
  if (!proposalR.ok) return proposalR;
  const proposal = proposalR.value;
  console.log("proposal for `eth_sendTransaction`:", proposal);

  // 2. submit
  const proposalNameR = await Sdk.propose.chains.calls.create(proposal);
  if (!proposalNameR.ok) return proposalNameR;
  const proposalName = proposalNameR.value;
  console.log("proposal name:", proposalName);
  T.prompt(proposalName);

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
  // Uniswap sends undefined..
  // It's supposed to send
  // https://docs.metamask.io/wallet/reference/json-rpc-methods/wallet_getcapabilities
  console.log("wallet_getCapabilities params:", params);
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

  ID = id;
  await updateConfig(await Config.load());
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

export function eth_chainId(): Eth.Id {
  return ID;
}

export async function eth_blockNumber(): Promise<Result<string>> {
  if (!CONFIG) return Err(Error.permissionDenied("Not configured"));
  const blockNumber = await Sdk.connector.blockNumber(ID, CONFIG.mainnet);
  return Ok(`0x${Number(blockNumber).toString(16)}`);
}
