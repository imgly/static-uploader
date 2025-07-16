# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a blob storage uploader service built as a Cloudflare Worker using Hono.js. The service allows authenticated users to upload files to R2 storage with organized folder structure based on date and namespace.

**Key Features:**
- Simple authentication (HTTP Basic Auth or API key)
- Direct file uploads through worker to R2 storage
- Configurable namespace validation via environment variables
- UUID-based filenames for security
- Local development with R2 bucket simulation
- File retrieval endpoint

## Architecture

- **Framework**: Hono.js (generic backend framework that works with Cloudflare Workers)
- **Runtime**: Cloudflare Workers
- **Storage**: Native R2 binding (no external SDK required)
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

## API Endpoints

### POST /upload
Upload files directly through the worker to R2 storage.

**Authentication**: Required (API key or Basic Auth)
**Content-Type**: `multipart/form-data`
**Form Fields**:
- `file`: The file to upload
- `namespace`: Required namespace (must be in ALLOWED_NAMESPACES list)

**Response**:
```json
{
  "success": true,
  "key": "uploads/2024-07-16/uuid-here",
  "fileId": "uuid-here",
  "originalName": "example.jpg",
  "size": 12345,
  "type": "image/jpeg"
}
```

### GET /file/:namespace/:date/:fileId
Retrieve files from R2 storage.

**Authentication**: None required
**Response**: Direct file stream with appropriate Content-Type header

## Environment Setup

For local development:
1. Run `npm run dev` - uses local R2 bucket simulation
2. Configure authentication credentials in `wrangler.jsonc`
3. Configure allowed namespaces in `ALLOWED_NAMESPACES` environment variable
4. No additional setup required - R2 binding handles local storage

## Environment Variables

- `API_KEY`: Optional API key for authentication
- `BASIC_AUTH_USERNAME`: Username for HTTP Basic Auth
- `BASIC_AUTH_PASSWORD`: Password for HTTP Basic Auth
- `ALLOWED_NAMESPACES`: Comma-separated list of allowed namespaces (e.g., "uploads,docs,changelog,assets")
- `BASE_URL`: Base URL for file links displayed after upload (e.g., "https://your-domain.com")

## Deployment

The project is configured for Cloudflare Workers deployment. Use `npm run deploy` after building to deploy to Cloudflare's edge network.