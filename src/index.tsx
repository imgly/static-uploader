import { Hono } from "hono";
import { renderer } from "./renderer";

interface CloudflareBindings {
  BUCKET: R2Bucket;
  API_KEY?: string;
  ALLOWED_NAMESPACES?: string;
  BASE_URL?: string;
}

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(renderer);

// Helper function to get allowed namespaces
const getAllowedNamespaces = (env: CloudflareBindings): string[] => {
  if (!env.ALLOWED_NAMESPACES) {
    return ["uploads"]; // Default fallback
  }
  return env.ALLOWED_NAMESPACES.split(",").map((ns) => ns.trim());
};

// Helper function to validate namespace
const isValidNamespace = (
  namespace: string,
  env: CloudflareBindings
): boolean => {
  const allowedNamespaces = getAllowedNamespaces(env);
  return allowedNamespaces.includes(namespace);
};

// Helper function to get base URL for file links
const getBaseUrl = (env: CloudflareBindings, request: Request): string => {
  if (env.BASE_URL) {
    return env.BASE_URL.replace(/\/$/, ""); // Remove trailing slash
  }
  // Fallback to request origin
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
};

app.get("/", (c) => {
  const allowedNamespaces = getAllowedNamespaces(c.env);

  return c.render(
    <html>
      <head>
        <title>Blob Storage Uploader</title>
      </head>
      <body>
        <h1>Blob Storage Uploader</h1>

        <form action="/upload" method="post" enctype="multipart/form-data">
          <h3>Authentication</h3>
          <label for="token">Token:</label>
          <input
            type="password"
            id="token"
            name="token"
            placeholder="your-token-here"
            required
          />
          <br />
          <br />

          <hr />

          <label for="file">Select File:</label>
          <input type="file" id="file" name="file" required />
          <br />
          <br />

          <label for="namespace">Namespace:</label>
          <select id="namespace" name="namespace" required>
            {allowedNamespaces.map((ns, index) => (
              <option key={ns} value={ns} selected={index === 0}>
                {ns}
              </option>
            ))}
          </select>
          <br />
          <br />

          <p>
            <strong>Allowed namespaces:</strong> {allowedNamespaces.join(", ")}
          </p>

          <button type="submit">Upload File</button>
        </form>
      </body>
    </html>
  );
});

// Authentication middleware
const authMiddleware = async (c: any, next: any) => {
  const apiKey = c.req.header("X-API-Key");

  // Check API key first
  if (apiKey && c.env.API_KEY && apiKey === c.env.API_KEY) {
    return next();
  }

  // For form submissions, check form data
  if (c.req.method === "POST") {
    try {
      const formData = await c.req.formData();
      const formToken = formData.get("token") as string;

      // Check form token
      if (formToken && c.env.API_KEY && formToken === c.env.API_KEY) {
        return next();
      }
    } catch (e) {
      // If form parsing fails, continue to unauthorized
    }
  }

  return c.json({ error: "Unauthorized" }, 401);
};

// Direct file upload through worker
app.post("/upload", authMiddleware, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const namespace = (formData.get("namespace") as string) || "uploads";

    if (!file) {
      return c.render(
        <html>
          <head>
            <title>Upload Error</title>
          </head>
          <body>
            <h1>Upload Error</h1>
            <p>No file provided</p>
            <a href="/">Go back</a>
          </body>
        </html>
      );
    }

    // Validate namespace
    if (!isValidNamespace(namespace, c.env)) {
      const allowedNamespaces = getAllowedNamespaces(c.env);
      return c.render(
        <html>
          <head>
            <title>Upload Error</title>
          </head>
          <body>
            <h1>Upload Error</h1>
            <p>Invalid namespace: {namespace}</p>
            <p>Allowed namespaces: {allowedNamespaces.join(", ")}</p>
            <a href="/">Go back</a>
          </body>
        </html>
      );
    }

    // Generate UUID for filename with original extension
    const fileId = crypto.randomUUID();
    const extension = file.name.includes(".")
      ? file.name.substring(file.name.lastIndexOf("."))
      : "";
    const filename = fileId + extension;

    // Create date-based folder structure
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const key = `${namespace}/${date}/${filename}`;

    // Upload to R2 using native binding
    await c.env.BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    const baseUrl = getBaseUrl(c.env, c.req.raw);
    const fullFileUrl = `${baseUrl}/${key}`;

    // Determine markdown syntax based on file type
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    let markdownExample = "";
    if (isImage) {
      markdownExample = `![${file.name}](${fullFileUrl})`;
    } else if (isVideo) {
      markdownExample = `<video controls>
  <source src="${fullFileUrl}" type="${file.type}">
  Your browser does not support the video tag.
</video>`;
    } else {
      markdownExample = `[${file.name}](${fullFileUrl})`;
    }

    return c.render(
      <html>
        <head>
          <title>Upload Success</title>
        </head>
        <body>
          <h1>Upload Successful!</h1>
          <p>
            <strong>File ID:</strong> {fileId}
          </p>
          <p>
            <strong>Key:</strong> {key}
          </p>
          <p>
            <strong>Original Name:</strong> {file.name}
          </p>
          <p>
            <strong>Size:</strong> {file.size} bytes
          </p>
          <p>
            <strong>Type:</strong> {file.type}
          </p>
          <p>
            <strong>File URL:</strong>{" "}
            <a href={fullFileUrl} target="_blank">
              {fullFileUrl}
            </a>
          </p>

          <h3>Markdown Usage:</h3>
          <textarea
            readonly
            style="width: 100%; min-height: 80px; font-family: monospace; background: #f5f5f5; padding: 10px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"
            onClick="this.select()"
          >
            {markdownExample}
          </textarea>

          <br />
          <a href="/">Upload another file</a>
        </body>
      </html>
    );
  } catch (error) {
    console.error("Error uploading file:", error);
    return c.render(
      <html>
        <head>
          <title>Upload Error</title>
        </head>
        <body>
          <h1>Upload Error</h1>
          <p>Failed to upload file: {error.message}</p>
          <a href="/">Go back</a>
        </body>
      </html>
    );
  }
});

export default app;
