import { Config, Extension } from "./config";
import { Login } from "./login";
import { sign } from "./sdk/http_signature";
import { Err, Ok, Option, Result } from "./types";

import type { CallT, TreasuryT } from "./sdk/treasury";

export namespace Sdk {
  export namespace admin {
    export function users(): unknown[] {
      return [];
    }
    export namespace users {
      export async function extension(userId: string): Promise<Option<Config>> {
        const url = `https://admin.cordialapis.com/v1/users/${userId}/extension`;
        const response = await fetch(url);
        if (!response.ok) {
          return undefined;
        }
        const extension = (await response.json()) as Extension;
        return extension.config;
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
    export const PROPOSE_API = "https://treasury.cordialapis.com/v1/propose";
    // export const PROPOSE_API = "http://127.0.0.1:8777/v1/propose";

    export async function executeSigned<T>(
      request: Request,
    ): Promise<Result<T>> {
      const login = await Login.load();
      if (!login) {
        return Err("not logged in");
      }
      const config = await Config.load();
      if (!config) {
        return Err("not configured");
      }
      const prefix = "treasuries/";
      if (!config.treasury.name.startsWith(prefix)) {
        return Err("invalid treasury name");
      }
      const treasuryId = config.treasury.name.slice(prefix.length);
      try {
        request = await sign("pro", login, request, treasuryId);
        const response = await fetch(request);

        if (!response.ok) {
          return Err(await response.json());
        }
        return Ok((await response.json()) as T);
      } catch (error) {
        return Err(error);
      }
    }

    export namespace call {
      export async function create(
        chain: string,
        call: CallT,
      ): Promise<Result<string>> {
        const url = `${PROPOSE_API}/chains/${chain}/calls`;
        const request = new Request(url, {
          method: "POST",
          body: JSON.stringify(call),
        });
        return executeSigned(request);
      }
    }
  }

  export namespace treasury {
    export async function treasury(
      api: string,
      treasuryName: string,
    ): Promise<Option<TreasuryT>> {
      const url = `${api}v1/${treasuryName}`;
      // console.log("url:", url);
      const response = await fetch(url);
      if (!response.ok) {
        console.log("Failed to fetch treasury data", response);
        return undefined;
      }
      const treasury = (await response.json()) as TreasuryT;
      return treasury;
    }
  }
}
