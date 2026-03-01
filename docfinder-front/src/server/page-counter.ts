import path from "node:path";
import { readFile } from "node:fs/promises";

const PDF_PAGE_REGEX = /\/Type\s*\/Page\b/g;
const SINGLE_PAGE_EXTENSIONS = new Set([".txt", ".md", ".log", ".csv"]);

function inferPageCountByExtension(ext: string) {
  if (SINGLE_PAGE_EXTENSIONS.has(ext)) {
    return 1;
  }
  return undefined;
}

function countPdfPagesFromBuffer(buffer: Buffer) {
  const raw = buffer.toString("latin1");
  const matches = raw.match(PDF_PAGE_REGEX);
  const count = matches?.length ?? 0;
  return count > 0 ? count : 1;
}

export function countDocumentPagesFromBuffer(
  filename: string,
  buffer: Buffer
): number | undefined {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") {
    return countPdfPagesFromBuffer(buffer);
  }
  return inferPageCountByExtension(ext);
}

export async function countDocumentPages(filePath: string): Promise<number | undefined> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    try {
      const buffer = await readFile(filePath);
      return countPdfPagesFromBuffer(buffer);
    } catch {
      return undefined;
    }
  }
  return inferPageCountByExtension(ext);
}
