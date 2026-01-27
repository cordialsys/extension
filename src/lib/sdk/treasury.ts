import { Error, Result } from "@/lib/sdk/error";
import { Sdk } from "@/lib/sdk";
import { Err, Eth, Ok, Sol } from "@/lib/types";
import { short_sleep } from "@/lib/util";

import { components } from "./treasury.d";
import BigNumber from "bignumber.js";
import { hex } from "@scure/base";
import * as z from "zod";

export type {
  CallPage,
  CallSignature,
  CallTransaction,
  Hex,
  Treasury,
  UnsignedMessage,
  UnsignedEvmTransaction,
  UnsignedSvmTransaction,
  Eip712TypedData as TypedData,
} from "./treasury.d";

type Schemas = components["schemas"];
// types that we want to extend need this syntax
export type AddressName = Schemas["AddressName"];
export type Call = Schemas["Call"];
export type Id = Schemas["Id"];
export type Signature = Schemas["Signature"];
export type Transaction = Schemas["Transaction"];

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

export function prompt(proposalName: string) {
  const _ = proposalName;
  // uncomment once it's implemented
  // const url = `https://treasury.cordial.systems/propose/${proposalName}`;
  // browser.windows.create({ url });
}

function parseError(method: string, error: z.ZodError): Result<Call> {
  return Err(
    Error.invalidArgument(
      `Invalid inputs for \`${method}\`: ${z.treeifyError(error)}`,
    ),
  );
}

export const Call = {
  newEvmTransaction(
    id: Eth.Id,
    method: "eth_sendTransaction" | "eth_signTransaction",
    params: unknown,
  ): Result<Call> {
    const inputR = Eth.SignTransactionInputs.safeParse(params);
    if (!inputR.success) return parseError(method, inputR.error);
    const input = inputR.data[0];

    const address = AddressName.new(Eth.Chains[id], input.from.slice(2));
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
    const inputR = Sol.SignTransactionInputs.safeParse(params);
    if (!inputR.success) return parseError(method, inputR.error);
    const input = inputR.data[0];

    return Ok({
      address: AddressName.new("SOL", input.account.address),
      method,
      request: { transaction: hex.encode(input.transaction) },
    });
  },

  // construct from purported personal_sign inputs
  newPersonalSign(id: Eth.Id, params: unknown): Result<Call> {
    const inputR = Eth.SignMessageInputs.safeParse(params);
    if (!inputR.success) return parseError("personal_sign", inputR.error);
    const input = inputR.data;

    const blockchainAddress = input[1];
    const address = AddressName.new(Eth.Chains[id], blockchainAddress);

    return Ok({
      address,
      method: "personal_sign",
      request: { message: input[0].slice(2) },
    });
  },

  newSignTypedData(id: Eth.Id, params: unknown): Result<Call> {
    const inputR = Eth.SignTypedDataInputs.safeParse(params);
    if (!inputR.success)
      return parseError("eth_signTypedData_v4", inputR.error);
    const input = inputR.data;

    const blockchainAddress = input[0];
    const address = AddressName.new(Eth.Chains[id], blockchainAddress);

    let typedData: z.infer<typeof Eth.Eip712TypedData>;
    const directR = Eth.Eip712TypedData.safeParse(input[1]);
    if (directR.success) typedData = directR.data;
    else {
      try {
        const dejson = JSON.parse(input[1] as string);
        const jsonR = Eth.Eip712TypedData.safeParse(dejson);
        if (!jsonR.success) {
          return Err(
            Error.invalidArgument(
              "Invalid TypedData, whether directly or as JSON",
            ),
          );
        }
        typedData = jsonR.data;
      } catch {
        return Err(Error.invalidArgument("Invalid TypedData"));
      }
    }

    if (typedData.domain.chainId) {
      const chainId = Eth.Id.normalize(typedData.domain.chainId);
      if (!chainId) return Err(Error.invalidArgument("Invalid chainId"));
      typedData.domain.chainId = chainId;
    }

    return Ok({
      address,
      method: "eth_signTypedData_v4",
      request: typedData,
    });
  },

  // construct from purported solana:signMessage inputs
  newSolanaSignMessage(params: unknown): Result<Call> {
    const inputR = Sol.SignMessageInputs.safeParse(params);
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
      if (tx.state === "submitting" && tx.skip_broadcast) {
        return Ok(tx);
      }
      if (tx.state === "succeeded") return Ok(tx);
      if (tx.state === "failed")
        return Err(Error.unknown(tx.error?.message ?? ""));
      await short_sleep();
    }
    return Err(timedOut("Transaction"));
  },
};
