import { Err, Ok } from "@/lib/types";
import { Sdk } from "@/lib/sdk";
import { Error, Result } from "@/lib/sdk/error";

// Gotcha: Base16 is uppercase, hex is lowercase
import { hex } from "@scure/base";
import * as T from "@/lib/sdk/treasury";

import { base64 } from "@scure/base";
import * as Sol from "@solana/wallet-standard-features";

// export async function signIn(
//   inputs: Sol.SolanaSignInInput[],
// ): Promise<Result<Sol.SolanaSignInOutput>> {
//   console.log("inputs:", inputs);
//   // For https://anza-xyz.github.io/wallet-adapter/example/, this is
//   // domain: "anza-xyz.github.io",
//   // statement: "Please sign in",
//   //
//   // We shouldn't trust the "domain" key.
//   const msg = {};
//   //   domain: inputs[0].domain,
//   //   statement: inputs[0].statement,
//   // };
//   const proposal = { call: msg };

//   // 1. Create the proposal via Propose API
//   const proposalNameResult = await Sdk.propose.chains.calls.create(
//     "SOL",
//     proposal,
//   );
//   if (!proposalNameResult.ok) return proposalNameResult;
//   const proposalName = proposalNameResult.value;
//   console.log("proposal name:", proposalName);
//   const proposalId = proposalName.slice("chains/SOL/calls/".length);

//   // 2. Locate the call via Treasury API
//   const callResult = await T.Call.byProposal(proposalId);
//   if (!callResult.ok) return callResult;
//   // biome-ignore lint/style/noNonNullAssertion: The schema is incorrect, name of a call is not optional.
//   const callName = callResult.value.name!;
//   console.log("call name:", callName);

//   // =======
//   //   let callResult = await T.Call.byProposal(proposalId);
//   //   if (!callResult.ok) return callResult;
//   //   // biome-ignore lint/style/noNonNullAssertion: The schema is incorrect, name of a call is not optional.
//   //   const callName: string = callResult.value.name!;
//   //   console.log("call name:", callName);

//   //   // 3. Wait for the call to complete
//   //   callResult = await T.Call.completed(callName);
//   // >>>>>>> 47ecaeda9 (extension: Type gymnastics)
//   // if (!callResult.ok) return callResult;
//   // const call = callResult.value;
//   // console.log("completed call:", call);

//   return Err(Error.unimplemented("SOL signIn not finished yet"));
// }

// export async function signTransaction(
//   inputs: Sol.SolanaSignTransactionInput[],
// ): Promise<Result<Sol.SolanaSignTransactionOutput[]>> {
//   const txBytes = inputs[0].transaction;
//   console.log("transaction bytes:", txBytes);
//   const input = {
//     // TODO: We shouldn't be doing ad-hoc replacements
//     account: inputs[0].account.address,
//     transaction: base64.encode(txBytes),
//   };
//   const proposalNameResult = await Sdk.propose.chains.calls.create("SOL", {
//     skip_broadcast: true,
//     call: input,
//   });
//   if (!proposalNameResult.ok) return proposalNameResult;
//   const proposalName = proposalNameResult.value;
//   console.log("proposal name:", proposalName);

//   const submitUrl = `https://treasury.cordial.systems/propose/${proposalName}`;
//   browser.windows.create({ url: submitUrl });

//   const callResult = await T.Call.byProposal(proposalName);
//   if (!callResult.ok) return callResult;
//   const call = callResult.value;
//   console.log("call:", call);

//   // biome-ignore lint/style/noNonNullAssertion: The schema is incorrect, name of a call is not optional.
//   const tx = await T.Call.submittedTransaction(call.transaction!);
//   if (!tx.ok) return Err(Error.unknown("failed to sign transaction"));

//   // biome-ignore lint/style/noNonNullAssertion: The schema is incorrect, payload of a transaction is not optional.
//   const payload = tx.value.payload!;
//   console.log("payload:", payload);
//   const bytes: Uint8Array = hex.decode(payload);
//   console.log("bytes:", bytes);

//   return Ok([{ signedTransaction: bytes }]);
// }
