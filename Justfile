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

api-gen project api:
	pnpm dlx openapi-typescript https://api.stoplight.io/projects/{{ project }}/branches/main/export/reference/{{ api }}.yaml -o src/lib/sdk/{{ api }}.d.ts

api-types:
    just api-gen cHJqOjIzOTcxNQ admin
    just api-gen cHJqOjIzOTcxOA connector
    just api-gen cHJqOjIzOTcxOQ oracle
    just api-gen cHJqOjIzOTcxNw treasury

# configures Edge at Mosyle-installed location
setup-mac: install
	ln -sf web-ext.config.mac.ts web-ext.config.ts

# configures Edge for `microsoft-edge-stable-bin` AUR package
setup-arch: install
	ln -sf web-ext.config.arch.ts web-ext.config.ts

install:
	pnpm install
