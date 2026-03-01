import path from "node:path";

export function getBackendUploadDir() {
  const configured = process.env.BACKEND_UPLOAD_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  // Default persistent location shared with backend workspace.
  return path.resolve(process.cwd(), "..", "backend", "data", "uploads");
}

