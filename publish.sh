#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 FastGraph Publishing Script${NC}"
echo "================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Run this script from the root directory.${NC}"
    exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes.${NC}"
    echo "Please commit or stash your changes before publishing."
    git status --short
    exit 1
fi

# Check if we're on main/master branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
    echo -e "${YELLOW}⚠️  Warning: You're not on main/master branch (currently on: $BRANCH)${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if we have npm credentials
if ! npm whoami > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Not logged in to npm. Run 'npm login' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Logged in to npm as: $(npm whoami)${NC}"

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}📦 Current version: $CURRENT_VERSION${NC}"

# Ask for version bump type
echo ""
echo "Select version bump type:"
echo "1) patch (0.1.0 -> 0.1.1) - bug fixes"
echo "2) minor (0.1.0 -> 0.2.0) - new features"  
echo "3) major (0.1.0 -> 1.0.0) - breaking changes"
echo "4) custom - specify exact version"
echo "5) skip - use current version"

read -p "Enter choice (1-5): " -n 1 -r VERSION_CHOICE
echo

case $VERSION_CHOICE in
    1)
        VERSION_TYPE="patch"
        ;;
    2)
        VERSION_TYPE="minor"
        ;;
    3)
        VERSION_TYPE="major"
        ;;
    4)
        read -p "Enter custom version: " CUSTOM_VERSION
        VERSION_TYPE="custom"
        ;;
    5)
        VERSION_TYPE="skip"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

# Clean and build
echo -e "${BLUE}🧹 Cleaning previous builds...${NC}"
./build.sh clean > /dev/null 2>&1 || true

echo -e "${BLUE}🔨 Building library...${NC}"
if ! ./build.sh; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"

# Run tests if they exist
if [ -f "package.json" ] && grep -q '"test"' package.json; then
    echo -e "${BLUE}🧪 Running tests...${NC}"
    if ! bun test > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Tests failed or not configured${NC}"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Tests passed${NC}"
    fi
fi

# Bump version
if [ "$VERSION_TYPE" != "skip" ]; then
    echo -e "${BLUE}📝 Bumping version...${NC}"
    
    if [ "$VERSION_TYPE" = "custom" ]; then
        npm version "$CUSTOM_VERSION" --no-git-tag-version
        NEW_VERSION="$CUSTOM_VERSION"
    else
        NEW_VERSION=$(npm version "$VERSION_TYPE" --no-git-tag-version | sed 's/v//')
    fi
    
    echo -e "${GREEN}✅ Version bumped to: $NEW_VERSION${NC}"
else
    NEW_VERSION="$CURRENT_VERSION"
fi

# Show package contents
echo -e "${BLUE}📋 Package contents preview:${NC}"
npm pack --dry-run | head -20

# Final confirmation
echo ""
echo -e "${YELLOW}🚨 READY TO PUBLISH${NC}"
echo "  📦 Package: @uvxdotdev/fastgraph"
echo "  🏷️  Version: $NEW_VERSION" 
echo "  👤 Author: $(npm whoami)"
echo "  🌐 Registry: $(npm config get registry)"
echo ""

read -p "Are you sure you want to publish? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}📦 Publishing cancelled${NC}"
    # Revert version change if it was made
    if [ "$VERSION_TYPE" != "skip" ]; then
        git checkout -- package.json
        echo -e "${BLUE}↩️  Version reverted${NC}"
    fi
    exit 0
fi

# Publish to npm
echo -e "${BLUE}🚀 Publishing to npm...${NC}"

if npm publish; then
    echo -e "${GREEN}✅ Successfully published @uvxdotdev/fastgraph@$NEW_VERSION to npm!${NC}"
    
    # Commit version change and create git tag
    if [ "$VERSION_TYPE" != "skip" ]; then
        git add package.json
        git commit -m "chore: bump version to $NEW_VERSION"
        git tag "v$NEW_VERSION"
        
        echo -e "${GREEN}✅ Created git tag v$NEW_VERSION${NC}"
        
        read -p "Push changes and tags to remote? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            git push origin "$BRANCH"
            git push origin "v$NEW_VERSION"
            echo -e "${GREEN}✅ Pushed to remote repository${NC}"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}🎉 PUBLICATION SUCCESSFUL!${NC}"
    echo ""
    echo "📦 Your package is now available:"
    echo "   npm install @uvxdotdev/fastgraph@$NEW_VERSION"
    echo "   yarn add @uvxdotdev/fastgraph@$NEW_VERSION"
    echo "   bun add @uvxdotdev/fastgraph@$NEW_VERSION"
    echo ""
    echo "🔗 View on npm: https://www.npmjs.com/package/@uvxdotdev/fastgraph"
    echo ""
    
else
    echo -e "${RED}❌ Publishing failed${NC}"
    
    # Revert version change if it was made
    if [ "$VERSION_TYPE" != "skip" ]; then
        git checkout -- package.json
        echo -e "${BLUE}↩️  Version reverted${NC}"
    fi
    
    exit 1
fi