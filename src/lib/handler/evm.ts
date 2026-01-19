import { Config } from "@/lib/config";
import { Error, Result, Sdk } from "@/lib/sdk";
import { Err, None, Ok, Option, Request } from "@/lib/types";
import { Params } from "@/lib/types";
import { Evm, Evms, Id, Ids } from "@/lib/types/eth";
import { short_sleep } from "@/lib/util";

import * as z from "zod";
import * as T from "@/lib/sdk/treasury";

// export async function eth_sendTransaction(request: Request) {
//   const proposalNameResult = await Sdk.propose.chains.calls.create("ETH", {
//     skip_broadcast: false,
//     call: request,
//   });
//   if (!proposalNameResult.ok) return proposalNameResult;
//   const proposalName = proposalNameResult.value;
//   console.log("proposal name:", proposalName);

//   const callResult = await T.Call.byProposal(proposalName);
//   if (!callResult.ok) return callResult;
//   const call = callResult.value;
//   console.log("call:", call);
//   // biome-ignore lint/style/noNonNullAssertion: The schema is incorrect, name of a call is not optional.
//   const tx = await T.Call.succeededTransaction(call.transaction!);
//   if (!tx.ok)
//     return Err(Error.unknown("transaction failed: " + tx.error + "\n"));

//   return Ok(tx.value.hash);
// }

let EVM: Evm = "ETH";

export function fromEthHex(s: string): Result<string> {
  if (!s.startsWith("0x")) {
    return Err(Error.invalidArgument("ETH hex string not starting with `0x`"));
  }
  return Ok(s.slice(2));
}

export function toEthHex(s: string): Result<string> {
  return Ok(`0x${s}`);
}

export function eth_accounts(config: Config): string[] {
  const prefix = `chains/${EVM}/addresses/`;
  const addresses: string[] = config.addresses
    .filter((a) => a.startsWith(prefix))
    .map((a) => a.slice(prefix.length));
  return addresses;
}

const PersonalSign = z.string().array().length(2);

// Don't need this for ETH
function idNormalize(s: string): string {
  return s;
}

export async function personal_sign(
  params: Option<Params>,
): Promise<Result<unknown>> {
  // 1. parse
  const result = PersonalSign.safeParse(params);
  if (!result.success)
    return Err(Error.invalidArgument("Invalid arguments for `personal_sign`"));
  const data = result.data;

  // 2. transform
  console.log("personal sign args:", data);
  const messageResult = fromEthHex(data[0]);
  const blockchainAddress = data[1];
  if (!messageResult.ok) return messageResult;
  const message = messageResult.value;

  const address = `chains/${EVM}/addresses/${idNormalize(blockchainAddress)}`;
  const proposal: T.Call = {
    address,
    method: "personal_sign",
    request: {
      message,
    },
  };
  console.log("proposal for `personal_sign`:", proposal);

  // 3. submit
  const proposalNameResult = await Sdk.propose.chains.calls.create(proposal);
  if (!proposalNameResult.ok) return proposalNameResult;
  const proposalName = proposalNameResult.value;
  console.log("proposal name:", proposalName);

  // 4. wait for processing
  const callResult = await T.Call.byProposal(proposalName);
  if (!callResult.ok) return callResult;
  const call = callResult.value;
  console.log("call:", call);

  // 5. handle response
  const CallR = z.object({
    response: z.object({
      signature: z.string(),
    }),
  });
  const callResult2 = CallR.safeParse(call);
  if (!callResult2.success) {
    return Err(Error.internal("Engine response missing signature"));
  }
  const signatureName = callResult2.data.response.signature;
  while (true) {
    // Once our API filtering implements JSON expansion, we will
    // be able to do this, for now we have to use `proposal_id`.
    // const filter = `json(proposal).name = "${proposalName}"`;
    //
    // TODO: change the OpenAPI etc. to use `proposal_name` here.
    const signatureResult = await Sdk.treasury.get<T.Signature>(signatureName);
    console.log("sig result:", signatureResult);
    if (!signatureResult.ok) return signatureResult;
    const sig = signatureResult.value;
    if (sig.state === "failed") {
      return Err(Error.internal("signing failed"));
    }
    if (!(sig.state === "signed")) {
      await short_sleep();
      continue;
    }
    if (!sig.signature) return Err(Error.internal("signature succeeded but"));
    if (sig.signature.length > 0) {
      const ethSignature = `0x${sig.signature}`;
      console.log("returning sig", ethSignature);
      return Ok(ethSignature);
    }
    await short_sleep();
  }
  // const signatureResult = await Sdk.treasury.get(signatureName);
  // console.log("sig result:", signatureResult);
  // if (!signatureResult.ok) return signatureResult;
  // const signature = signatureResult.value;
  // const ethSignature = `0x${signature}`;
  // return Ok(ethSignature);
  // return Err(Error.unimplemented("personal sign not implemented yet"));
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
  return Ok(Ids[EVM]); //Ids["ETH_SEPOLIA"]);
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
