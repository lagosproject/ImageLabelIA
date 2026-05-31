#!/usr/bin/env bash
# docker-build.sh — Build the Tauri Linux app inside Docker
#
# Usage:
#   ./docker-build.sh           # builds .deb only (safe in Docker, no FUSE needed)
#   ./docker-build.sh all       # builds .deb + .AppImage + .rpm (requires --privileged)
#   ./docker-build.sh deb,rpm   # comma-separated list of specific bundle types
#
# Named Docker volumes are used for caches so incremental rebuilds are fast:
#   imagelabelia-node-modules   pnpm install output
#   imagelabelia-cargo-target   cargo/tauri compilation artifacts
#   imagelabelia-cargo-registry ~/.cargo/registry (downloaded crates)
#   imagelabelia-cargo-git      ~/.cargo/git
#
# To wipe all caches and start fresh:
#   docker volume rm imagelabelia-node-modules imagelabelia-cargo-target \
#                    imagelabelia-cargo-registry imagelabelia-cargo-git

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE="imagelabelia-build"
BUNDLES="${1:-deb}"

# "all" is not a valid tauri CLI value — expand it to the three Linux bundle types
if [ "$BUNDLES" = "all" ]; then
    BUNDLES="deb rpm appimage"
fi

# AppImage needs FUSE; add --privileged when building it
EXTRA_FLAGS=""
if echo "$BUNDLES" | grep -qiE 'appimage'; then
    EXTRA_FLAGS="--privileged"
    echo "==> AppImage requested — adding --privileged to enable FUSE inside Docker"
fi

echo "==> Building Docker environment image (skipped if up to date)..."
docker build -f "$SCRIPT_DIR/Dockerfile.build" -t "$IMAGE" "$SCRIPT_DIR"

echo "==> Running Tauri build inside Docker (bundles: $BUNDLES)..."
docker run --rm \
    $EXTRA_FLAGS \
    -v "$SCRIPT_DIR":/app \
    -v imagelabelia-node-modules:/app/node_modules \
    -v imagelabelia-cargo-target:/app/src-tauri/target \
    -v imagelabelia-cargo-registry:/root/.cargo/registry \
    -v imagelabelia-cargo-git:/root/.cargo/git \
    "$IMAGE" \
    bash -c "
        set -e
        export PATH=\"/root/.cargo/bin:\$PATH\"
        echo '--- pnpm install ---'
        pnpm install --frozen-lockfile
        echo '--- tauri build ---'
        pnpm tauri build --bundles $BUNDLES
        echo '--- Build artifacts ---'
        find src-tauri/target/release/bundle -type f | sort
    "

echo ""
echo "==> Done. Artifacts are in: src-tauri/target/release/bundle/"
