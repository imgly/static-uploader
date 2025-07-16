import { Hono } from 'hono'
import { renderer } from './renderer'

interface CloudflareBindings {
  BUCKET: R2Bucket
  API_KEY?: string
  BASIC_AUTH_USERNAME?: string
  BASIC_AUTH_PASSWORD?: string
  ALLOWED_NAMESPACES?: string
}

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use(renderer)

// Helper function to get allowed namespaces
const getAllowedNamespaces = (env: CloudflareBindings): string[] => {
  if (!env.ALLOWED_NAMESPACES) {
    return ['uploads'] // Default fallback
  }
  return env.ALLOWED_NAMESPACES.split(',').map(ns => ns.trim())
}

// Helper function to validate namespace
const isValidNamespace = (namespace: string, env: CloudflareBindings): boolean => {
  const allowedNamespaces = getAllowedNamespaces(env)
  return allowedNamespaces.includes(namespace)
}

app.get('/', (c) => {
  const allowedNamespaces = getAllowedNamespaces(c.env)
  
  return c.render(
    <html>
      <head>
        <title>Blob Storage Uploader</title>
      </head>
      <body>
        <h1>Blob Storage Uploader</h1>
        
        <form action="/upload" method="post" enctype="multipart/form-data">
          <h3>Authentication</h3>
          <label for="apiKey">API Key (optional):</label>
          <input type="password" id="apiKey" name="apiKey" placeholder="your-api-key-here" />
          <br /><br />
          
          <label for="username">Username (optional):</label>
          <input type="text" id="username" name="username" placeholder="admin" />
          <br /><br />
          
          <label for="password">Password (optional):</label>
          <input type="password" id="password" name="password" placeholder="password" />
          <br /><br />
          
          <hr />
          
          <label for="file">Select File:</label>
          <input type="file" id="file" name="file" required />
          <br /><br />
          
          <label for="namespace">Namespace:</label>
          <select id="namespace" name="namespace" required>
            {allowedNamespaces.map(ns => (
              <option key={ns} value={ns} selected={ns === 'uploads'}>
                {ns}
              </option>
            ))}
          </select>
          <br /><br />
          
          <p><strong>Allowed namespaces:</strong> {allowedNamespaces.join(', ')}</p>
          
          <button type="submit">Upload File</button>
        </form>
      </body>
    </html>
  )
})

// Authentication middleware
const authMiddleware = async (c: any, next: any) => {
  const apiKey = c.req.header('X-API-Key')
  const authHeader = c.req.header('Authorization')
  
  // Check API key first
  if (apiKey && c.env.API_KEY && apiKey === c.env.API_KEY) {
    return next()
  }
  
  // Check basic auth
  if (authHeader && authHeader.startsWith('Basic ')) {
    const base64Credentials = authHeader.slice(6)
    const credentials = atob(base64Credentials)
    const [username, password] = credentials.split(':')
    
    if (
      username === c.env.BASIC_AUTH_USERNAME &&
      password === c.env.BASIC_AUTH_PASSWORD
    ) {
      return next()
    }
  }
  
  // For form submissions, check form data
  if (c.req.method === 'POST') {
    try {
      const formData = await c.req.formData()
      const formApiKey = formData.get('apiKey') as string
      const formUsername = formData.get('username') as string
      const formPassword = formData.get('password') as string
      
      // Check form API key
      if (formApiKey && c.env.API_KEY && formApiKey === c.env.API_KEY) {
        return next()
      }
      
      // Check form username/password
      if (formUsername && formPassword && 
          formUsername === c.env.BASIC_AUTH_USERNAME && 
          formPassword === c.env.BASIC_AUTH_PASSWORD) {
        return next()
      }
    } catch (e) {
      // If form parsing fails, continue to unauthorized
    }
  }
  
  return c.json({ error: 'Unauthorized' }, 401)
}

// Direct file upload through worker
app.post('/upload', authMiddleware, async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    const namespace = formData.get('namespace') as string || 'uploads'
    
    if (!file) {
      return c.render(
        <html>
          <head><title>Upload Error</title></head>
          <body>
            <h1>Upload Error</h1>
            <p>No file provided</p>
            <a href="/">Go back</a>
          </body>
        </html>
      )
    }
    
    // Validate namespace
    if (!isValidNamespace(namespace, c.env)) {
      const allowedNamespaces = getAllowedNamespaces(c.env)
      return c.render(
        <html>
          <head><title>Upload Error</title></head>
          <body>
            <h1>Upload Error</h1>
            <p>Invalid namespace: {namespace}</p>
            <p>Allowed namespaces: {allowedNamespaces.join(', ')}</p>
            <a href="/">Go back</a>
          </body>
        </html>
      )
    }
    
    // Generate UUID for filename
    const fileId = crypto.randomUUID()
    
    // Create date-based folder structure
    const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const key = `${namespace}/${date}/${fileId}`
    
    // Upload to R2 using native binding
    await c.env.BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    })
    
    return c.render(
      <html>
        <head><title>Upload Success</title></head>
        <body>
          <h1>Upload Successful!</h1>
          <p><strong>File ID:</strong> {fileId}</p>
          <p><strong>Key:</strong> {key}</p>
          <p><strong>Original Name:</strong> {file.name}</p>
          <p><strong>Size:</strong> {file.size} bytes</p>
          <p><strong>Type:</strong> {file.type}</p>
          <p><strong>File URL:</strong> <a href={`/file/${key}`} target="_blank">/file/{key}</a></p>
          <br />
          <a href="/">Upload another file</a>
        </body>
      </html>
    )
  } catch (error) {
    console.error('Error uploading file:', error)
    return c.render(
      <html>
        <head><title>Upload Error</title></head>
        <body>
          <h1>Upload Error</h1>
          <p>Failed to upload file: {error.message}</p>
          <a href="/">Go back</a>
        </body>
      </html>
    )
  }
})

// Get file from R2
app.get('/file/:namespace/:date/:fileId', async (c) => {
  try {
    const { namespace, date, fileId } = c.req.param()
    const key = `${namespace}/${date}/${fileId}`
    
    const object = await c.env.BUCKET.get(key)
    
    if (!object) {
      return c.json({ error: 'File not found' }, 404)
    }
    
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      },
    })
  } catch (error) {
    console.error('Error retrieving file:', error)
    return c.json({ error: 'Failed to retrieve file' }, 500)
  }
})

export default app
