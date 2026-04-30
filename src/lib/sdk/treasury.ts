import { Error, Result } from "@/lib/sdk/error";
import { Sdk } from "@/lib/sdk";
import { Err, Eth, Ok, Sol } from "@/lib/types";
import { short_sleep, sleep } from "@/lib/util";

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

const _UI: string = "https://connector.cordialapis.com/";
export const UI: boolean = import.meta.env.VITE_UI ?? _UI;

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
  const url = `${UI}propose/${proposalName}`;
  browser.windows.create({ url });
}

function parseError(method: string, error: z.ZodError): Result<Call> {
  return Err(
    Error.invalidArgument(
      `Invalid inputs for \`${method}\`: ${z.treeifyError(error)}`,
    ),
  );
}

function bytesHex(value: string) {
  return value.startsWith("0x") ? value.slice(2) : value;
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

    const address = AddressName.new(Eth.Chains[id], input.from);
    let amount: string;
    if (input.value)
      amount = new BigNumber(input.value).shiftedBy(-18).toFixed();
    else amount = new BigNumber(0).shiftedBy(-18).toFixed();

    return Ok({
      address,
      method,
      request: { amount, to: input.to, data: bytesHex(input.data) },
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
      request: { message: bytesHex(input[0]) },
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

  cancelWait(proposalName?: string) {
    console.info("[cordial-extension:treasury] cancel proposal wait", {
      proposalName,
      activeProposalWaits: Array.from(ACTIVE_PROPOSAL_WAITS),
    });
    if (proposalName) {
      CANCELLED_PROPOSALS.add(proposalName);
      return;
    }

    cancelProposalWaitGeneration += 1;
  },

  async byProposal(proposalName: string): Promise<Result<Call>> {
    const waitGeneration = cancelProposalWaitGeneration;
    const start = Date.now();
    ACTIVE_PROPOSAL_WAITS.add(proposalName);
    console.info("[cordial-extension:treasury] wait for proposal call", {
      proposalName,
      waitGeneration,
    });
    while (Date.now() < start + CALL_POLL_TIMEOUT) {
      if (isProposalWaitCancelled(proposalName, waitGeneration)) {
        CANCELLED_PROPOSALS.delete(proposalName);
        ACTIVE_PROPOSAL_WAITS.delete(proposalName);
        console.info("[cordial-extension:treasury] proposal wait canceled", {
          proposalName,
          waitGeneration,
        });
        return Err(Error.rejected(`Proposal ${proposalName} was canceled`));
      }

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
        CANCELLED_PROPOSALS.delete(proposalName);
        ACTIVE_PROPOSAL_WAITS.delete(proposalName);
        console.info("[cordial-extension:treasury] proposal call found", {
          proposalName,
          callName: calls[0].name,
        });
        return Ok(calls[0]);
      }
      await sleep(CALL_POLL_INTERVAL);
    }
    ACTIVE_PROPOSAL_WAITS.delete(proposalName);
    console.info("[cordial-extension:treasury] proposal wait timed out", {
      proposalName,
    });
    return Err(timedOut("Call", CALL_POLL_TIMEOUT));
  },
};

const CALL_POLL_TIMEOUT = 60_000;
const CALL_POLL_INTERVAL = 1_000;
const TIMEOUT = 180_000;
const CANCELLED_PROPOSALS = new Set<string>();
const ACTIVE_PROPOSAL_WAITS = new Set<string>();
let cancelProposalWaitGeneration = 0;

function isProposalWaitCancelled(proposalName: string, waitGeneration: number) {
  return (
    waitGeneration !== cancelProposalWaitGeneration ||
    CANCELLED_PROPOSALS.has(proposalName)
  );
}

const timedOut = (resource: string, timeout: number) =>
  Error.unknown(`${resource} failed to complete with ${timeout} milliseconds`);

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
    return Err(timedOut("Signature", TIMEOUT));
  },
};

export const Transaction = {
  async finalizing(name: string): Promise<Result<Transaction>> {
    const start = Date.now();
    while (Date.now() < start + TIMEOUT) {
      const result = await Sdk.treasury.get<Transaction>(name);
      if (!result.ok) return result;
      const tx = result.value;
      if (tx.state === "submitting" && tx.skip_broadcast) {
        return Ok(tx);
      }
      if (tx.state === "finalizing" || tx.state === "succeeded") return Ok(tx);
      if (tx.state === "failed")
        return Err(Error.unknown(tx.error?.message ?? ""));
      await short_sleep();
    }
    return Err(timedOut("Transaction", TIMEOUT));
  },
};
