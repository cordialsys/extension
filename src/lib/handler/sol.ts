import {Config} from "@/lib/config";
import {Err, Ok, Result} from "@/lib/types";
import {configureTreasuryClient, getTreasuryClient} from '../../../../frontend/src/lib/sdks/treasury';
import {decodeJwt} from "jose";

import {
  type SolanaSignTransactionInput as SignTransactionInput,
  type SolanaSignTransactionOutput as SignTransactionOutput,
} from "@solana/wallet-standard-features";
import {Call, Transaction} from "../../../../frontend/src/lib/sdks/treasury/api/types";
import {RequestError} from "../../../../frontend/src/lib/sdks/treasury/api/errors";
import {RegisteredCredential} from "../../../../frontend/src/lib/sdks/treasury/api/webauthn";
import {parseName} from "../../../../frontend/src/lib/sdks/utils/name";
import {OpenPubkeyClient} from "../../../../frontend/src/lib/sdks/treasury/api/openpubkey";

export async function signTransaction(
  config: Config,
  inputs: SignTransactionInput[],
): Promise<Result<SignTransactionOutput>> {
  console.log("config:", config);
  console.log("inputs:", inputs);

  const txAsBytes = new Uint8Array(inputs[0].transaction);
  const msg = {
    transaction: btoa(String.fromCharCode(...txAsBytes)),
    account: inputs[0].account.address,
  }
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
}

export async function createCallProposal(config: Config, chain: string, body: Call) {
  const client = await getHttpClient(config);
  const userId = await fetchUserCreds();
  return await client.createCallProposal(chain, body, userId);
}

export async function getCall(config: Config, callName: string): Promise<{
  calls: Call[];
}> {
  const client = await getHttpClient(config);
  return await client.list("Call", {filter: "proposal_id=\""+callName+"\""});
}

export async function getHttpClient(config: Config) {
  configureTreasuryClient({ host: config.treasury.url, treasuryName: config.treasury.name, treasuryUrl: config.treasury.url });
  await selectUser("root") // TODO: Take from Config
  return getTreasuryClient();
}

async function fetchUserCreds() {
  const client = new OpenPubkeyClient();

  const cred = await client.generateCredential();
  const jwtDecoded = decodeJwt(cred.jwt);

  return jwtDecoded.sub!.replace(/^user_/, "");
}

const MAX_DURATION_MS = 30_000;
const RETRY_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function pollForCall(
  config: Config,
  callName: string
): Promise<{
  calls: Call[];
}> {
  const start = Date.now();

  while (Date.now() - start < MAX_DURATION_MS) {
    try {
      const calls = await getCall(config, callName);
      if (calls.calls.length > 0) {
        return calls;
      }
    } catch (err) {
      if (!(err instanceof RequestError)) {
        throw err; // fail fast on non-RequestError
      }
      // retry on RequestError
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw new Error(`getCall timed out after ${MAX_DURATION_MS / 1000}s`);
}

export async function getTransaction(config: Config, txName: string): Promise<Transaction> {
  const client = await getHttpClient(config);
  return await client.get("Transaction", txName);
}

export async function selectUser(username: string) {
  const client = getTreasuryClient();

  const user = await client.get("User", username);
  if (!user.name) {
    throw new Error("User not found", {
      cause: user,
    });
  }

  const page = await client.list("Credential", {
    filter: `name="*${username}*" AND variant="web-authn-uv" OR variant="web-authn" OR variant="web-authn-with-uv"`,
  });

  const credentials: RegisteredCredential[] = (page.credentials ?? [])
    .filter((c) => c.raw_id && c.public_key && c.name && c.variant)
    .map((c) => ({
      name: c.name ?? "",
      public_key: c.public_key ?? "",
      raw_id: c.raw_id ?? "",
      variant: c.variant ?? "",
    })); // defaults will never happen because of the filter

  client.setUser({
    username: parseName(user.name ?? "").id,
    credentials,
  });
}
