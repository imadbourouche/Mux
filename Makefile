.PHONY: dev dev-server dev-web build run clean

dev:
	@echo "Run 'make dev-server' and 'make dev-web' in separate terminals."

dev-server:
	go run .

dev-web:
	cd web && yarn dev

build:
	cd web && yarn build
	go build -o dev-dashboard .

run: build
	./dev-dashboard

clean:
	rm -rf dev-dashboard web/dist web/node_modules
