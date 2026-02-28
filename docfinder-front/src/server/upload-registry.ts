import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type UploadRegistryEntry = {
  doc_id: string;
  source_name: string;
  original_name: string;
  saved_path: string;
  doc_type: string;
  category: string;
  tags: string[];
  lang: string;
  uploaded_at: string;
};

type UploadRegistry = {
  bySource: Record<string, UploadRegistryEntry>;
};

function getUploadDir() {
  return process.env.BACKEND_UPLOAD_DIR ?? path.join(process.cwd(), ".tmp-backend-uploads");
}

function getRegistryPath() {
  return path.join(getUploadDir(), ".docfinder-upload-registry.json");
}

function readRegistry(): UploadRegistry {
  const registryPath = getRegistryPath();
  if (!existsSync(registryPath)) {
    return { bySource: {} };
  }

  try {
    const raw = readFileSync(registryPath, "utf-8");
    const parsed = JSON.parse(raw) as UploadRegistry;
    return {
      bySource: parsed?.bySource ?? {},
    };
  } catch {
    return { bySource: {} };
  }
}

function writeRegistry(registry: UploadRegistry) {
  const registryPath = getRegistryPath();
  writeFileSync(registryPath, JSON.stringify(registry, null, 2), "utf-8");
}

export function upsertUploadRegistryEntry(entry: UploadRegistryEntry) {
  const registry = readRegistry();
  registry.bySource[entry.source_name] = entry;
  writeRegistry(registry);
}

export function getUploadRegistryEntryBySource(sourceName: string) {
  const registry = readRegistry();
  return registry.bySource[sourceName] ?? null;
}

export function getUploadRegistryEntryByDocId(docId: string) {
  const registry = readRegistry();
  return (
    Object.values(registry.bySource).find((entry) => entry.doc_id === docId) ?? null
  );
}
