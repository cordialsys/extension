import { Error, Result } from "@/lib/sdk/error";
import { Sdk } from "@/lib/sdk";
import { Err, Ok } from "@/lib/types";
import { short_sleep } from "@/lib/util";

import { components } from "./treasury.d";

export type Call = components["schemas"]["Call"];
export type CallPage = components["schemas"]["CallPage"];
export type Transaction = components["schemas"]["Transaction"];
export type Treasury = components["schemas"]["Treasury"];

export const Call = {
  async byProposal(proposalName: string): Promise<Result<Call>> {
    while (true) {
      // Once our API filtering implements JSON expansion, we will
      // be able to do this, for now we have to use `proposal_id`.
      // const filter = `json(proposal).name = "${proposalName}"`;
      //
      // TODO: change the OpenAPI etc. to use `proposal_name` here.
      const filter = `proposal_id = "${proposalName}"`;
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

  async submittedTransaction(
    txName: string,
    timeoutMs = 120_000, // 2 minutes
  ): Promise<Result<Transaction>> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const result = await Sdk.treasury.get<Transaction>(txName);

      // propagate error
      if (!result.ok) return result;

      // succeed
      if (result.value.state === "submitting") return Ok(result.value);

      await short_sleep();
    }

    return Err(Error.unknown(`locateSignedTx timed out after ${timeoutMs}ms`));
  },

  // async completed(name: string): Promise<Result<Call>> {
  //   while (true) {
  //     const result = await Sdk.treasury.get<Call>(name);
  //     if (!result.ok) return result;
  //     const call = result.value;
  //     // TODO: Shouldn't need to cast state as string,
  //     // it should be defined properly in OpenAPI spec.
  //     if ((call.state as string) === "succeeded") {
  //       return Ok(call);
  //     }
  //     if ((call.state as string) === "failed") {
  //       return Err(Error.unknown(JSON.stringify(call)));
  //     }
  //     await short_sleep();
  //   }
  // },
};
