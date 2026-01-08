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

export enum ErrorCode {
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

export interface ProviderError extends Error {
  code: ErrorCode;
  data?: unknown;
}

export const ProviderError = {
  create: (code: ErrorCode, message: string, data?: unknown): ProviderError => {
    const error = new Error(message) as ProviderError;
    error.code = code;
    error.data = data;
    return error;
  },
};
