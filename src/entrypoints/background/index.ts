import { hex } from "@scure/base";
import {
  cryptoBoxKeyPair,
  cryptoBoxOpenEasy,
} from "@serenity-kit/noble-sodium";

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });

	const COLOR = {
	    16: '/icons/16.png',
	    24: '/icons/24.png',
	    48: '/icons/48.png',
	    128: '/icons/128.png',
	};
	const GRAY = {
	    16: '/icons/gray/16.png',
	    24: '/icons/gray/24.png',
	    48: '/icons/gray/48.png',
	    128: '/icons/gray/128.png',
	};
  (browser.action ?? browser.browserAction).onClicked.addListener(
    async (tab) => {
      console.log("browser action triggered,", tab);
      
      //1. prepare request and identity keys
      let ed255 =  await crypto.subtle.generateKey("Ed25519", false, ["sign", "verify"]);
      console.log("ed255:", ed255);
      let ed255_pub = new Uint8Array(await crypto.subtle.exportKey("raw", ed255.publicKey));

    const x255 = cryptoBoxKeyPair();
    const x255_sec = x255.privateKey;
    const x255_pub = x255.publicKey;

    const key = hex.encode(ed255_pub);
    const request = hex.encode(x255_pub);

    // 2. have the user login
    let url = `https://auth.cordial.systems/login/flow?key=ed25519.${key}&request=${request}`;

      browser.tabs.create({ url });
    url = `https://auth.cordial.systems/login/get-access?request=${request}`;

	    // 3. fetch access token response
	let boxed;
    do {
      let response = await fetch(url);
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
    } while (true);
    console.log("boxed:", boxed);
      const publicKey = new Uint8Array(boxed.public_key);
      const nonce = new Uint8Array(boxed.nonce);
      const ciphertext = new Uint8Array(boxed.cipher);

      const access_token = new TextDecoder().decode(cryptoBoxOpenEasy({
        ciphertext,
        nonce,
        publicKey,
        privateKey: x255_sec,
      }));
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

      url = 'https://admin.cordialapis.com/v1/users';
      response = await fetch(url, { credentials: "include" });
      let users = await response.text();
      console.log("users", users);

      // if (tab.id) {
      //   await browser.tabs.sendMessage(tab.id, { type: "MOUNT_UI" });
      // }
    },
  );
});
