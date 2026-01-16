export type Evm = "ETH" | "ETH_SEPOLIA" | "MATIC";
export type Id = "0x1" | "0xaa36a7" | "0x89";

export const Ids: { [evm in Evm]: Id } = {
  ETH: "0x1",
  ETH_SEPOLIA: "0xaa36a7",
  MATIC: "0x89",
};

export const Evms: { [id in Id]: Evm } = {
  "0x1": "ETH",
  "0xaa36a7": "ETH_SEPOLIA",
  "0x89": "MATIC",
};

export interface Info {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface Request {
  method: string;
  params?: unknown[] | object;
}

export enum Code {
  // The user rejected the request.
  Rejected = 4001,
  // The requested method and/or account has not been authorized by the user.
  Unauthorized = 4100,
  // The Provider does not support the requested method.
  Unsupported = 4200,
  // The Provider is disconnected from all chains.
  Disconnected = 4900,
  // The Provider is not connected to the requested chain.
  ChainDisconnected = 4901,

  // https://www.quicknode.com/docs/ethereum/error-references

  // The method is not supported by the Provider.
  MethodNotSupported = -32601,

  InternalRpcError = -32603,
}

export interface Provider {
  request(args: Request): Promise<unknown>;
}

export namespace Provider {
  // globalThis.Error accesses the locally shadowed Javascript Error object

  export interface Error extends globalThis.Error {
    code: Code;
    data?: unknown;
  }

  export const Error = {
    create: (code: Code, message: string, data?: unknown): Provider.Error => {
      const error = new globalThis.Error(message) as Provider.Error;
      error.code = code;
      error.data = data;
      return error;
    },
  };
}
