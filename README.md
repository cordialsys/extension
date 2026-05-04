# Cordial Treasury Browser Wallet Extension

Designed to integrate seamlessly with Cordial Treasury's ecosystem.

## Developers

Environment variables are loaded via Vite/WXT (`.env`, with `.env.local` overriding).

- `VITE_UI`
  Side panel iframe base URL (this should end with a trailing slash `/`).
  Default: `https://treasury.cordial.systems/`
- `VITE_CONNECTOR_API`
  Connector API base URL used by extension chain/network helpers.
  Default: `https://connector.cordialapis.com/`
- `VITE_PROPOSE_API`
  Propose API base URL used for creating calls/proposals.
  Default: `https://treasury.cordialapis.com/`
- `VITE_MAINNET_ONLY`
  Restricts extension behavior to mainnet-only mode when truthy.
  Default: `false`

## Releasing

- bump version in `package.json`
- run `just zip` and `just tag`
- publish `.output/cordial-treasury-browser-wallet-extension-{{ version }}-chrome.zip` on Chrome Web Store
- turn the tag into a release on <https://github.com/cordialsys/extension/releases/new>, uploading the ZIP file (use the release notes generator)
