# company-owned devices have locked down extensions
dev:
	pnpm run dev:chromium

build:
	pnpm run build

feedback:
	watchexec -r -w src/ "clear && pnpm run typecheck && pnpm dlx --package jiti eslint src"

fmt:
	pnpm exec prettier . --write

lint:
	pnpm exec prettier . --check
	pnpm run typecheck
	pnpm dlx --package jiti eslint src

# configures Edge at Mosyle-installed location
setup-mac: install
	ln -sf web-ext.config.mac.ts web-ext.config.ts

# configures Edge for `microsoft-edge-stable-bin` AUR package
setup-arch: install
	ln -sf web-ext.config.arch.ts web-ext.config.ts

install:
	pnpm install
