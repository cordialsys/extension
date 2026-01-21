import { Error, Result } from "@/lib/sdk/error";
import { Sdk } from "@/lib/sdk";
import { Err, Ok } from "@/lib/types";
import { Evm } from "@/lib/types/eth";
import { short_sleep } from "@/lib/util";

import { components } from "./treasury.d";
import BigNumber from "bignumber.js";
import { hex } from "@scure/base";
import * as z from "zod";

export type AddressName = components["schemas"]["AddressName"];
export type Call = components["schemas"]["Call"];
export type CallPage = components["schemas"]["CallPage"];
export type CallSignature = components["schemas"]["CallSignature"];
export type CallTransaction = components["schemas"]["CallTransaction"];
export type Hex = components["schemas"]["Hex"];
export type Id = components["schemas"]["Id"];
export type Signature = components["schemas"]["Signature"];
export type Transaction = components["schemas"]["Transaction"];
export type Treasury = components["schemas"]["Treasury"];
export type UnsignedMessage = components["schemas"]["UnsignedMessage"];
export type UnsignedEvmTransaction =
  components["schemas"]["UnsignedEvmTransaction"];
export type UnsignedSvmTransaction =
  components["schemas"]["UnsignedSvmTransaction"];

const Id = {
  new(s: string): Id {
    return s
      .trim()
      .replace(/\s/g, "_")
      .replace(/[^0-9A-Za-z-_]/g, "-");
  },
};

const AddressName = {
  new(chain: string, address: string): AddressName {
    return `chains/${chain}/addresses/${Id.new(address)}`;
  },
};

// https://docs.metamask.io/wallet/reference/json-rpc-methods/eth_sendtransaction
const EthHexAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
// 0 or more hex characters
const EthHexData0 = z.string().regex(/^0x[0-9a-f]*$/);
// 1 or more hex characters
const EthHexData1 = z.string().regex(/^0x[a-fA-F\d]+$/);
const EthHexValue = z.string().regex(/^0x([1-9a-f]+[0-9a-f]*|0)$/);

const SolBase58Address = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
const SolData = z.instanceof(Uint8Array);
const SolAccount = z.looseObject({ address: SolBase58Address });

function parseError(method: string, error: z.ZodError): Result<Call> {
  return Err(
    Error.invalidArgument(
      `Invalid inputs for \`${method}\`: ${z.treeifyError(error)}`,
    ),
  );
}

export const Call = {
  newEvmTransaction(
    chain: Evm,
    method: "eth_sendTransaction" | "eth_signTransaction",
    params: unknown,
  ): Result<Call> {
    // https://docs.metamask.io/wallet/reference/json-rpc-methods/eth_sendtransaction/
    const Input = z
      .array(
        z.looseObject({
          from: EthHexAddress,
          to: EthHexAddress,
          value: EthHexValue,
          data: EthHexData0,
        }),
      )
      .length(1);
    const inputR = Input.safeParse(params);
    if (!inputR.success) return parseError(method, inputR.error);
    const input = inputR.data[0];

    const address = AddressName.new(chain, input.from.slice(2));
    // keep the `.slice(2)` out, BigNumber detects hex numbers using the `0x` prefix
    const amount = new BigNumber(input.value).shiftedBy(-18).toFixed();

    return Ok({
      address,
      method,
      request: { amount, to: input.to.slice(2), data: input.data.slice(2) },
    });
  },

  newSvmTransaction(
    method: "solana:signTransaction" | "solana:signAndSendTransaction",
    params: unknown,
  ): Result<Call> {
    // SolanaSignTransactionInput[]
    // https://github.com/anza-xyz/wallet-standard/blob/master/packages/core/features/src/signTransaction.ts
    // https://github.com/anza-xyz/wallet-standard/blob/master/packages/core/features/src/signAndSendTransaction.ts
    const Input = z
      .array(
        z.looseObject({
          account: SolAccount,
          transaction: SolData,
        }),
      )
      .length(1);
    const inputR = Input.safeParse(params);
    if (!inputR.success) return parseError(method, inputR.error);
    const input = inputR.data[0];

    return Ok({
      address: AddressName.new("SOL", input.account.address),
      method,
      request: { transaction: hex.encode(input.transaction) },
    });
  },

  // construct from purported personal_sign inputs
  newPersonalSign(chain: Evm, params: unknown): Result<Call> {
    //https://docs.metamask.io/wallet/reference/json-rpc-methods/personal_sign/
    const Input = z.tuple([EthHexData1, EthHexAddress]);
    const inputR = Input.safeParse(params);
    if (!inputR.success) return parseError("personal_sign", inputR.error);
    const input = inputR.data;

    const blockchainAddress = input[1];
    const address = AddressName.new(chain, blockchainAddress);

    return Ok({
      address,
      method: "personal_sign",
      request: { message: input[0].slice(2) },
    });
  },

  // construct from purported solana:signMessage inputs
  newSolanaSignMessage(params: unknown): Result<Call> {
    // SolanaMessageInput[]
    // https://github.com/anza-xyz/wallet-standard/blob/master/packages/core/features/src/signMessage.ts
    const Input = z
      .array(
        z.looseObject({
          account: SolAccount,
          message: SolData,
        }),
      )
      .length(1);

    const inputR = Input.safeParse(params);
    if (!inputR.success) return parseError("solana:signMessage", inputR.error);
    const input = inputR.data[0];

    return Ok({
      address: AddressName.new("SOL", input.account.address),
      method: "solana:signMessage",
      request: {
        message: hex.encode(input.message),
      },
    });
  },

  async byProposal(proposalName: string): Promise<Result<Call>> {
    while (true) {
      // Once our API filtering implements JSON expansion, we will
      // be able to do this, for now we have to use `proposal_id`.
      // const filter = `json(proposal).name = "${proposalName}"`;
      //
      // TODO: change the OpenAPI etc. to use `proposal_name` here.
      const filter = `proposal.name = "${proposalName}"`;
      const callsResult = await Sdk.treasury.chains.calls.list({ filter });
      if (!callsResult.ok) return callsResult;
      const calls = callsResult.value;

      if (calls?.length > 0) {
        // TODO: Check that there is only one call?
        return Ok(calls[0]);
      }
      await short_sleep();
    }
  },
};

const TIMEOUT = 180_000;

const timedOut = (resource: string) =>
  Error.unknown(`${resource} failed to complete with ${TIMEOUT} milliseconds`);

// function timeOut<T>(f: () => Promise<Result<T>>) => {
//   const start = Date.now()
//   while (Date.now() < start + TIMEOUT) {

//   }

// }

export const Signature = {
  async completed(name: string): Promise<Result<Signature>> {
    const start = Date.now();
    while (Date.now() < start + TIMEOUT) {
      const result = await Sdk.treasury.get<Signature>(name);
      if (!result.ok) return result;
      const sig = result.value;
      if (sig.state === "signed") return Ok(sig);
      if (sig.state === "failed")
        return Err(Error.unknown(sig.failure as string));
      await short_sleep();
    }
    return Err(timedOut("Signature"));
  },
};

export const Transaction = {
  async completed(name: string): Promise<Result<Transaction>> {
    const start = Date.now();
    while (Date.now() < start + TIMEOUT) {
      const result = await Sdk.treasury.get<Transaction>(name);
      if (!result.ok) return result;
      const tx = result.value;
      if (tx.state === "succeeded") return Ok(tx);
      if (tx.state === "failed")
        return Err(Error.unknown(tx.error?.message ?? ""));
      await short_sleep();
    }
    return Err(timedOut("Transaction"));
  },
};
