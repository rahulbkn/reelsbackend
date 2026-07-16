import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import type {
  DownloadUrlOptions,
  MediaFile,
  StorageProvider,
  StreamResult,
  ThumbnailUploadResult,
  UploadResult
} from "../../../types/storage";
import { NotFoundError } from "../../../utils/errors";

export interface LocalStorageProviderConfig {
  root: string;
  publicBaseUrl: string;
}

/**
 * Fully working local-disk provider — useful for dev/testing without
 * touching Telegram or a cloud bucket, and doubles as a concrete proof that
 * StorageFactory + STORAGE_PROVIDER genuinely swap implementations with no
 * other code changes. Files are addressed by a random key under `root`;
 * `getDownloadUrl` still routes through this server's own /stream endpoint,
 * exactly like the Telegram provider, so clients never see a filesystem path.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  private readonly root: string;
  private readonly publicBaseUrl: string;

  constructor(config: LocalStorageProviderConfig) {
    this.root = config.root;
    this.publicBaseUrl = config.publicBaseUrl.replace(/\/$/, "");
    fs.mkdirSync(this.root, { recursive: true });
  }

  private resolvePath(storageKey: string): string {
    // storageKey is always a value WE generated (below), so this is safe;
    // still guard against path traversal defensively.
    const safeKey = storageKey.replace(/\.\./g, "");
    return path.join(this.root, safeKey);
  }

  async uploadVideo(file: MediaFile, key: string): Promise<UploadResult> {
    const storageKey = `videos/${Date.now()}-${crypto.randomUUID()}-${path.basename(key)}`;
    const fullPath = this.resolvePath(storageKey);
    await fsp.mkdir(path.dirname(fullPath), { recursive: true });
    await fsp.writeFile(fullPath, file.data);

    return {
      storageKey,
      mimeType: file.mimeType,
      fileSize: file.data.length,
      width: 0,
      height: 0,
      duration: 0, // local provider doesn't probe video metadata; wire in ffprobe here if needed
      provider: this.name
    };
  }

  async uploadThumbnail(file: MediaFile, key: string): Promise<ThumbnailUploadResult> {
    const thumbnailKey = `thumbnails/${Date.now()}-${crypto.randomUUID()}-${path.basename(key)}`;
    const fullPath = this.resolvePath(thumbnailKey);
    await fsp.mkdir(path.dirname(fullPath), { recursive: true });
    await fsp.writeFile(fullPath, file.data);
    return { thumbnailKey, provider: this.name };
  }

  async getVideoStream(storageKey: string, range?: { start: number; end?: number }): Promise<StreamResult> {
    const fullPath = this.resolvePath(storageKey);
    if (!fs.existsSync(fullPath)) throw new NotFoundError(`No file at storageKey "${storageKey}"`);
    const stat = await fsp.stat(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".png" ? "image/png" : "video/mp4";

    if (range) {
      const start = range.start;
      const end = range.end ?? stat.size - 1;
      return {
        body: fs.createReadStream(fullPath, { start, end }),
        contentType,
        contentLength: end - start + 1,
        acceptsRanges: true
      };
    }

    return {
      body: fs.createReadStream(fullPath),
      contentType,
      contentLength: stat.size,
      acceptsRanges: true
    };
  }

  async getDownloadUrl(storageKey: string, options: DownloadUrlOptions = {}): Promise<string> {
    const variant = options.variant || "video";
    const params = new URLSearchParams({ key: storageKey, variant, provider: this.name });
    return `${this.publicBaseUrl}/stream?${params.toString()}`;
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    const fullPath = this.resolvePath(storageKey);
    try {
      await fsp.unlink(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async fileExists(storageKey: string): Promise<boolean> {
    try {
      await fsp.access(this.resolvePath(storageKey));
      return true;
    } catch {
      return false;
    }
  }
}
