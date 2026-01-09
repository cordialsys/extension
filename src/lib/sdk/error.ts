import { Result as GenericResult } from "@/lib/types";

// https://grpc.io/docs/guides/status-codes/

// To emulate the Rust `?` operator, we have do be a bit Go-ish,
// but with the advantage that Typescript will catch any forgotten
// error handling.
//
// Note that
// - `return somethingResult`, and
// - `return Err(somethingResult.error)`
// are equivalent.
//
// ```
// const somethingResult = fallibleFunction();
// if (!somethingResult.ok) return somethingResult;
// const something = somethingResult.value;
// ```
//
// More verbose than just `const something = fallibleFunction()?`,
// but not too bad...

export interface Error {
  code: number;
  status: string;
  message: string;
}

export type Result<T> = GenericResult<T, Error>;

export const Error = {
  failedPrecondition(message: string): Error {
    return {
      code: 9,
      status: "Failed Precondition",
      message,
    };
  },
  invalidArgument(message: string): Error {
    return {
      code: 3,
      status: "Invalid Argument",
      message,
    };
  },
  notFound(message: string): Error {
    return {
      code: 5,
      status: "Not Found",
      message,
    };
  },
  unimplemented(message: string): Error {
    return {
      code: 12,
      status: "Unimplemented",
      message,
    };
  },
  unknown(message: string): Error {
    return {
      code: 2,
      status: "Unknown",
      message,
    };
  },
};
