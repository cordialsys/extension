import { COLOR } from "@/lib/constants";
import { onClicked } from "@/lib/click";
import { Config } from "@/lib/config";
import { Login, /*loginFirstName,*/ showOff } from "@/lib/login";
import { onMessage, Port } from "@/lib/handler";

// figure out what state we're in, and ensure the keys
// - on
// - login
// - ...
// are setup
async function init() {
  // start tracking config (whether or not we're logged in)
  await Config.init();
  Config.track();

  // check if we're logged in
  const login = await Login.load();
  if (!login) return await showOff();

  // stay logged in (once triggered by click on extension icon)
  setTimeout(Login.track, 5 * 1000);

  // const firstName = await loginFirstName(login);
  // console.log(`👋 Welcome back, ${firstName}`);

  await browser.action.setIcon({ path: COLOR });
}

async function background() {
  Config.addContextMenu();
  browser.runtime.onConnect.addListener(Port.set);
  await init();
  browser.action.onClicked.addListener(onClicked);
  browser.runtime.onMessage.addListener(onMessage);
  browser.contextMenus.onClicked.addListener(Config.onContextMenu);
  browser.notifications.onButtonClicked.addListener(
    Config.onNotificationButtonClicked,
  );
}

export default defineBackground(() => {
  console.log("♥️ Running the Cordial Extension", browser.runtime.id);

  setTimeout(background, 0);
});
