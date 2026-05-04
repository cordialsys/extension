version := `pnpm ls --long|rg cordial|sed -E 's/^.*@([0-9]+\.[0-9]+\.[0-9]+).*$/\1/'`

# company-owned devices have locked down extensions
dev:
	pnpm run dev

build:
	pnpm run build

version:
	echo {{ version }}

zip:
	pnpm run zip

fmt:
	pnpm format:fix

lint:
	pnpm run typecheck
	pnpm run lint
	pnpm format

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
	pnpm -v
	pnpm install

tag version=version:
	git tag -a v{{ version }} -m'v{{ version }}'
	git push origin v{{ version }}

untag version=version:
	git tag -d v{{ version }}
	git push origin --delete v{{ version }}
