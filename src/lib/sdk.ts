import { Config, Extension } from "./config";
import { Option } from "./types";

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

  export namespace oracle {
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
  }

  export namespace treasury {
    export interface Treasury {
      name: string;
      network: "mainnet" | "!mainnet";
    }
    export async function treasury(
      api: string,
      treasuryName: string,
    ): Promise<Option<Treasury>> {
      const url = `${api}v1/${treasuryName}`;
      console.log("url:", url);
      const response = await fetch(url);
      if (!response.ok) {
        console.log("Failed to fetch treasury data", response);
        return undefined;
      }
      const treasury = (await response.json()) as Treasury;
      return treasury;
    }
  }
}
