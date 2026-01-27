import { Option } from "@/lib/types";
import * as z from "zod";

import type {
  WindowRegisterWalletEvent,
  WindowRegisterWalletEventCallback as Callback,
} from "@wallet-standard/base";

import type { IdentifierArray, WalletAccount } from "@wallet-standard/base";
import type { SolanaSignMessageOutput } from "@solana/wallet-standard-features";

export type { IdentifierArray, SolanaSignMessageOutput };

export interface Account extends WalletAccount {}

export const Account = {
  new(
    address: string,
    publicKey: Uint8Array,
    chains: IdentifierArray,
    features: IdentifierArray,
  ): Account {
    return { address, publicKey, chains, features } as Account;
  },
};

export interface Config {
  addresses: string[];
  // https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md
  // chains?: string[];
  chain: Chain;
}

export type Configurator = (config: Option<Config>) => Promise<void>;

/** Solana Mainnet (beta) cluster, e.g. https://api.mainnet-beta.solana.com */
export const MAINNET = "solana:mainnet";

/** Solana Devnet cluster, e.g. https://api.devnet.solana.com */
export const DEVNET = "solana:devnet";

/** Solana Testnet cluster, e.g. https://api.testnet.solana.com */
export const TESTNET = "solana:testnet";

/** Solana Localnet cluster, e.g. http://localhost:8899 */
export const LOCALNET = "solana:localnet";

/** Array of all Solana clusters */
export const CHAINS = [MAINNET, DEVNET, TESTNET, LOCALNET] as const;

/** Type of all Solana clusters */
export type Chain = (typeof CHAINS)[number];

export class RegisterWalletEvent
  extends Event
  implements WindowRegisterWalletEvent
{
  detail: Callback;
  type = "wallet-standard:register-wallet" as const;

  constructor(callback: Callback) {
    super("wallet-standard:register-wallet", {
      bubbles: false,
      cancelable: false,
      composed: false,
    });
    this.detail = callback;
  }

  preventDefault(): never {
    throw new Error("preventDefault cannot be called");
  }

  stopImmediatePropagation(): never {
    throw new Error("stopImmediatePropagation cannot be called");
  }

  stopPropagation(): never {
    throw new Error("stopPropagation cannot be called");
  }
}

const Base58Address = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
const Data = z.instanceof(Uint8Array);
// just Account clashes with Account above
const AccountAddress = z.looseObject({ address: Base58Address });

// SolanaMessageInput[]
// https://github.com/anza-xyz/wallet-standard/blob/master/packages/core/features/src/signMessage.ts
export const SignMessageInputs = z
  .array(
    z.looseObject({
      account: AccountAddress,
      message: Data,
    }),
  )
  .length(1);

// SolanaSignTransactionInput[]
// https://github.com/anza-xyz/wallet-standard/blob/master/packages/core/features/src/signTransaction.ts
// https://github.com/anza-xyz/wallet-standard/blob/master/packages/core/features/src/signAndSendTransaction.ts
export const SignTransactionInputs = z
  .array(
    z.looseObject({
      account: AccountAddress,
      transaction: Data,
    }),
  )
  .length(1);
