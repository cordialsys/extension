import { Config } from "@/lib/config";
import { Error, Result, Sdk } from "@/lib/sdk";
import { Err, None, Ok, Option, Request } from "@/lib/types";
import { Params } from "@/lib/types";
import { Evm, Evms, Id, Ids } from "@/lib/types/eth";

import * as z from "zod";
import * as T from "@/lib/sdk/treasury";

export async function eth_sendTransaction(request: Request) {
  const proposalNameResult = await Sdk.propose.chains.calls.create("ETH", {
    skip_broadcast: false,
    call: request,
  });
  if (!proposalNameResult.ok) return proposalNameResult;
  const proposalName = proposalNameResult.value;
  console.log("proposal name:", proposalName);

  const callResult = await T.Call.byProposal(proposalName);
  if (!callResult.ok) return callResult;
  const call = callResult.value;
  console.log("call:", call);
  // biome-ignore lint/style/noNonNullAssertion: The schema is incorrect, name of a call is not optional.
  const tx = await T.Call.succeededTransaction(call.transaction!);
  if (!tx.ok) return Err(Error.unknown("transaction failed: " + tx.error + "\n"));

  return Ok(tx.value.hash);
}


let EVM: Evm = "ETH";

export function eth_accounts(config: Config): string[] {
  const prefix = `chains/${EVM}/addresses/`;
  const addresses: string[] = config.addresses
    .filter((a) => a.startsWith(prefix))
    .map((a) => a.slice(prefix.length));
  return addresses;
}

export async function personal_sign(
  params: Option<Params>,
): Promise<Result<unknown>> {
  const PersonalSign = z.string().array().length(2);
  const result = PersonalSign.safeParse(params);
  console.log(result);
  return Err(Error.unimplemented("personal sign not implemented yet"));
  // if (!result.success)
  //   return Err(
  //     Error.invalidArgument("Incorrect arguments for `personal_sign`"),
  //   );
}

export async function wallet_switchEthereumChain(
  params: Option<Params>,
): Promise<Result<unknown>> {
  const EthChain = z
    .object({
      chainId: z.string(), //z.object(), //.optional(),
    })
    .array()
    .length(1);
  const result = EthChain.safeParse(params);
  if (!result.success)
    return Err(Error.unimplemented(`💔 Chain in ${params} not supported`));

  const evm = Evms[result.data[0].chainId as Id];
  if (!evm)
    return Err(Error.unimplemented(`💔 Chain in ${params} not supported`));

  console.log(`switching to ${evm}`);
  EVM = evm;
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
  console.log("unused", config);
  return Ok(Ids[EVM]);
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
    `0x${Number(await Sdk.connector.blockNumber(EVM, mainnet)).toString(16)}`,
  );
}
