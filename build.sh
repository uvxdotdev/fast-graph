#!/bin/bash
set -e

echo "🚀 Building FastGraph React Component Library..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v rustc &> /dev/null; then
        print_error "Rust is not installed. Please install from https://rustup.rs/"
        exit 1
    fi
    
    if ! command -v wasm-pack &> /dev/null; then
        print_warning "wasm-pack not found. Installing..."
        curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
    fi
    
    if ! command -v bun &> /dev/null; then
        print_error "Bun is not installed. Please install from https://bun.sh/"
        exit 1
    fi
    
    # Add wasm32 target if not present
    rustup target add wasm32-unknown-unknown
}

# Clean previous builds
clean_build() {
    print_status "Cleaning previous builds..."
    rm -rf dist/
    rm -rf rust-core/pkg/
}

# Build Rust WASM package
build_rust() {
    print_status "Building Rust WASM package..."
    cd rust-core
    wasm-pack build --target web --out-dir pkg --release
    cd ..
    print_status "✅ Rust WASM build completed"
}

# Install dependencies
install_deps() {
    print_status "Installing TypeScript dependencies..."
    bun install
}

# Build TypeScript
build_typescript() {
    print_status "Building TypeScript library..."
    
    # Create dist directory
    mkdir -p dist
    
    # Compile TypeScript declarations
    bun tsc
    
    # Build ESM version
    bun build src/index.ts --outfile dist/index.esm.js --format esm --external react --external react-dom --external react/jsx-runtime --external react/jsx-dev-runtime
    
    # Build CJS version  
    bun build src/index.ts --outfile dist/index.js --format cjs --external react --external react-dom --external react/jsx-runtime --external react/jsx-dev-runtime
    
    print_status "✅ TypeScript build completed"
}

# Copy WASM files to dist
copy_wasm() {
    print_status "Copying WASM files..."
    cp -r rust-core/pkg dist/
    print_status "✅ WASM files copied"
}

# Main build process
main() {
    check_dependencies
    clean_build
    install_deps
    build_rust
    build_typescript
    copy_wasm
    
    print_status "🎉 Build completed successfully!"
    echo ""
    print_status "Built files:"
    echo "  📦 dist/index.js (CommonJS)"
    echo "  📦 dist/index.esm.js (ES Modules)"
    echo "  📦 dist/index.d.ts (TypeScript declarations)"
    echo "  🦀 dist/pkg/ (WASM package)"
}

# Handle script arguments
case "${1:-}" in
    "clean")
        clean_build
        print_status "Clean completed"
        ;;
    "rust")
        build_rust
        ;;
    "ts"|"typescript")
        build_typescript
        ;;
    "dev")
        print_status "Starting development build..."
        check_dependencies
        build_rust
        build_typescript
        copy_wasm
        print_status "Development build completed. Use 'bun run dev' for watch mode."
        ;;
    "")
        main
        ;;
    *)
        echo "Usage: $0 [clean|rust|ts|dev]"
        echo ""
        echo "Commands:"
        echo "  clean     Clean build artifacts"
        echo "  rust      Build only Rust WASM"
        echo "  ts        Build only TypeScript"
        echo "  dev       Quick development build"
        echo "  (none)    Full build"
        exit 1
        ;;
esac