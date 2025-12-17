import { hex } from "@scure/base";
import {
  cryptoBoxKeyPair,
  cryptoBoxOpenEasy,
} from "@serenity-kit/noble-sodium";

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });

  const COLOR = {
    16: "/icons/16.png",
    24: "/icons/24.png",
    48: "/icons/48.png",
    128: "/icons/128.png",
  };
  // const GRAY = {
  //   16: "/icons/gray/16.png",
  //   24: "/icons/gray/24.png",
  //   48: "/icons/gray/48.png",
  //   128: "/icons/gray/128.png",
  // };
  (browser.action ?? browser.browserAction).onClicked.addListener(
    async (tab) => {
      console.log("browser action triggered,", tab);

      //1. prepare request and identity keys
      const ed255 = await crypto.subtle.generateKey("Ed25519", false, [
        "sign",
        "verify",
      ]);
      console.log("ed255:", ed255);

      const x255 = cryptoBoxKeyPair();

      const key = hex.encode(
        new Uint8Array(await crypto.subtle.exportKey("raw", ed255.publicKey)),
      );
      const request = hex.encode(x255.publicKey);

      // 2. have the user login
      let url = `https://auth.cordial.systems/login/flow?key=ed25519.${key}&request=${request}`;

      browser.tabs.create({ url });
      url = `https://auth.cordial.systems/login/get-access?request=${request}`;

      // 3. fetch access token response
      let boxed;
      while (true) {
        const response = await fetch(url);
        if (!response.ok) {
          await setTimeout(() => {}, 1000);
          continue;
        }
        boxed = (await response.json()) as {
          public_key: number[];
          nonce: number[];
          cipher: number[];
        };
        break;
      }
      console.log("boxed:", boxed);

      const access_token = new TextDecoder().decode(
        cryptoBoxOpenEasy({
          ciphertext: new Uint8Array(boxed.cipher),
          nonce: new Uint8Array(boxed.nonce),
          publicKey: new Uint8Array(boxed.public_key),
          privateKey: x255.privateKey,
        }),
      );
      console.log("access-token", access_token);

      // 4. set cookie
      url = `https://auth.cordialapis.com/login/set-cookie?access_token=${access_token}`;
      let response = await fetch(url, { credentials: "include" });
      console.log(response);

      // url = `https://auth.cordial.systems/login/set-cookie?access_token=${access_token}`;
      // let response = await fetch(url, { credentials: "include" });
      // console.log(response);

      if (response.ok) {
        await browser.action.setIcon({
          path: COLOR,
        });
      }

      url = "https://admin.cordialapis.com/v1/users";
      response = await fetch(url, { credentials: "include" });
      const users = await response.text();
      console.log("users", users);

      // if (tab.id) {
      //   await browser.tabs.sendMessage(tab.id, { type: "MOUNT_UI" });
      // }
    },
  );
});
