// Copyright 2025 Cordial Systems, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the “Software”), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
// IN THE SOFTWARE.

import { solRequest } from "./relay";
import { Sol } from "./types";

import { PublicKey } from "@solana/web3.js";
import type {
  IdentifierString,
  Wallet,
  WalletIcon,
  WalletEventsWindow,
  WindowRegisterWalletEventCallback as Callback,
} from "@wallet-standard/base";

import {
  StandardConnect as Connect,
  StandardDisconnect as Disconnect,
  StandardEvents as Events,
  type StandardConnectFeature,
  type StandardDisconnectFeature,
  type StandardEventsFeature,
  // type StandardConnectMethod as ConnectMethod,
  type StandardConnectInput as ConnectInput,
  type StandardConnectOutput as ConnectOutput,
  // type StandardDisconnectMethod as DisconnectMethod,
  type StandardEventsOnMethod as EventsOnMethod,
  type StandardEventsListeners as EventsListeners,
  type StandardEventsNames as EventsNames,
} from "@wallet-standard/features";

import {
  SolanaSignAndSendTransaction as SignAndSendTransaction,
  type SolanaSignAndSendTransactionFeature,
  type SolanaSignAndSendTransactionInput as SignAndSendTransactionInput,
  type SolanaSignAndSendTransactionOutput as SignAndSendTransactionOutput,
  // type SolanaSignAndSendTransactionMethod as SignAndSendTransactionMethod,
  SolanaSignIn as SignIn,
  type SolanaSignInFeature,
  type SolanaSignInInput as SignInInput,
  type SolanaSignInOutput as SignInOutput,
  // type SolanaSignInMethod as SignInMethod,
  SolanaSignMessage as SignMessage,
  type SolanaSignMessageFeature,
  type SolanaSignMessageInput as SignMessageInput,
  type SolanaSignMessageOutput as SignMessageOutput,
  // type SolanaSignMessageMethod as SignMessageMethod,
  SolanaSignTransaction as SignTransaction,
  type SolanaSignTransactionFeature,
  type SolanaSignTransactionInput as SignTransactionInput,
  type SolanaSignTransactionOutput as SignTransactionOutput,
  // type SolanaSignTransactionMethod as SignTransactionMethod,
} from "@solana/wallet-standard-features";

const ICON: WalletIcon =
  `data:image/svg+xml;base64,PHN2ZyBlbmFibGUtYmFja2dyb3VuZD0ibmV3IDAgMCAyODAuMTczIDI4MC4xNzMiIHZpZXdCb3g9IjAgMCAyODAuMTczIDI4MC4xNzMiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0ibTEzMy45NjEuMTQ1Yy03MC44ODIgMy41LTEyNS4xMzcgNjMuODgxLTEyNS4xMzcgMTM0Ljc2M3Y2Ni41MDYgNjUuNjMxYzAgNi4xMjYgNi4xMjYgOS42MjYgMTEuMzc2IDYuMTI2bDIwLjEyNy0xMi4yNTFjNy44NzYtNC4zNzUgMTcuNTAyLTQuMzc1IDI1LjM3NyAwbDE4LjM3NyAxMC41MDFjNy44NzYgNC4zNzUgMTcuNTAyIDQuMzc1IDI1LjM3NyAwbDE4LjM3Ny0xMC41MDFjNy44NzYtNC4zNzUgMTcuNTAyLTQuMzc1IDI1LjM3NyAwbDE4LjM3NyAxMC41MDFjNy44NzYgNC4zNzUgMTcuNTAyIDQuMzc1IDI1LjM3NyAwbDE4LjM3Ny0xMC41MDFjNy44NzYtNC4zNzUgMTcuNTAyLTQuMzc1IDI1LjM3NyAwbDE5LjI1MiAxMS4zNzZjNS4yNTEgMi42MjUgMTEuMzc2LS44NzUgMTEuMzc2LTYuMTI2IDAtMTguMzc3IDAtNTAuNzU1IDAtNjUuNjMxdi03MC4wMDdjLjAwMS03My41MDctNjIuMTMtMTMzLjg4Ny0xMzcuMzg3LTEzMC4zODd6IiBmaWxsPSIjZTI1NzRjIi8+PHBhdGggZD0ibTI2LjMyNSAxMzEuNDA4YzAtNjkuMTMyIDU0LjI1NS0xMjYuMDEyIDEyMi41MTItMTMxLjI2My0yLjYyNSAwLTYuMTI2IDAtOC43NTEgMC03Mi42MzIgMC0xMzEuMjYyIDU4LjYzMS0xMzEuMjYyIDEzMS4yNjN2MTQ4Ljc2NWM3Ljg3NiAwIDEzLjEyNi0zLjUgMTcuNTAyLTcuODc2LS4wMDEtMTUuNzUyLS4wMDEtMTQwLjg4OS0uMDAxLTE0MC44ODl6IiBmaWxsPSIjZDI1MTQ3Ii8+PHBhdGggZD0ibTE4OC4yMTYgMTEzLjkwNmMtMTYuNjI3IDAtMzAuNjI4IDE0LjAwMS0zMC42MjggMzAuNjI4czE0LjAwMSAzMC42MjggMzAuNjI4IDMwLjYyOCAzMC42MjgtMTQuMDAxIDMwLjYyOC0zMC42MjgtMTQuMDAxLTMwLjYyOC0zMC42MjgtMzAuNjI4em0tOTYuMjU5IDBjLTE2LjYyNyAwLTMwLjYyOCAxNC4wMDEtMzAuNjI4IDMwLjYyOHMxNC4wMDEgMzAuNjI4IDMwLjYyOCAzMC42MjggMzAuNjI4LTE0LjAwMSAzMC42MjgtMzAuNjI4LTE0LjAwMi0zMC42MjgtMzAuNjI4LTMwLjYyOHoiIGZpbGw9IiNlNGU3ZTciLz48cGF0aCBkPSJtMTg4LjIxNiAxMzEuNDA4Yy03LjAwMSAwLTEzLjEyNiA2LjEyNi0xMy4xMjYgMTMuMTI2IDAgNy4wMDEgNi4xMjYgMTMuMTI2IDEzLjEyNiAxMy4xMjZzMTMuMTI2LTYuMTI2IDEzLjEyNi0xMy4xMjZjMC03LjAwMS02LjEyNS0xMy4xMjYtMTMuMTI2LTEzLjEyNnptLTk2LjI1OSAwYy03LjAwMSAwLTEzLjEyNiA2LjEyNi0xMy4xMjYgMTMuMTI2IDAgNy4wMDEgNi4xMjYgMTMuMTI2IDEzLjEyNiAxMy4xMjYgNy4wMDEgMCAxMy4xMjYtNi4xMjYgMTMuMTI2LTEzLjEyNiAwLTcuMDAxLTYuMTI2LTEzLjEyNi0xMy4xMjYtMTMuMTI2eiIgZmlsbD0iIzMyNGQ1YiIvPjwvc3ZnPg==` as const;

type Features = StandardConnectFeature &
  StandardDisconnectFeature &
  StandardEventsFeature &
  SolanaSignAndSendTransactionFeature &
  SolanaSignTransactionFeature &
  SolanaSignMessageFeature &
  SolanaSignInFeature;

function newAccount(chain: IdentifierString, addr: string): Sol.Account {
  const features: IdentifierString[] = [
    SignIn,
    SignMessage,
    SignAndSendTransaction,
    SignTransaction,
  ];

  const pubKey = new Uint8Array(Array.from(new PublicKey(addr).toBytes()));
  return Sol.AccountNew.new(addr, pubKey, [chain], features);
}

export class Solana implements Wallet {
  #accounts: Sol.Account[] = [];
  listeners: { [E in EventsNames]?: EventsListeners[E][] } = {};

  chains = Sol.CHAINS.slice();
  icon: WalletIcon = ICON;
  name: string = "Cordial Wallet (SOL)";
  version = "1.0.0" as const;

  get accounts() {
    return this.#accounts;
  }

  get features(): Features {
    const version = "1.0.0" as const;
    const supportedTransactionVersions = ["legacy" as const, 0 as const];
    const features: Features = {
      [Connect]: { version, connect: this.connect },
      [Disconnect]: { version, disconnect: this.disconnect },
      [Events]: { version, on: this.on },
      [SignIn]: { version, signIn: this.signIn },
      [SignMessage]: { version, signMessage: this.signMessage },
      [SignAndSendTransaction]: {
        version,
        signAndSendTransaction: this.signAndSendTransaction,
        supportedTransactionVersions,
      },
      [SignTransaction]: {
        version,
        signTransaction: this.signTransaction,
        supportedTransactionVersions,
      },
    };
    return features;
  }

  constructor() {
    // console.log("constructor this", this);
  }

  async start(this: Solana) {
    console.log("Initializing Cordial Solana Provider");
    // console.log(await solRequest("cordial_ping"));
    try {
      const changes = (await solRequest("cordial_preconnect")) as Sol.Changes;
      // console.log("preconnect response:", changes);
      this.#accounts = changes.addresses.map((a) =>
        newAccount(changes.chain as IdentifierString, a),
      );

      // TODO: only announce if origin is allowed
      // and we have an address (e.g. Orca totally ignores us if there are no addresses)
      this.announce();
    } catch (error) {
      console.error(`preconnect error: ${error}`);
    }
  }

  announce(this: Solana) {
    console.log("Announcing Cordial Solana Provider");
    const win = window as WalletEventsWindow;

    const callback: Callback = ({ register }) => {
      // console.log("callback called with this = ", this);
      register(this);
    };
    const event = new Sol.RegisterWalletEvent(callback);
    try {
      win.dispatchEvent(event);
    } catch (error) {
      console.error(
        "wallet-standard:register-wallet event could not be dispatched\n",
        error,
      );
    }

    try {
      win.addEventListener("wallet-standard:app-ready", ({ detail: api }) => {
        console.log("calling callback on app-ready event");
        callback(api);
      });
    } catch (error) {
      console.error(
        "wallet-standard:app-ready event listener could not be added\n",
        error,
      );
    }

    console.log("📢 Announced Cordial Solana provider");
  }

  emit<E extends EventsNames>(
    event: E,
    ...args: Parameters<EventsListeners[E]>
  ) {
    // eslint-disable-next-line prefer-spread
    this.listeners[event]?.forEach((listener) => listener.apply(null, args));
  }

  on: EventsOnMethod = (event, listener) => {
    console.log("Cordial Solana on event", event);
    const listeners = this.listeners[event];
    if (listeners) {
      if (!listeners.includes(listener)) listeners.push(listener);
    } else {
      this.listeners[event] = [listener];
    }
    // console.log("listeners after", this.listeners);
    return () => this.off(event, listener);
  };

  off<E extends EventsNames>(event: E, listener: EventsListeners[E]) {
    console.log("Cordial Solana off");
    const list = this.listeners[event];
    if (!list) return;
    this.listeners[event] = list.filter((existing) => listener !== existing);
  }

  async signIn(...inputs: SignInInput[]): Promise<SignInOutput[]> {
    return solRequest("sol_signIn", inputs) as Promise<SignInOutput[]>;
  }

  async signMessage(
    ...inputs: SignMessageInput[]
  ): Promise<SignMessageOutput[]> {
    return solRequest("sol_signMessage", inputs) as Promise<
      SignMessageOutput[]
    >;
  }

  async signAndSendTransaction(
    ...inputs: SignAndSendTransactionInput[]
  ): Promise<SignAndSendTransactionOutput[]> {
    return solRequest("sol_signAndSendTransaction", inputs) as Promise<
      SignAndSendTransactionOutput[]
    >;
  }

  async signTransaction(
    ...inputs: SignTransactionInput[]
  ): Promise<SignTransactionOutput[]> {
    return solRequest("sol_signTransaction", inputs) as Promise<
      SignTransactionOutput[]
    >;
  }

  async connect(input?: ConnectInput): Promise<ConnectOutput> {
    return solRequest("standard_connect", input) as Promise<ConnectOutput>;
  }

  async disconnect() {
    console.log("Cordial Solana disconnect");
    await solRequest("standard_disconnect");
    if (this.accounts) {
      this.#accounts = [];
      this.emit("change", { accounts: [] });
    }
  }
}
