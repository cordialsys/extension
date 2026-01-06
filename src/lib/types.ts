import * as Eth from "@/lib/types/eth";
export * as Eth from "@/lib/types/eth";

// import * as Sol from "@/lib/types/sol";
export * as Sol from "@/lib/types/sol";

export type Nonce = string;
export const Nonce = {
  new(length = 16): Nonce {
    const BASE58_ALPHABET: string =
      "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    // large enough numbers to avoid bias when reducing mod 58
    return Array.from(
      crypto.getRandomValues(new Uint16Array(length)),
      (byte) => BASE58_ALPHABET[byte % BASE58_ALPHABET.length],
    ).join("");
  },
};

type Resolver = (value: unknown) => void;
type Rejecter = (reason?: unknown) => void;
// Map object keys are compared by reference (object identity), not value
// Currently, Nonce is the primitive type string so it works.
export type Requests = Map<Nonce, [Resolver, Rejecter]>;

export type Provider = "ETH" | "SOL";

export interface ProviderRequest {
  id: Nonce;
  kind: "cordial:provider:request";
  provider: Provider;
}

export interface EthProviderRequest extends ProviderRequest, Eth.Request {}

export interface Response {
  id: Nonce;
  kind: "cordial:extension:response";
  error?: unknown;
  result?: unknown;
}

export const Response = {
  new(id: Nonce, result: unknown): Response {
    return {
      id,
      kind: "cordial:extension:response",
      result,
    };
  },

  fail(id: Nonce, error: unknown): Response {
    return {
      id,
      kind: "cordial:extension:response",
      error,
    };
  },
};
