.PHONY: dev dev-server dev-web build run release clean

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS := -s -w -X main.Version=$(VERSION)

dev:
	@echo "Run 'make dev-server' and 'make dev-web' in separate terminals."

dev-server:
	go run .

dev-web:
	cd web && yarn dev

build:
	cd web && yarn build
	go build -ldflags "$(LDFLAGS)" -o mux .

run: build
	./mux

# Cross-compile single binaries for distribution.
# Output: dist/mux-<os>-<arch>
release:
	cd web && yarn build
	mkdir -p dist
	GOOS=darwin  GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o dist/mux-darwin-arm64 .
	GOOS=darwin  GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o dist/mux-darwin-amd64 .
	@echo ""
	@echo "Built:"
	@ls -lh dist/

clean:
	rm -rf mux dist web/dist web/node_modules
