# company-owned devices have locked down extensions
dev:
	pnpm run dev:chromium

build:
	pnpm run build

# on Linux, do something like `ln -s /usr/bin/xdg-open ~/.local/bin/open`
demo:
	open demo/index.html

# configures Edge at Mosyle-installed location
setup-mac: install
	ln -sf web-ext.config.mac.ts web-ext.config.ts

# configures Edge for `microsoft-edge-stable-bin` AUR package
setup-arch: install
	ln -sf web-ext.config.arch.ts web-ext.config.ts

install:
	pnpm install
