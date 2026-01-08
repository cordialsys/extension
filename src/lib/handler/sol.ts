import { Config } from "@/lib/config";
import { Err, Result } from "@/lib/types";

import {
  type SolanaSignTransactionInput as SignTransactionInput,
  type SolanaSignTransactionOutput as SignTransactionOutput,
} from "@solana/wallet-standard-features";

export async function signTransaction(
  config: Config,
  inputs: SignTransactionInput[],
): Promise<Result<SignTransactionOutput>> {
  console.log("config:", config);
  console.log("inputs:", inputs);
  return Err("sol_signTransaction not implemented yet");
}
