import { onClicked } from "@/lib/click";
import { Config } from "@/lib/config";
import { Login } from "@/lib/login";
import { onMessage, Port } from "@/lib/handler";

// figure out what state we're in, and ensure the keys
// - on
// - login
// - ...
// are setup
async function init() {
  const attach = globalThis as unknown as { cordial: unknown };
  attach.cordial = {
    Config,
    Login,
  };
  await Config.init();
  await Login.init();
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
  // browser.sidePanel
  //   .setPanelBehavior({ openPanelOnActionClick: true })
  //   .catch((error) => console.error(error));
}

export default defineBackground(() => {
  console.log("♥️ Running the Cordial Extension", browser.runtime.id);

  background();
});
