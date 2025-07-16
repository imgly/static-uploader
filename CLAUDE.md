# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a blob storage uploader service built as a Cloudflare Worker using Hono.js. The service allows authenticated users to upload files to an S3 bucket with organized folder structure based on date and namespace.

**Key Features:**
- Simple authentication (HTTP Basic Auth or API key)
- File uploads to S3 bucket with date-based folder structure
- Configurable namespaces (default: "uploads", also supports "changelog", "docs", etc.)
- Local development with S3 bucket imitation
- Cloudflare Workers deployment

## Architecture

- **Framework**: Hono.js (generic backend framework that works with Cloudflare Workers)
- **Runtime**: Cloudflare Workers
- **Storage**: S3 bucket integration
- **File Structure**: `/{namespace}/{YYYY-MM-DD}/{uuid}`
- **Authentication**: HTTP Basic Auth or API key validation

## Development Commands

```bash
# Install dependencies
npm install

# Local development (with S3 bucket imitation)
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare Workers
npm run deploy

# Generate/sync types based on Worker configuration
npm run cf-typegen
```

## Configuration Files

- **wrangler.jsonc**: Cloudflare Workers configuration
- **vite.config.ts**: Build configuration with Cloudflare plugin
- **tsconfig.json**: TypeScript configuration with Hono JSX support
- **package.json**: Dependencies and scripts

## Key Dependencies

- `hono`: Main web framework
- `@cloudflare/vite-plugin`: Cloudflare Workers integration
- `wrangler`: Cloudflare Workers CLI and deployment

## Project Structure

```
src/
├── index.tsx          # Main application entry point
├── renderer.tsx       # JSX renderer configuration
└── style.css         # Styling

public/
└── favicon.ico       # Static assets
```

## Development Notes

- Uses TypeScript with strict mode enabled
- JSX support through Hono's JSX runtime
- Cloudflare Workers environment with ESNext module system
- Vite for build process and development server
- When adding Cloudflare bindings, run `npm run cf-typegen` to update types

## Environment Setup

For local development, you'll need to:
1. Set up S3 bucket imitation for local testing
2. Configure authentication credentials
3. Set up environment variables for S3 connection

## Deployment

The project is configured for Cloudflare Workers deployment. Use `npm run deploy` after building to deploy to Cloudflare's edge network.