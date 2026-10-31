# server/Dockerfile

# Stage 1: Build the Go binaries using lightweight Alpine Go
FROM golang:alpine AS builder

WORKDIR /app

# Install ca-certificates and tzdata
RUN apk add --no-cache ca-certificates tzdata

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy application source code (strictly filtered via .dockerignore)
COPY . .

# Build with memory and resource optimizations:
# - GOMAXPROCS=2 and -p 2 cap compiler memory/CPU concurrency during builds
# - CGO_ENABLED=0 produces self-contained static binaries
# - -ldflags="-s -w" strips debug tables and reduces binary memory footprint
# - -trimpath eliminates local build paths
RUN GOMAXPROCS=2 CGO_ENABLED=0 GOOS=linux go build -p 2 -ldflags="-s -w" -trimpath -o /app/bin/sigma-finance-server ./cmd
RUN GOMAXPROCS=2 CGO_ENABLED=0 GOOS=linux go build -p 2 -ldflags="-s -w" -trimpath -o /app/bin/sigma-finance ./cmd/bun

# Stage 2: Minimal runtime environment (~40MB total footprint)
FROM alpine:3.21

WORKDIR /app

# Install root TLS certificates and timezone data
RUN apk add --no-cache ca-certificates tzdata

# Copy compiled binaries from builder
COPY --from=builder /app/bin/sigma-finance-server ./sigma-finance-server
COPY --from=builder /app/bin/sigma-finance ./sigma-finance

# Expose HTTP port
EXPOSE 8080

# Start server
CMD ["./sigma-finance-server"]
