import { Config } from "@/lib/config";
import { Error, Result, Sdk } from "@/lib/sdk";
import { Err, Eth, None, Ok, Option } from "@/lib/types";
import { Params } from "@/lib/types";

import * as z from "zod";
import * as T from "@/lib/sdk/treasury";

// TODO: Initialize this with the Config
// Also make it an option (in case we have no EVM addresses)
let ID: Eth.Id = "0x1";
let MAINNET: boolean = true;

export async function config(config: Config): Promise<Option<Eth.Config>> {
  return None;
}

export async function ethereumSignature(
  proposal: T.Call,
): Promise<Result<string>> {
  // 1. propose
  const proposalNameR = await Sdk.propose.chains.calls.create(proposal);
  if (!proposalNameR.ok) return proposalNameR;
  const proposalName = proposalNameR.value;
  console.log("proposal name:", proposalName);

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

export async function personal_sign(params: unknown): Promise<Result<string>> {
  // 1. transform
  const proposalR = T.Call.newPersonalSign(ID, params);
  if (!proposalR.ok) return proposalR;
  const proposal = proposalR.value;
  console.log("proposal for `personal_sign`:", proposal);

  return ethereumSignature(proposal);

  // // 2. submit
  // const proposalNameR = await Sdk.propose.chains.calls.create(proposal);
  // if (!proposalNameR.ok) return proposalNameR;
  // const proposalName = proposalNameR.value;
  // console.log("proposal name:", proposalName);

  // // 3. wait for call
  // const callR = await T.Call.byProposal(proposalName);
  // if (!callR.ok) return callR;
  // const call = callR.value;
  // console.log("call name:", call.name);

  // const signatureName = (call.response as T.CallSignature).signature as string;
  // console.log("signature name:", call);

  // // 4. wait for signature
  // const signatureR = await T.Signature.completed(signatureName);
  // if (!signatureR.ok) return signatureR;
  // const signature = signatureR.value.signature as string;

  // // 5. add 27 to the last (recovery) byte
  // const recovery = parseInt(signature.slice(-2), 16);
  // const adjustedRecoveryByte = recovery + 27;
  // const adjustedSignature =
  //   signature.slice(0, -2) + adjustedRecoveryByte.toString(16);

  // const ethSignature = `0x${adjustedSignature}`;
  // return Ok(ethSignature);
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

export function eth_accounts(config: Config): string[] {
  const prefix = `chains/${Eth.Chains[ID]}/addresses/`;
  const addresses: string[] = config.addresses
    .filter((a) => a.startsWith(prefix))
    .map((a) => a.slice(prefix.length));
  return addresses;
}

export async function wallet_getCapabilities(
  params: Option<Params>,
): Promise<Result<unknown>> {
  // Uniswap sends undefined..
  // It's supposed to send
  // https://docs.metamask.io/wallet/reference/json-rpc-methods/wallet_getcapabilities
  console.log("wallet_getCapabilities params:", params);
  return Ok({});
}

export async function wallet_switchEthereumChain(
  params: Option<Params>,
): Promise<Result<unknown>> {
  const EthChain = z
    .looseObject({
      chainId: z.string(),
    })
    .array()
    .length(1);
  const result = EthChain.safeParse(params);
  if (!result.success)
    return Err(Error.unimplemented(`💔 Chain in ${params} not supported`));

  const chainId = result.data[0].chainId as Eth.Id;
  const chain = Eth.Chains[chainId];
  if (!chain)
    return Err(
      Error.unimplemented(`💔 Chain ${chainId} in ${params} not supported`),
    );

  console.log(`switching to ${chain}`);
  ID = chainId;
  return Ok(null);
}

export async function wallet_requestPermissions(
  params: Option<Params>,
): Promise<Result<unknown>> {
  const EthAccounts = z
    .looseObject({
      eth_accounts: z.object(), //.optional(),
    })
    .array()
    .length(1);
  // With EthAccounts.parse(params), this would throw a ZodError on failure
  const result = EthAccounts.safeParse(params);
  if (result.success) {
    const parsed = result.data;
    if (parsed.length > 0) {
      console.log("accounts requested");
      return Ok([{ parentCapability: "eth_accounts" }]);
    }
  }
  return Err(Error.unimplemented(`💔 Permission in ${params} not supported`));
}

export async function treasury_network(
  config: Config,
): Promise<Option<string>> {
  const treasury = await Sdk.treasury.treasury(
    config.treasury.url,
    config.treasury.name,
  );
  if (!treasury) return None;
  return treasury.network;
}

export async function eth_chainId(config: Config): Promise<Result<string>> {
  const _ = config;
  // console.log("unused", config);
  return Ok(ID); //Ids["ETH_SEPOLIA"]);
  // const network = await treasury_network(config);
  // if (!network) return Err(Error.unknown("not ok"));
  // if (network === "mainnet") {
  //   return Ok("0x1");
  // } else {
  //   return Ok(
  //     `0x${Number(await Sdk.connector.testnetChainId("ETH")).toString(16)}`,
  //   );
  // }
}

export async function eth_blockNumber(config: Config): Promise<Result<string>> {
  const network = await treasury_network(config);
  if (!network) return Err(Error.unknown("not ok"));
  const mainnet = network === "mainnet";
  return Ok(
    `0x${Number(await Sdk.connector.blockNumber(ID, mainnet)).toString(16)}`,
  );
}
