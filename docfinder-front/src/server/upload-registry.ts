import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getBackendUploadDir } from "@/server/storage-paths";

export type UploadRegistryEntry = {
  doc_id: string;
  source_name: string;
  original_name: string;
  saved_path: string;
  page_count?: number;
  doc_type?: string;
  category?: string;
  tags: string[];
  lang?: string;
  uploaded_at: string;
};

type UploadRegistry = {
  bySource: Record<string, UploadRegistryEntry>;
  byDocId: Record<string, UploadRegistryEntry>;
};

function getUploadDir() {
  return getBackendUploadDir();
}

function getRegistryPath() {
  return path.join(getUploadDir(), ".docfinder-upload-registry.json");
}

function isLegacyTempPath(filePath: string) {
  return filePath.includes(`${path.sep}.tmp-backend-uploads${path.sep}`);
}

function stripDocPrefixFromBasename(filename: string) {
  return filename.replace(/^UPL-[A-Z0-9]{8,}-/i, "");
}

function migrateLegacyPaths(registry: UploadRegistry) {
  const targetDir = getUploadDir();
  let changed = false;
  const nextByDocId: Record<string, UploadRegistryEntry> = {};

  for (const [docId, rawEntry] of Object.entries(registry.byDocId)) {
    const entry = { ...rawEntry };
    const currentPath = entry.saved_path;
    if (!currentPath) {
      nextByDocId[docId] = entry;
      continue;
    }

    const sourceDir = path.dirname(currentPath);
    const sourceBase = path.basename(currentPath);
    const cleanBase = stripDocPrefixFromBasename(sourceBase) || sourceBase;
    const preferredDir = isLegacyTempPath(currentPath) ? targetDir : sourceDir;
    const nextPath = path.join(preferredDir, cleanBase);
    const samePath = path.resolve(nextPath) === path.resolve(currentPath);

    mkdirSync(path.dirname(nextPath), { recursive: true });
    if (!samePath && existsSync(currentPath) && !existsSync(nextPath)) {
      try {
        renameSync(currentPath, nextPath);
      } catch {
        // Keep current path if move fails.
      }
    }

    if (existsSync(nextPath)) {
      if (entry.saved_path !== nextPath || entry.source_name !== cleanBase) {
        entry.saved_path = nextPath;
        entry.source_name = cleanBase;
        changed = true;
      }
    } else if (entry.source_name !== cleanBase) {
      entry.source_name = cleanBase;
      changed = true;
    }

    nextByDocId[docId] = entry;
  }

  const nextBySource: Record<string, UploadRegistryEntry> = {};
  for (const entry of Object.values(nextByDocId)) {
    nextBySource[entry.source_name] = entry;
  }

  return {
    registry: { byDocId: nextByDocId, bySource: nextBySource },
    changed,
  };
}

function readRegistry(): UploadRegistry {
  const registryPath = getRegistryPath();
  if (!existsSync(registryPath)) {
    return { bySource: {}, byDocId: {} };
  }

  try {
    const raw = readFileSync(registryPath, "utf-8");
    const parsed = JSON.parse(raw) as UploadRegistry;
    const bySource = parsed?.bySource ?? {};
    const byDocId = parsed?.byDocId ?? {};

    // Backward compatibility with old registry format.
    if (Object.keys(byDocId).length === 0) {
      for (const entry of Object.values(bySource)) {
        if (entry?.doc_id) {
          byDocId[entry.doc_id] = entry;
        }
      }
    }

    const baseRegistry = {
      bySource,
      byDocId,
    };
    const { registry, changed } = migrateLegacyPaths(baseRegistry);
    if (changed) {
      writeRegistry(registry);
    }
    return registry;
  } catch {
    return { bySource: {}, byDocId: {} };
  }
}

function writeRegistry(registry: UploadRegistry) {
  const registryPath = getRegistryPath();
  mkdirSync(path.dirname(registryPath), { recursive: true });
  writeFileSync(registryPath, JSON.stringify(registry, null, 2), "utf-8");
}

export function upsertUploadRegistryEntry(entry: UploadRegistryEntry) {
  const registry = readRegistry();
  registry.bySource[entry.source_name] = entry;
  registry.byDocId[entry.doc_id] = entry;
  writeRegistry(registry);
}

function stripUploadPrefix(value: string) {
  return value.replace(/^UPL-[A-Z0-9]{8,}-/i, "");
}

export function getUploadRegistryEntryBySource(sourceName: string) {
  const registry = readRegistry();
  const raw = sourceName.trim();
  const sourceBase = path.basename(raw);
  const strippedRaw = stripUploadPrefix(raw);
  const strippedBase = stripUploadPrefix(sourceBase);
  const directCandidates = [raw, sourceBase, strippedRaw, strippedBase];

  for (const candidate of directCandidates) {
    if (candidate && registry.bySource[candidate]) {
      return registry.bySource[candidate];
    }
  }

  return (
    Object.values(registry.byDocId).find(
      (entry) =>
        entry.source_name === sourceBase ||
        entry.original_name === strippedBase ||
        entry.original_name === raw
    ) ?? null
  );
}

export function getUploadRegistryEntryByDocId(docId: string) {
  const registry = readRegistry();
  return registry.byDocId[docId] ?? null;
}

export function removeUploadRegistryEntryByDocId(docId: string) {
  const registry = readRegistry();
  const entry = registry.byDocId[docId];
  if (!entry) {
    return null;
  }

  delete registry.byDocId[docId];
  for (const [source, sourceEntry] of Object.entries(registry.bySource)) {
    if (sourceEntry.doc_id === docId) {
      delete registry.bySource[source];
    }
  }

  writeRegistry(registry);
  return entry;
}

export function updateUploadRegistryTagsByDocId(docId: string, tags: string[]) {
  const registry = readRegistry();
  const entry = registry.byDocId[docId];
  if (!entry) {
    return null;
  }

  const cleanTags = Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .filter((tag) => tag !== "indexed")
    )
  );

  const nextEntry: UploadRegistryEntry = {
    ...entry,
    tags: cleanTags,
  };

  registry.byDocId[docId] = nextEntry;
  registry.bySource[nextEntry.source_name] = nextEntry;
  writeRegistry(registry);
  return nextEntry;
}

export function listUploadRegistryEntries() {
  const registry = readRegistry();
  return Object.values(registry.byDocId).sort((a, b) =>
    b.uploaded_at.localeCompare(a.uploaded_at)
  );
}

export function listUploadRegistryTags() {
  const registry = readRegistry();
  return Array.from(
    new Set(
      Object.values(registry.byDocId)
        .flatMap((entry) => entry.tags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

export function removeTagFromUploadRegistry(tag: string) {
  const normalized = tag.trim().toLowerCase();
  if (!normalized) {
    return { updated: 0 };
  }

  const registry = readRegistry();
  let updated = 0;

  for (const [docId, entry] of Object.entries(registry.byDocId)) {
    const nextTags = (entry.tags ?? [])
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item && item !== normalized);

    if (nextTags.length !== (entry.tags ?? []).length) {
      const nextEntry = { ...entry, tags: nextTags };
      registry.byDocId[docId] = nextEntry;
      registry.bySource[nextEntry.source_name] = nextEntry;
      updated += 1;
    }
  }

  if (updated > 0) {
    writeRegistry(registry);
  }

  return { updated };
}
