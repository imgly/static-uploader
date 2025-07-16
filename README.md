# Static Uploader

A blob storage uploader service built as a Cloudflare Worker using Hono.js. This service allows authenticated users to upload files to R2 storage with organized folder structure based on date and namespace.

## Features

- **Simple Authentication**: HTTP Basic Auth or API key support
- **Direct File Uploads**: Files are uploaded directly through the worker to R2 storage
- **Configurable Namespaces**: Organize uploads by namespace with environment variable configuration
- **UUID-based Filenames**: Secure filename generation using UUIDs
- **Date-based Organization**: Files are organized in `/{namespace}/{YYYY-MM-DD}/{uuid}` structure
- **File Retrieval**: Direct file access through GET endpoints
- **Local Development**: R2 bucket simulation for development
- **Web Interface**: Simple HTML interface for testing uploads

## Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account with R2 enabled
- Wrangler CLI installed (`npm install -g wrangler`)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/imgly/static-uploader.git
   cd static-uploader
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment variables in `wrangler.jsonc`:
   ```jsonc
   {
     "vars": {
       "API_KEY": "your-secure-api-key",
       "BASIC_AUTH_USERNAME": "your-username",
       "BASIC_AUTH_PASSWORD": "your-password",
       "ALLOWED_NAMESPACES": "uploads,docs,changelog,assets",
       "BASE_URL": "https://your-domain.com"
     }
   }
   ```

4. Start local development:
   ```bash
   npm run dev
   ```

### Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

Make sure your R2 bucket exists and environment variables are configured in your Cloudflare Workers dashboard.

## API Reference

### Upload File

**POST** `/upload`

Upload files directly through the worker to R2 storage.

**Authentication**: Required (API key or Basic Auth)

**Content-Type**: `multipart/form-data`

**Form Fields**:
- `file`: The file to upload (required)
- `namespace`: Namespace for organization (required, must be in ALLOWED_NAMESPACES)
- `apiKey`: API key for authentication (optional if using headers)
- `username`: Username for basic auth (optional)
- `password`: Password for basic auth (optional)

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

### Retrieve File

**GET** `/file/:namespace/:date/:fileId`

Retrieve files from R2 storage.

**Authentication**: None required

**Response**: Direct file stream with appropriate Content-Type header

## Authentication

The service supports two authentication methods:

### 1. API Key Authentication

Include the API key in the request header:
```bash
curl -X POST \
  -H "X-API-Key: your-api-key" \
  -F "file=@example.jpg" \
  -F "namespace=uploads" \
  https://your-worker.workers.dev/upload
```

### 2. HTTP Basic Authentication

Use basic authentication:
```bash
curl -X POST \
  -u username:password \
  -F "file=@example.jpg" \
  -F "namespace=uploads" \
  https://your-worker.workers.dev/upload
```

## Configuration

### Environment Variables

Set these in your Cloudflare Workers dashboard or `wrangler.jsonc`:

- `API_KEY`: Optional API key for authentication
- `BASIC_AUTH_USERNAME`: Username for HTTP Basic Auth
- `BASIC_AUTH_PASSWORD`: Password for HTTP Basic Auth  
- `ALLOWED_NAMESPACES`: Comma-separated list of allowed namespaces (e.g., "uploads,docs,changelog,assets")
- `BASE_URL`: Base URL for file links displayed after upload (e.g., "https://your-domain.com")

### R2 Bucket Configuration

Configure your R2 bucket in `wrangler.jsonc`:

```jsonc
{
  "r2_buckets": [
    {
      "bucket_name": "your-bucket-name",
      "binding": "BUCKET"
    }
  ]
}
```

## Development

### Available Scripts

```bash
# Local development with R2 simulation
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare Workers
npm run deploy

# Generate/sync types from Worker configuration
npm run cf-typegen
```

### Project Structure

```
src/
├── index.tsx          # Main application entry point
├── renderer.tsx       # JSX renderer configuration
└── style.css         # Styling

public/
└── favicon.ico       # Static assets

wrangler.jsonc        # Cloudflare Workers configuration
vite.config.ts        # Build configuration
```

### File Organization

Uploaded files are organized in the following structure:

```
/{namespace}/{YYYY-MM-DD}/{uuid}
```

Example:
```
uploads/2024-07-16/550e8400-e29b-41d4-a716-446655440000
docs/2024-07-16/6ba7b810-9dad-11d1-80b4-00c04fd430c8
```

## Security

- **UUID Filenames**: Original filenames are replaced with UUIDs to prevent directory traversal attacks
- **Namespace Validation**: Only configured namespaces are allowed
- **Authentication Required**: All uploads require valid authentication
- **No File Execution**: Files are stored as blobs, not executed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm run dev`
5. Submit a pull request

## License

MIT License - see LICENSE file for details
