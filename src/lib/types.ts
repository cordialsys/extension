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

export type Provider = "ETH" | "SOL";
export type Params = unknown[] | object;

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

export type Option<T> = T | undefined;

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
