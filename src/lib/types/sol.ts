import type { WalletAccount as Account } from "@wallet-standard/base";
export type { WalletAccount as Account } from "@wallet-standard/base";
import type { IdentifierArray } from "@wallet-standard/base";
export type { IdentifierArray } from "@wallet-standard/base";

export const AccountNew = {
  new(
    address: string,
    publicKey: Uint8Array,
    chains: IdentifierArray,
    // features: IdentifierArray,
  ): Account {
    return { address, publicKey, chains, features: [] } as Account;
  },
};

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
