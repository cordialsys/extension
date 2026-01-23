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

import { solRequest } from "@/lib/relay";
import { Option, Sol } from "@/lib/types";

// import { PublicKey } from "@solana/web3.js";
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
  "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgNDQgNDQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgc3R5bGU9ImZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDoyO2JhY2tncm91bmQtY29sb3I6I2ZmZiI+PHBhdGggZD0iTTIwLjQ2OSAzMC44MDJjNS43MDcgMCAxMC4zMzMtNC42MjYgMTAuMzMzLTEwLjMzM3MtNC42MjYtMTAuMzM0LTEwLjMzMy0xMC4zMzRjLTUuNzA4IDAtMTAuMzM0IDQuNjI3LTEwLjMzNCAxMC4zMzRzNC42MjYgMTAuMzMzIDEwLjMzNCAxMC4zMzNtMCAzLjljNy44NiAwIDE0LjIzMy02LjM3MiAxNC4yMzMtMTQuMjMzUzI4LjMyOSA2LjIzNiAyMC40NjkgNi4yMzYgNi4yMzUgMTIuNjA4IDYuMjM1IDIwLjQ2OXM2LjM3MyAxNC4yMzMgMTQuMjM0IDE0LjIzMyIgc3R5bGU9ImZpbGw6IzM3M2QzZCIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMi4xNDEgMS41MzEpIi8+PHBhdGggZD0ibTIzLjkwNC4yOC0uNjQzIDMuODQ2YTE2LjggMTYuOCAwIDAgMC01LjUxNyAwTDE3LjEwMS4yOGEyMC43IDIwLjcgMCAwIDEgNi44MDMgME0xMy4zMzYgMS4yODVsMS4zNjUgMy42NTNhMTYuNiAxNi42IDAgMCAwLTQuNzY0IDIuNzUxTDcuNDQ5IDQuNjg0YTIwLjUgMjAuNSAwIDAgMSA1Ljg4Ny0zLjM5OU00LjY5MiA3LjQzNmwzLjAxIDIuNDg0YTE2LjYgMTYuNiAwIDAgMC0yLjc1NiA0Ljc1N2wtMy42NTgtMS4zNjNhMjAuNCAyMC40IDAgMCAxIDMuNDA0LTUuODc4TS4yODEgMTcuMDczQTIwLjUgMjAuNSAwIDAgMCAwIDIwLjQ2OXEuMDAyIDEuNzM3LjI4MSAzLjM5NmwzLjg1Mi0uNjQyYTE2LjYgMTYuNiAwIDAgMS0uMjI4LTIuNzU0cS4wMDEtMS40MTMuMjI4LTIuNzU0em0xLjAwNyAxMC41NTEgMy42NTgtMS4zNjNhMTYuNiAxNi42IDAgMCAwIDIuNzU2IDQuNzU2bC0zLjAxIDIuNDg0YTIwLjQgMjAuNCAwIDAgMS0zLjQwNC01Ljg3N202LjE2MSA4LjYyOSAyLjQ4OC0zLjAwNWExNi42IDE2LjYgMCAwIDAgNC43NjQgMi43NTFsLTEuMzY1IDMuNjUzYTIwLjUgMjAuNSAwIDAgMS01Ljg4Ny0zLjM5OW05LjY1MiA0LjQwNC42NDMtMy44NDVhMTYuOCAxNi44IDAgMCAwIDUuNTE3IDBsLjY0MyAzLjg0NWEyMC42IDIwLjYgMCAwIDEtMy40MDEuMjgxYy0xLjE1OSAwLTIuMjk2LS4wOTYtMy40MDItLjI4MW0xMC41NjktMS4wMDUtMS4zNjYtMy42NTNhMTYuNiAxNi42IDAgMCAwIDQuNzY0LTIuNzUxbDIuNDg5IDMuMDA1YTIwLjUgMjAuNSAwIDAgMS01Ljg4NyAzLjM5OW04LjY0My02LjE1MS0zLjAxLTIuNDg0YTE2LjYgMTYuNiAwIDAgMCAyLjc1Ni00Ljc1NmwzLjY1OSAxLjM2M2EyMC41IDIwLjUgMCAwIDEtMy40MDUgNS44NzciIHN0eWxlPSJmaWxsOiNkNzNkNzQiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDIuMTQxIDEuNTMxKSIvPjwvc3ZnPg==";

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

  const pubKey = new Uint8Array(); //Array.from(new PublicKey(addr).toBytes()));
  return Sol.Account.new(addr, pubKey, [chain], features);
}

export class Solana implements Wallet {
  #accounts: Sol.Account[] = [];
  // Using Set<EventsListeners[E]> instead of arrays
  // has its own downsides, like no `.filter` method.
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

  // constructor() {
  //   // console.log("constructor this", this);
  // }

  async start(this: Solana) {
    console.log("Initializing Cordial Solana Provider");
    try {
      const config = (await solRequest("cordial:config")) as Option<Sol.Config>;
      console.log("Initial SVM config", config);
      if (!config) return;

      this.#accounts = config.addresses.map((a) =>
        newAccount(config.chain as IdentifierString, a),
      );

      // TODO: only announce if origin is allowed
      // and we have an address (e.g. Orca totally ignores us if there are no addresses)
      this.announce();
    } catch (error) {
      console.error(`configuration error: ${error}`);
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
    this.listeners[event]?.forEach((listener) => {
      // eslint-disable-next-line prefer-spread
      listener.apply(null, args);
    });
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
    return solRequest("solana:signIn", inputs) as Promise<SignInOutput[]>;
  }

  async signMessage(
    ...inputs: SignMessageInput[]
  ): Promise<SignMessageOutput[]> {
    return solRequest("solana:signMessage", inputs) as Promise<
      SignMessageOutput[]
    >;
  }

  async signAndSendTransaction(
    ...inputs: SignAndSendTransactionInput[]
  ): Promise<SignAndSendTransactionOutput[]> {
    return solRequest("solana:signAndSendTransaction", inputs) as Promise<
      SignAndSendTransactionOutput[]
    >;
  }

  async signTransaction(
    ...inputs: SignTransactionInput[]
  ): Promise<SignTransactionOutput[]> {
    return solRequest("solana:signTransaction", inputs) as Promise<
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
