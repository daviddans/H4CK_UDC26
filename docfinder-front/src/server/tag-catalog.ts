import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getBackendUploadDir } from "@/server/storage-paths";

type TagCatalog = {
  tags: string[];
};

function normalizeTag(value: string) {
  return value.trim().toLowerCase();
}

function getUploadDir() {
  return getBackendUploadDir();
}

function getCatalogPath() {
  return path.join(getUploadDir(), ".docfinder-tag-catalog.json");
}

function readCatalog(): TagCatalog {
  const filePath = getCatalogPath();
  if (!existsSync(filePath)) {
    return { tags: [] };
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as TagCatalog;
    return {
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.map((tag) => normalizeTag(String(tag))).filter(Boolean)
        : [],
    };
  } catch {
    return { tags: [] };
  }
}

function writeCatalog(catalog: TagCatalog) {
  const filePath = getCatalogPath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(catalog, null, 2), "utf-8");
}

export function listManualTags() {
  return readCatalog().tags;
}

export function addManualTag(rawTag: string) {
  const tag = normalizeTag(rawTag);
  if (!tag) {
    return listManualTags();
  }

  const catalog = readCatalog();
  if (!catalog.tags.includes(tag)) {
    catalog.tags.push(tag);
    catalog.tags.sort((a, b) => a.localeCompare(b));
    writeCatalog(catalog);
  }

  return catalog.tags;
}

export function removeManualTag(rawTag: string) {
  const tag = normalizeTag(rawTag);
  if (!tag) {
    return listManualTags();
  }

  const catalog = readCatalog();
  const filtered = catalog.tags.filter((item) => item !== tag);
  if (filtered.length !== catalog.tags.length) {
    writeCatalog({ tags: filtered });
  }

  return filtered;
}
