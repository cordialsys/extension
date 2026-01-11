import { Config } from "@/lib/config";
import { Err, Ok } from "@/lib/types";
import { Sdk } from "@/lib/sdk";
import { Error, Result } from "@/lib/sdk/error";

import * as T from "@/lib/sdk/treasury";

import * as Sol from "@solana/wallet-standard-features";

const sleep = (millis: number) => new Promise((_) => setTimeout(_, millis));
const SLEEP = 100;

async function locateCall(
  // proposalName: string,
  proposalId: string,
): Promise<Result<string>> {
  while (true) {
    // Once our API filtering implements JSON expansion, we will
    // be able to do this, for now we have to use `proposal_id`.
    // const filter = `json(proposal).name = "${proposalName}"`;
    const filter = `proposal_id = "${proposalId}"`;
    const callsResult = await Sdk.treasury.chains.calls.list({ filter });
    if (!callsResult.ok) return callsResult;
    const calls = callsResult.value;

    if (calls) {
      // TODO: Check that there is only one call?
      // biome-ignore lint/style/noNonNullAssertion: The schema is incorrect, name of a call is not optional.
      return Ok(calls[0].name!);
    }
    await sleep(SLEEP);
  }
}

async function callCompleted(callName: string): Promise<Result<T.Call>> {
  while (true) {
    const result = await Sdk.treasury.chains.calls.get(callName);
    if (!result.ok) return result;
    const call = result.value;
    // TODO: Shouldn't need to cast state as string,
    // it should be defined properly in OpenAPI spec.
    if ((call.state as string) === "succeeded") {
      return Ok(call);
    }
    if ((call.state as string) === "failed") {
      return Err(Error.unknown(JSON.stringify(call)));
    }
    await sleep(SLEEP);
  }
}

export async function signIn(
  inputs: Sol.SolanaSignInInput[],
): Promise<Result<Sol.SolanaSignInOutput>> {
  console.log("inputs:", inputs);
  // For https://anza-xyz.github.io/wallet-adapter/example/, this is
  // domain: "anza-xyz.github.io",
  // statement: "Please sign in",
  //
  // We shouldn't trust the "domain" key.
  const msg = {};
  //   domain: inputs[0].domain,
  //   statement: inputs[0].statement,
  // };
  const proposal = { call: msg };

  // 1. Create the proposal via Propose API
  const proposalNameResult = await Sdk.propose.chains.calls.create(
    "SOL",
    proposal,
  );
  if (!proposalNameResult.ok) return proposalNameResult;
  const proposalName = proposalNameResult.value;
  console.log("proposal name:", proposalName);
  const proposalId = proposalName.slice("chains/SOL/calls/".length);

  // 2. Locate the call via Treasury API
  const callNameResult = await locateCall(proposalId);
  if (!callNameResult.ok) return callNameResult;
  const callName = callNameResult.value;
  console.log("call name:", callName);

  // 3. Wait for the call to complete
  const callResult = await callCompleted(callName);
  if (!callResult.ok) return callResult;
  const call = callResult.value;
  console.log("completed call:", call);

  return Err(Error.unimplemented("SOL signIn not finished yet"));
}

export async function signTransaction(
  config: Config,
  inputs: Sol.SolanaSignTransactionInput[],
): Promise<Result<Sol.SolanaSignTransactionOutput>> {
  console.log("config:", config);
  console.log("inputs:", inputs);

  // const txAsBytes = new Uint8Array(inputs[0].transaction);
  // const msg = {
  //   transaction: btoa(String.fromCharCode(...txAsBytes)),
  //   account: inputs[0].account.address,
  // };

  return Err(Error.unimplemented("SOL signTransaction not finished yet"));

  /*
  const call = {
    call: msg,
    skip_broadcast: true,
  }
  const proposalName = await createCallProposal(config, 'SOL', call)
  if (!proposalName.success()) {
    return Err("Failed to create call proposal")
  }
  const callRess = await pollForCall(config, proposalName.resource!)
  await new Promise(resolve => setTimeout(resolve, 2000)); // wait for the signature to complete, TODO: replace with poll
  const callR = callRess.calls[0]
  await new Promise(resolve => setTimeout(resolve, 4000)); // wait for the signature to complete, TODO: replace with poll
  const txId = callR.transaction!
  const txResource = await getTransaction(config, txId)
  const payload: string = txResource.payload!
  const bytes: number[] = payload
    .match(/.{1,2}/g)!
    .map(byte => parseInt(byte, 16));

  return Ok({signedTransaction: Uint8Array.from(bytes)});
  */
}

// export async function createCallProposal(
//   config: Config,
//   chain: string,
//   body: Call,
// ) {
//   const client = await getHttpClient(config);
//   const userId = await fetchUserCreds();
//   return await client.createCallProposal(chain, body, userId);
// }

// export async function getCall(config: Config, callName: string): Promise<{
//   calls: Call[];
// }> {
//   const client = await getHttpClient(config);
//   return await client.list("Call", {filter: "proposal_id=\""+callName+"\""});
// }

// export async function getHttpClient(config: Config) {
//   configureTreasuryClient({
//     host: config.treasury.url,
//     treasuryName: config.treasury.name,
//     treasuryUrl: config.treasury.url,
//   });
//   await selectUser("root"); // TODO: Take from Config
//   return getTreasuryClient();
// }

// async function fetchUserCreds() {
//   const client = new OpenPubkeyClient();

//   const cred = await client.generateCredential();
//   const jwtDecoded = decodeJwt(cred.jwt);

//   return jwtDecoded.sub!.replace(/^user_/, "");
// }

// const MAX_DURATION_MS = 30_000;
// const RETRY_DELAY_MS = 500;

// function sleep(ms: number) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }

// export async function pollForCall(
//   config: Config,
//   callName: string
// ): Promise<{
//   calls: Call[];
// }> {
//   const start = Date.now();

//   while (Date.now() - start < MAX_DURATION_MS) {
//     try {
//       const calls = await getCall(config, callName);
//       if (calls.calls.length > 0) {
//         return calls;
//       }
//     } catch (err) {
//       if (!(err instanceof RequestError)) {
//         throw err; // fail fast on non-RequestError
//       }
//       // retry on RequestError
//       await sleep(RETRY_DELAY_MS);
//     }
//   }

//   throw new Error(`getCall timed out after ${MAX_DURATION_MS / 1000}s`);
// }

// export async function getTransaction(config: Config, txName: string): Promise<Transaction> {
//   const client = await getHttpClient(config);
//   return await client.get("Transaction", txName);
// }

// export async function selectUser(username: string) {
//   const client = getTreasuryClient();

//   const user = await client.get("User", username);
//   if (!user.name) {
//     throw new Error("User not found", {
//       cause: user,
//     });
//   }

//   const page = await client.list("Credential", {
//     filter: `name="*${username}*" AND variant="web-authn-uv" OR variant="web-authn" OR variant="web-authn-with-uv"`,
//   });

//   const credentials: RegisteredCredential[] = (page.credentials ?? [])
//     .filter((c) => c.raw_id && c.public_key && c.name && c.variant)
//     .map((c) => ({
//       name: c.name ?? "",
//       public_key: c.public_key ?? "",
//       raw_id: c.raw_id ?? "",
//       variant: c.variant ?? "",
//     })); // defaults will never happen because of the filter

//   client.setUser({
//     username: parseName(user.name ?? "").id,
//     credentials,
//   });
// }
