// The API endpoints can be customized by creating an `.env` or `.env.local` file,
// and setting e.g.
// ```
// VITE_CONNECTOR_API=http://localhost:8080/
// VITE_PROPOSE_API=http://127.0.0.1:8777/
// ```

import { Config, Extension } from "./config";
import { Login } from "./login";
import { Error, Result } from "./sdk/error";
export { Error, Result } from "./sdk/error";
import { sign } from "./sdk/http_signature";
import { Err, None, Ok, Option } from "./types";

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

function headers(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  const config = Config.current();
  if (!config) return headers;
  headers.treasury = config.treasury.name.slice("treasuries/".length);
  return headers;
}

// All Cordial APIs work in this same way.
async function apiGet<R>(url: string): Promise<Result<R>> {
  try {
    const response = await fetch(url, { headers: headers() });
    if (!response.ok) {
      return Err((await response.json()) as Error);
    }
    return Ok((await response.json()) as R);
  } catch (error) {
    return Err(Error.unknown(`Could not GET ${url}: ${error}`));
  }
}

async function apiPut<R>(url: string, body: R): Promise<Result<unknown>> {
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return Err((await response.json()) as Error);
    }
    return Ok(await response.json());
  } catch (error) {
    return Err(Error.unknown(`Could not PUT ${url}: ${error}`));
  }
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
  try {
    const response = await fetch(url, { headers: headers() });
    if (!response.ok) {
      return Err((await response.json()) as Error);
    }
    // TODO: pagination
    const page = (await response.json()) as { [plural]: R[] };
    return Ok(page[plural]);
  } catch (error) {
    return Err(Error.unknown(`Could not LIST ${url}: ${error}`));
  }
}

export namespace Sdk {
  export namespace admin {
    export const API: string = "https://admin.cordialapis.com/";

    async function genericGet<R>(name: string): Promise<Result<R>> {
      const url = `${API}v1/${name}`;
      return await apiGet<R>(url);
    }

    async function genericPut<R>(
      name: string,
      resource: R,
    ): Promise<Result<unknown>> {
      const url = `${API}v1/${name}`;
      console.log(`putting ${url} to`, resource);
      return await apiPut<R>(url, resource);
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

        export async function set(
          userId: string,
          config: A.ExtensionConfig,
        ): Promise<Result<unknown>> {
          const name = `users/${userId}/extension`;
          const extensionResult = await get(userId);
          if (!extensionResult.ok) return extensionResult;
          const extension = extensionResult.value;
          extension.config = config;
          return await genericPut(name, extension);
        }

        // syntactic sugar
        export async function maybe(userId: string): Promise<Option<Config>> {
          const result = await get(userId);
          if (!result.ok) {
            // console.log("didn't get extension:", result);
            return None;
          }
          const extension = result.value as Extension;
          // console.log("extension:", extension);
          return extension.config;
        }
      }
    }
  }

  export namespace connector {
    const _API: string = "https://connector.cordialapis.com/";
    export const API: boolean = import.meta.env.VITE_CONNECTOR_API ?? _API;

    export async function blockNumber(
      chainId: string,
      mainnet: boolean,
    ): Promise<Option<string>> {
      // TODO: handle mainnet vs testnet
      let url = `${API}v1/chains/${chainId}/block`;
      if (!mainnet) {
        url += "?network=testnet";
      }
      const response = await fetch(url);
      if (!response.ok) return None;
      const chain = (await response.json()) as { height: string };
      return chain.height;
    }
    export async function testnetChainNetwork(
      chainId: string,
    ): Promise<Option<string>> {
      const url = `${API}v1/chains/${chainId}?network=!mainnet`;
      let response: Response;
      try {
        response = await fetch(url);
      } catch (error) {
        console.log(error);
        return None;
      }

      if (!response.ok) return None;
      const chain = (await response.json()) as { network: string };
      return chain.network;
    }
    export async function testnetChainId(
      chainId: string,
    ): Promise<Option<string>> {
      const url = `${API}v1/chains/${chainId}?network=!mainnet`;
      const response = await fetch(url);
      if (!response.ok) return None;
      const chain = (await response.json()) as { chain_id: string };
      return chain.chain_id;
    }
  }

  export namespace propose {
    const _API = "https://treasury.cordialapis.com/";
    export const API: boolean = import.meta.env.VITE_PROPOSE_API ?? _API;

    export async function executeSigned<T>(
      request: Request,
    ): Promise<Result<T>> {
      const login = await Login.load();
      if (!login) {
        return Err(notLoggedIn());
      }
      const config = Config.current();
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
        request.headers.set("user", login.userId);
        request = await sign("sso", login, request, treasuryId);
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
        export async function create(call: T.Call): Promise<Result<string>> {
          const url = `${API}v1/propose/calls`;
          // console.log(
          //   "proposed call:",
          //   JSON.stringify(superjson.serialize(call ?? null), null, 2),
          // );
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
    function notConfigured(): Err<Error> {
      return Err(Error.failedPrecondition("not configured"));
    }

    export async function genericList<R>(
      path: string,
      plural: string,
      options?: ListOptions,
    ): Promise<Result<R[]>> {
      const config = Config.current();
      if (!config) return notConfigured();
      const url = `${config.treasury.url}v1/${path}`;
      return await apiList<R>(url, plural, options);
    }

    export async function get<T>(name: string): Promise<Result<T>> {
      const config = Config.current();
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

    export async function treasury(): Promise<Result<T.Treasury>> {
      const config = Config.current();
      if (!config) return notConfigured();
      return get<T.Treasury>(config.treasury.name);
    }
  }
}
