import { Err, Ok } from "@/lib/types";
import { Sdk } from "@/lib/sdk";
import { Error, Result } from "@/lib/sdk/error";

// Gotcha: Base16 is uppercase, hex is lowercase
import { hex } from "@scure/base";
import * as T from "@/lib/sdk/treasury";

import * as Sol from "@solana/wallet-standard-features";

export async function signMessage(
  params: unknown,
): Promise<Result<Sol.SolanaSignMessageOutput[]>> {
  // 1. transform
  const proposalR = T.Call.newSolanaSignMessage(params);
  if (!proposalR.ok) return proposalR;
  const proposal = proposalR.value;
  console.log("proposal for `solana:signMessage`:", proposal);

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

  // 4. wait for signature
  const signatureN = (call.response as T.CallSignature).signature as string;
  console.log("signature name:", signatureN);

  const signatureR = await T.Signature.completed(signatureN);
  if (!signatureR.ok) return signatureR;
  const signature = signatureR.value;

  return Ok([
    {
      signedMessage: hex.decode(signature.message as string),
      signature: hex.decode(signature.signature as string),
    },
  ]);
}

export async function solanaTransaction(
  method: "solana:signTransaction" | "solana:signAndSendTransaction",
  params: unknown,
): Promise<Result<T.Transaction>> {
  // 1. transform
  const proposalR = T.Call.newSvmTransaction(method, params);
  if (!proposalR.ok) return proposalR;
  const proposal = proposalR.value;
  console.log(`proposal for \`${method}\`:`, proposal);

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
  return T.Transaction.completed(txName);
}

export async function signTransaction(
  params: unknown,
): Promise<Result<{ signedTransaction: Uint8Array }[]>> {
  const txR = await solanaTransaction("solana:signTransaction", params);
  if (!txR.ok) return txR;
  const tx = txR.value;
  return Ok([{ signedTransaction: hex.decode(tx.payload as string) }]);
}

export async function signAndSendTransaction(
  params: unknown,
): Promise<Result<{ signature: Uint8Array }[]>> {
  const txR = await solanaTransaction("solana:signAndSendTransaction", params);
  if (!txR.ok) return txR;
  const tx = txR.value;

  const sigs = tx.signatures;
  if (!sigs || sigs.length !== 1)
    return Err(
      Error.unimplemented(
        "Can only handle single signatures in solana:signTransaction currently",
      ),
    );
  const sigName = sigs[0];

  const sigR = await Sdk.treasury.get<T.Signature>(sigName);
  if (!sigR.ok) return sigR;
  const sig = sigR.value;
  return Ok([{ signature: hex.decode(sig.signature as string) }]);
}

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
