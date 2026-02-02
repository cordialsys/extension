import { None, Option } from "@/lib/types";
import * as z from "zod";

export type Chain = "ETH" | "MATIC";

export type Id =
  // ETH
  | "0x1"
  // ETH+sepolia
  | "0xaa36a7"
  // ETH+hoodi
  | "0x88bb0"
  // MATIC
  | "0x89";

export const Id = {
  normalize(id: string | number): Option<string> {
    const num = Number(id);
    if (!Number.isFinite(num)) return None;
    return `0x${num.toString(16)}`;
  },
};

// This typechecks that we have each Id exactly once
// Note that definining `type Id = keyof typeof Chains`
// would simply set `type Id = string`, which is not what we want.
export const Chains: { [id in Id]: Chain } = {
  "0x1": "ETH",
  "0xaa36a7": "ETH",
  "0x88bb0": "ETH",
  "0x89": "MATIC",
};

export const Mainnet: { [chain in Chain]: Id } = {
  ETH: "0x1",
  MATIC: "0x89",
};

export type Config = {
  chain: Chain;
  id: Id;
  addresses: string[];
  mainnet: boolean;
};

export type Configurator = (config: Option<Config>) => Promise<void>;

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

const HexAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
// 0 or more hex character pairs (or just '0')
// This means Vec<u8>
const HexData0 = z.string().regex(/^(?:0x0|0x(?:[0-9A-Fa-f]{2})*)$/);
// 1 or more hex character pairs (or just '0')
// This means non-empty Vec<u8>
const HexData1 = z.string().regex(/^(?:0x0|0x(?:[0-9A-Fa-f]{2})+)$/);
export const HexValue = HexData1;

// https://docs.metamask.io/wallet/reference/json-rpc-methods/eth_sendtransaction
// https://docs.metamask.io/snaps/reference/keyring-api/chain-methods#eth_signtransaction
const SignTransactionInput = z.looseObject({
  from: HexAddress,
  to: HexAddress,
  value: HexValue,
  data: HexData0,
});
export const SignTransactionInputs = z.array(SignTransactionInput).length(1);
//https://docs.metamask.io/wallet/reference/json-rpc-methods/personal_sign/
export const SignMessageInputs = z.tuple([HexData1, HexAddress]);

export const Eip712Domain = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  chainId: z.string().or(z.number()).optional(),
  verifyingContract: HexAddress.optional(),
  salt: z.string().optional(),
});

export const Eip712DomainType = z.object({
  name: z.string(),
  type: z.string(),
});

export const Eip712TypedData = z.object({
  domain: Eip712Domain,
  types: z.record(z.string(), z.array(Eip712DomainType)),
  primaryType: z.string(),
  message: z.record(z.string(), z.unknown()),
});

// we don't set the second parameter to Eip712TypedData yet,
// as it could be both literal or encoded as JSON
export const SignTypedDataInputs = z.tuple([HexData1, z.unknown()]);

// The specified JSON Schema is a bit more implicit
// about `domain` and the `EIP712Domain` property.
//
// In reality, the keys are all optional, and their types are fixed to
//
// string name: the user readable name of signing domain, i.e. the name of the DApp or the protocol.
// string version: the current major version of the signing domain. Signatures from different versions are not compatible.
// uint256 chainId: the EIP-155 chain id. The user-agent should refuse signing if it does not match the currently active chain.
// address verifyingContract: the address of the contract that will verify the signature. The user-agent may do contract specific phishing prevention.
// bytes32: salt
//
// export const Eip712TypedData = z.fromJSONSchema({
//   type: "object",
//   properties: {
//     types: {
//       type: "object",
//       properties: {
//         EIP712Domain: { type: "array" },
//       },
//       additionalProperties: {
//         type: "array",
//         items: {
//           type: "object",
//           properties: {
//             name: { type: "string" },
//             type: { type: "string" },
//           },
//           required: ["name", "type"],
//         },
//       },
//       required: ["EIP712Domain"],
//     },
//     primaryType: { type: "string" },
//     domain: { type: "object" },
//     message: { type: "object" },
//   },
//   required: ["types", "primaryType", "domain", "message"],
// });
