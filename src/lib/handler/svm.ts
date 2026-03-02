import { Config } from "@/lib/config";
import { SidePanel } from "@/lib/sidepanel";
import { Port } from "@/lib/handler";
import { Err, None, Ok, Option, Sol, Some } from "@/lib/types";
import { Sdk } from "@/lib/sdk";
import { Error, Result } from "@/lib/sdk/error";

// Gotcha: Base16 is uppercase, hex is lowercase
import { hex } from "@scure/base";
import * as T from "@/lib/sdk/treasury";

// import * as Sol from "@solana/wallet-standard-features";

// Invariant: If this is set, then Config.addresses should be non-empty
let CONFIG: Option<Sol.Config> = None;

export function config(): Option<Sol.Config> {
  return CONFIG;
}

function notifyConfig(config: Option<Sol.Config>) {
  const notify = CONFIG !== config;
  CONFIG = config;
  if (notify) {
    console.log("SVM config changed", config);
    Port.broadcast({
      provider: "SOL",
      kind: "cordial:extension:broadcast",
      method: "cordial:config",
      value: config,
    });
  }
}

function clearConfig() {
  notifyConfig(None);
}

function setConfig(config: Sol.Config) {
  notifyConfig(Some(config));
}

async function showProposal(proposalName: string, tab: number) {
  const path = SidePanel.proposalPath(proposalName, Config.treasuryId());
  await SidePanel.setPath(tab, path);
}

export async function propagate(config: Option<Config>) {
  // console.log("updating SVM config with", config);
  if (!config) return clearConfig();
  const treasuryR = await Sdk.treasury.treasury();
  if (!treasuryR.ok) return clearConfig();
  const treasury = treasuryR.value;

  // extract chain
  let chain: Sol.Chain;
  if (import.meta.env.VITE_MAINNET_ONLY ?? false) {
    chain = Sol.MAINNET;
  } else {
    if (treasury.network === "mainnet") {
      chain = Sol.MAINNET;
    } else {
      const network = await Sdk.connector.testnetChainNetwork("SOL");
      if (!network) return clearConfig();
      if (network === "devnet") {
        chain = Sol.DEVNET;
      } else if (network === "testnet") {
        chain = Sol.TESTNET;
      } else {
        return clearConfig();
      }
    }
  }

  // set addresses
  const addresses = Config.chainAddresses("SOL");
  if (!addresses.length) return clearConfig();

  // finally update config
  return setConfig({ addresses, chain });
}

export async function signMessage(
  params: unknown,
  tab: number,
): Promise<Result<Sol.SolanaSignMessageOutput[]>> {
  // 1. transform
  const proposalR = T.Call.newSolanaSignMessage(params);
  if (!proposalR.ok) return proposalR;
  const proposal = proposalR.value;
  console.log("proposal for `solana:signMessage`:", proposal);

  // 2. propose
  const proposalNameR = await Sdk.propose.chains.calls.create(proposal);
  if (!proposalNameR.ok) return proposalNameR;
  const proposalName = proposalNameR.value;
  console.log("proposal name:", proposalName);
  await showProposal(proposalName, tab);

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
  tab: number,
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
  await showProposal(proposalName, tab);

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
  tab: number,
): Promise<Result<{ signedTransaction: Uint8Array }[]>> {
  const txR = await solanaTransaction("solana:signTransaction", params, tab);
  if (!txR.ok) return txR;
  const tx = txR.value;
  return Ok([{ signedTransaction: hex.decode(tx.payload as string) }]);
}

export async function signAndSendTransaction(
  params: unknown,
  tab: number,
): Promise<Result<{ signature: Uint8Array }[]>> {
  const txR = await solanaTransaction(
    "solana:signAndSendTransaction",
    params,
    tab,
  );
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
