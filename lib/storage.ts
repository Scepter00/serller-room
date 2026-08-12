import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, UPLOAD_MAX_BYTES } from "@/lib/constants";

export interface UploadInput {
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
}

export interface UploadResult {
  /** IPFS CID (production) or relative URL (local dev mock). */
  cid: string;
  url: string;
}

export const IPFS_GATEWAY =
  process.env.PINATA_GATEWAY_URL ||
  process.env.IPFS_PUBLIC_GATEWAY ||
  "https://ipfs.io";

export interface StorageDriver {
  readonly name: string;
  put(input: UploadInput): Promise<UploadResult>;
}

/**
 * ⚠️ DEV MOCK (Rule 2): local filesystem storage. Used only when
 * STORAGE_DRIVER=local. Production MUST use the Pinata driver.
 */
class LocalDriver implements StorageDriver {
  readonly name = "local";
  async put(input: UploadInput): Promise<UploadResult> {
    const ext = path.extname(input.name).toLowerCase();
    const filename = `${randomUUID()}${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), input.buffer);
    const url = `/uploads/${filename}`;
    console.warn("[storage] DEV MOCK driver used — production requires STORAGE_DRIVER=pinata");
    return { cid: url, url };
  }
}

/** Production driver: IPFS via Pinata Files API v3. */
class PinataDriver implements StorageDriver {
  readonly name = "pinata";
  private readonly jwt = process.env.PINATA_JWT ?? "";
  private readonly endpoint = "https://uploads.pinata.cloud/v3/files";

  async put(input: UploadInput): Promise<UploadResult> {
    if (!this.jwt) {
      throw new Error("PINATA_JWT is not configured");
    }
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(input.buffer)], { type: input.type }),
      input.name
    );

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.jwt}` },
      body: form,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Pinata upload failed (${response.status}): ${body.slice(0, 200)}`);
    }

    const json = (await response.json()) as { data?: { cid?: string } };
    const cid = json.data?.cid;
    if (!cid) throw new Error("Pinata upload returned no CID");

    const gateway = IPFS_GATEWAY.replace(/\/+$/, "");
    const url = gateway.includes("/ipfs/")
      ? `${gateway}/${cid}`
      : `${gateway}/ipfs/${cid}`;
    return { cid, url };
  }
}

export function getStorageDriver(): StorageDriver {
  const driver = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
  if (driver === "pinata") return new PinataDriver();
  return new LocalDriver();
}

/** Validate an upload; returns an error message or null when valid. */
export function validateUpload(input: UploadInput): string | null {
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return "Empty file";
  }
  if (input.size > UPLOAD_MAX_BYTES) {
    return `File exceeds the ${UPLOAD_MAX_BYTES / (1024 * 1024)} MB limit`;
  }
  if (!ALLOWED_MIME_TYPES.has(input.type)) {
    return "Unsupported file type. Allowed: JPEG, PNG, GIF, WebP, AVIF";
  }
  const ext = path.extname(input.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return "Unsupported file extension";
  }
  if (!matchesMagicBytes(input.buffer, input.type)) {
    return "File content does not match its declared type";
  }
  return null;
}

/** Verify the first bytes of the file match its declared MIME type. */
function matchesMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;
  const b = buffer;
  switch (mimeType) {
    case "image/jpeg":
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "image/png":
      return (
        b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
      );
    case "image/gif":
      return b.toString("ascii", 0, 4) === "GIF8";
    case "image/webp":
      return (
        b.toString("ascii", 0, 4) === "RIFF" &&
        b.toString("ascii", 8, 12) === "WEBP"
      );
    case "image/avif":
      return (
        b.toString("ascii", 4, 8) === "ftyp" &&
        b.toString("ascii", 8, 12) === "avif"
      );
    default:
      return false;
  }
}
