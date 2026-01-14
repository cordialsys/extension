import { Config, Extension } from "./config";
import { Login } from "./login";
import { Error, Result } from "./sdk/error";
import { sign } from "./sdk/http_signature";
import { Err, Ok, Option } from "./types";

import superjson from "superjson";
import * as A from "./sdk/admin";
import * as T from "./sdk/treasury";

interface ListOptions {
  filter?: string;
}

function notConfigured(): Error {
  return Error.failedPrecondition("not configured");
}

function notLoggedIn(): Error {
  return Error.failedPrecondition("not logged in");
}

// All Cordial APIs work in this same way.
async function apiGet<R>(url: string): Promise<Result<R>> {
  const response = await fetch(url);
  if (!response.ok) {
    return Err((await response.json()) as Error);
  }
  return Ok((await response.json()) as R);
}

async function apiList<R>(
  url: string,
  plural: string,
  options?: ListOptions,
): Promise<Result<R[]>> {
  if (options?.filter) {
    const filtered = new URL(url);
    filtered.searchParams.set("filter", options.filter);
    url = filtered.toString();
  }
  const response = await fetch(url);
  if (!response.ok) {
    return Err((await response.json()) as Error);
  }
  // TODO: pagination
  const page = (await response.json()) as { [plural]: R[] };
  return Ok(page[plural]);
}

export namespace Sdk {
  export namespace admin {
    const API: string = "https://admin.cordialapis.com/";

    async function genericGet<R>(name: string): Promise<Result<R>> {
      const url = `${API}v1/${name}`;
      return await apiGet<R>(url);
    }

    async function genericList<R>(
      path: string,
      plural: string,
      options?: ListOptions,
    ): Promise<Result<R[]>> {
      const url = `${API}v1/${path}`;
      return await apiList<R>(url, plural, options);
    }

    export namespace users {
      export async function get(userId: string): Promise<Result<A.User>> {
        return genericGet(`users/${userId}`);
      }

      export async function list(
        options?: ListOptions,
      ): Promise<Result<A.User[]>> {
        return genericList<A.User>("users", "users", options);
      }

      export namespace extension {
        export async function get(
          userId: string,
        ): Promise<Result<A.Extension>> {
          const name = `users/${userId}/extension`;
          return await genericGet(name);
        }
        // syntactic sugar
        export async function maybe(userId: string): Promise<Option<Config>> {
          const result = await get(userId);
          if (!result.ok) {
            return undefined;
          }
          const extension = result.value as Extension;
          return extension.config;
        }
      }
    }
  }

  export namespace connector {
    export async function blockNumber(
      chainId: string,
      mainnet: boolean,
    ): Promise<Option<string>> {
      // TODO: handle mainnet vs testnet
      let url = `https://connector.cordialapis.com/v1/chains/${chainId}/block`;
      if (!mainnet) {
        url += "?network=testnet";
      }
      const response = await fetch(url);
      if (!response.ok) {
        return undefined;
      }
      const chain = (await response.json()) as { height: string };
      return chain.height;
    }
    export async function testnetChainNetwork(
      chainId: string,
    ): Promise<Option<string>> {
      const url = `https://connector.cordialapis.com/v1/chains/${chainId}?network=!mainnet`;
      const response = await fetch(url);
      if (!response.ok) {
        return undefined;
      }
      const chain = (await response.json()) as { network: string };
      return chain.network;
    }
    export async function testnetChainId(
      chainId: string,
    ): Promise<Option<string>> {
      const url = `https://connector.cordialapis.com/v1/chains/${chainId}?network=!mainnet`;
      const response = await fetch(url);
      if (!response.ok) {
        return undefined;
      }
      const chain = (await response.json()) as { chain_id: string };
      return chain.chain_id;
    }
  }

  export namespace propose {
    // const PUBLIC_PROPOSE = "https://treasury.cordialapis.com/v1/propose";
    const LOCAL_PROPOSE = "http://127.0.0.1:8777/v1/propose";
    export const PROPOSE_API = LOCAL_PROPOSE;
    const LOCAL: boolean = PROPOSE_API === LOCAL_PROPOSE;

    export async function executeSigned<T>(
      request: Request,
    ): Promise<Result<T>> {
      const login = await Login.load();
      if (!login) {
        return Err(notLoggedIn());
      }
      const config = await Config.load();
      if (!config) {
        return Err(notConfigured());
      }
      const prefix = "treasuries/";
      if (!config.treasury.name.startsWith(prefix)) {
        return Err(
          Error.invalidArgument(
            `invalid treasury name ${config.treasury.name}`,
          ),
        );
      }
      const treasuryId = config.treasury.name.slice(prefix.length);
      try {
        if (LOCAL) request.headers.set("user", login.userId);
        request = await sign("pro", login, request, treasuryId);
        const response = await fetch(request);

        if (!response.ok) {
          return Err(await response.json());
        }
        return Ok((await response.json()) as T);
      } catch (error) {
        return Err(Error.unknown(JSON.stringify(error)));
      }
    }

    export namespace chains {
      export namespace calls {
        export async function create(
          chain: string,
          call: T.Call,
        ): Promise<Result<string>> {
          const url = `${PROPOSE_API}/chains/${chain}/calls`;
          console.log(
            "proposed call:",
            JSON.stringify(superjson.serialize(call), null, 2),
          );
          const request = new Request(url, {
            method: "POST",
            body: JSON.stringify(call),
          });
          return executeSigned(request);
        }
      }
    }
  }

  export namespace treasury {
    export async function genericList<R>(
      path: string,
      plural: string,
      options?: ListOptions,
    ): Promise<Result<R[]>> {
      const config = await Config.load();
      if (!config) {
        return Err(Error.failedPrecondition("not configured"));
      }
      const url = `${config.treasury.url}v1/${path}`;
      return await apiList<R>(url, plural, options);
    }

    export async function get<T>(name: string): Promise<Result<T>> {
      const config = await Config.load();
      if (!config) {
        return Err(Error.failedPrecondition("not configured"));
      }
      const url = `${config.treasury.url}v1/${name}`;
      return await apiGet<T>(url);
    }

    export namespace chains {
      export namespace calls {
        export async function list(
          options?: ListOptions,
        ): Promise<Result<T.Call[]>> {
          return await genericList<T.Call>("calls", "calls", options);
        }
      }
    }
    export async function treasury(
      api: string,
      treasuryName: string,
    ): Promise<Option<T.Treasury>> {
      const url = `${api}v1/${treasuryName}`;
      // console.log("url:", url);
      const response = await fetch(url);
      if (!response.ok) {
        console.log("Failed to fetch treasury data", response);
        return undefined;
      }
      const treasury = (await response.json()) as T.Treasury;
      return treasury;
    }
  }
}
