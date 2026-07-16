import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { NotFoundError } from "../../../utils/errors";
/**
 * Fully working local-disk provider — useful for dev/testing without
 * touching Telegram or a cloud bucket, and doubles as a concrete proof that
 * StorageFactory + STORAGE_PROVIDER genuinely swap implementations with no
 * other code changes. Files are addressed by a random key under `root`;
 * `getDownloadUrl` still routes through this server's own /stream endpoint,
 * exactly like the Telegram provider, so clients never see a filesystem path.
 */
export class LocalStorageProvider {
    name = "local";
    root;
    publicBaseUrl;
    constructor(config) {
        this.root = config.root;
        this.publicBaseUrl = config.publicBaseUrl.replace(/\/$/, "");
        fs.mkdirSync(this.root, { recursive: true });
    }
    resolvePath(storageKey) {
        // storageKey is always a value WE generated (below), so this is safe;
        // still guard against path traversal defensively.
        const safeKey = storageKey.replace(/\.\./g, "");
        return path.join(this.root, safeKey);
    }
    async uploadVideo(file, key) {
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
    async uploadThumbnail(file, key) {
        const thumbnailKey = `thumbnails/${Date.now()}-${crypto.randomUUID()}-${path.basename(key)}`;
        const fullPath = this.resolvePath(thumbnailKey);
        await fsp.mkdir(path.dirname(fullPath), { recursive: true });
        await fsp.writeFile(fullPath, file.data);
        return { thumbnailKey, provider: this.name };
    }
    async getVideoStream(storageKey, range) {
        const fullPath = this.resolvePath(storageKey);
        if (!fs.existsSync(fullPath))
            throw new NotFoundError(`No file at storageKey "${storageKey}"`);
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
    async getDownloadUrl(storageKey, options = {}) {
        const variant = options.variant || "video";
        const params = new URLSearchParams({ key: storageKey, variant, provider: this.name });
        return `${this.publicBaseUrl}/stream?${params.toString()}`;
    }
    async deleteFile(storageKey) {
        const fullPath = this.resolvePath(storageKey);
        try {
            await fsp.unlink(fullPath);
            return true;
        }
        catch {
            return false;
        }
    }
    async fileExists(storageKey) {
        try {
            await fsp.access(this.resolvePath(storageKey));
            return true;
        }
        catch {
            return false;
        }
    }
}
