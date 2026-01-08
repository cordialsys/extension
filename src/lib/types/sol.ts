import type {
  WindowRegisterWalletEvent,
  WindowRegisterWalletEventCallback as Callback,
} from "@wallet-standard/base";

import type { WalletAccount as Account } from "@wallet-standard/base";
export type { WalletAccount as Account } from "@wallet-standard/base";
import type { IdentifierArray } from "@wallet-standard/base";
export type { IdentifierArray } from "@wallet-standard/base";

export const AccountNew = {
  new(
    address: string,
    publicKey: Uint8Array,
    chains: IdentifierArray,
    features: IdentifierArray,
  ): Account {
    return { address, publicKey, chains, features } as Account;
  },
};

export interface Changes {
  addresses: string[];
  // https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md
  // chains?: string[];
  chain: string;
}

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
