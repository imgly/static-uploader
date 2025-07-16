import { Hono } from 'hono'
import { renderer } from './renderer'

interface CloudflareBindings {
  BUCKET: R2Bucket
  API_KEY?: string
  BASIC_AUTH_USERNAME?: string
  BASIC_AUTH_PASSWORD?: string
}

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use(renderer)

app.get('/', (c) => {
  return c.render(<h1>Blob Storage Uploader</h1>)
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
  
  return c.json({ error: 'Unauthorized' }, 401)
}

// Direct file upload through worker
app.post('/upload', authMiddleware, async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    const namespace = formData.get('namespace') as string || 'uploads'
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
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
    
    return c.json({
      success: true,
      key,
      fileId,
      originalName: file.name,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return c.json({ error: 'Failed to upload file' }, 500)
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
