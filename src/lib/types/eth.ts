export interface Request {
  method: string;
  params?: unknown[] | object;
}

export enum Error {
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
}
