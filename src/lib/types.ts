import * as Eth from "@/lib/types/eth";
export * as Eth from "@/lib/types/eth";

// import * as Sol from "@/lib/types/sol";
export * as Sol from "@/lib/types/sol";

export type Nonce = string;
export const Nonce = {
  new(length = 11): Nonce {
    const BASE58_ALPHABET: string =
      "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    // large enough numbers to avoid bias when reducing mod 58
    return Array.from(
      crypto.getRandomValues(new Uint16Array(length)),
      (byte) => BASE58_ALPHABET[byte % BASE58_ALPHABET.length],
    ).join("");
  },
};

export type Provider = "cordial" | "ETH" | "SOL";
export type Params = unknown[] | object;

// Note that "provider" and the prefix of "method" are somewhat redundant.
// However... the wallet standard also applies to Ethereum, so it would be
// possible for some dapps to use the "SOL" provider (which would then have
// to be renamed to e.g. WalletStandard) for ETH methods.
export interface Header {
  id: Nonce;
  provider: Provider;
}

export interface Request extends Eth.Request {
  header: Header;
  kind: "cordial:provider:request";
  method: string;
  params?: Params;
}

export const Request = {
  new(provider: Provider, method: string, params?: Params): Request {
    return {
      header: {
        id: Nonce.new(),
        provider,
      },
      kind: "cordial:provider:request",
      method,
      params,
    };
  },
};

// export interface EthProviderRequest extends ProviderRequest, Eth.Request {}

export interface Response<T = unknown, E = unknown> {
  header: Header;
  kind: "cordial:extension:response";
  method: string;
  result: Result<T, E>;
}

// Option
export type Option<T> = Some<T> | None;

export type Some<T> = T;
// setting this to null instead of undefined
// as superjson says undefined is not valid JSON
// export type None = null;
// export const None = null;
export type None = undefined;
export const None = undefined;

export function Some<T>(value: T): Some<T> {
  return value;
}

// Result
export type Result<T, E = unknown> = Ok<T> | Err<E>;

export interface Ok<T = unknown> {
  ok: true;
  value: T;
}

export function Ok<T = unknown>(value: T): Ok<T> {
  return { ok: true, value };
}

export interface Err<E = unknown> {
  ok: false;
  error: E;
}

export function Err<E = unknown>(error: E): Err<E> {
  return { ok: false, error };
}
