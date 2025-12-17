(function () {
  const connectBtn = document.getElementById("connectBtn");
  const connectStatus = document.getElementById("connectStatus");
  const transferSection = document.getElementById("transfer-section");
  const sendBtn = document.getElementById("sendBtn");

  const from = document.getElementById("from");
  const to = document.getElementById("to");
  const asset = document.getElementById("asset");
  const amount = document.getElementById("amount");
  const resultBox = document.getElementById("resultBox");
  const resultPre = document.getElementById("resultPre");

  const TARGET_TO_PAGE = "defi_page";

  function formatMaybeJson(x) {
    if (x == null) return String(x);
    if (typeof x === "string") {
      try {
        return JSON.stringify(JSON.parse(x), null, 2);
      } catch {}
      return x;
    }
    try {
      return JSON.stringify(x, null, 2);
    } catch {
      return String(x);
    }
  }

  function showResult(text) {
    if (resultPre) resultPre.textContent = text;
    if (resultBox) resultBox.classList.remove("hidden");
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.target !== TARGET_TO_PAGE) return;

    if (data.type === "connected") {
      connectStatus.textContent =
        "Connected. window.ethereum is now available on this page.";
      transferSection.classList.remove("hidden");
    } else if (data.type === "connect_result") {
      if (!data.approved) {
        connectStatus.textContent = "Connection was denied.";
        transferSection.classList.add("hidden");
      }
    } else if (data.type === "provider_response") {
      // not expected here (the inpage/provider handles resolve), but keep for completeness
    }
  });

  connectBtn.addEventListener("click", () => {
    window.postMessage({ target: "defi_extension", type: "connect" }, "*");
  });

  sendBtn.addEventListener("click", async () => {
    showResult("Sending transfer...");
    try {
      if (!window.ethereum || typeof window.ethereum.request !== "function") {
        showResult("Provider is not injected. Please connect first.");
        return;
      }
      const body = {
        from: from.value,
        to: to.value,
        asset: asset.value,
        amount: amount.value,
      };
      const res = await window.ethereum.request({
        method: "defi_sendTransfer",
        params: body,
      });
      showResult(formatMaybeJson(res));
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      showResult("Error: " + msg);
    }
  });
})();
