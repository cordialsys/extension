# company-owned devices have locked down extensions
dev:
	pnpm run dev:edge

build:
	pnpm run build

zip:
	pnpm run zip

feedback:
	watchexec -r -w src/ "clear && pnpm run typecheck && pnpm dlx --package jiti eslint src"

fmt:
	pnpm exec prettier . --write

lint:
	pnpm exec prettier . --check
	pnpm run typecheck
	pnpm dlx --package jiti eslint src

test:
    pnpm run test

api-gen project api:
	pnpm dlx openapi-typescript \
	    https://api.stoplight.io/projects/{{ project }}/branches/main/export/reference/{{ api }}.yaml \
	    -o src/lib/sdk/{{ api }}.d.ts \
		--alphabetize \
		--empty-objects-unknown \
		--root-types \
		--root-types-no-schema-prefix

api:
    just api-gen cHJqOjIzOTcxNQ admin
    just api-gen cHJqOjIzOTcxOA connector
    just api-gen cHJqOjIzOTcxOQ oracle
    just api-gen cHJqOjIzOTcxNw treasury
    just fmt

# configures Edge at Mosyle-installed location
setup-mac: pnpm-install
	ln -sf web-ext.config.mac.ts web-ext.config.ts

# configures Edge for `microsoft-edge-stable-bin` AUR package
setup-arch: pnpm-install
	ln -sf web-ext.config.arch.ts web-ext.config.ts

pnpm-install:
	pnpm install
