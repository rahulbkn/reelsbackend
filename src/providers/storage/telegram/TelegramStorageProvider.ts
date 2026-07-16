import { Readable } from "stream";
import type {
  DownloadUrlOptions,
  MediaFile,
  StorageProvider,
  StreamResult,
  ThumbnailUploadResult,
  UploadResult
} from "../../../types/storage";
import { TelegramClient } from "./telegramClient";
import { createLogger } from "../../../utils/logger";
import { BadRequestError, UpstreamServiceError } from "../../../utils/errors";

const logger = createLogger("TelegramStorageProvider");

/**
 * In-memory video cache, scoped to the current Worker isolate. Used as a
 * fast path before falling back to the shared edge cache (caches.default)
 * or Telegram's download API (which has a ~20 MB limit).
 */
const localVideoCache = new Map<string, { data: Buffer; mimeType: string }>();

const CACHE_NAMESPACE = "reels-video-cache";

export interface TelegramStorageProviderConfig {
  botToken: string;
  /** Channel/chat the bot posts into — acts as the "bucket". */
  chatId: string;
  /** Public base URL of THIS server, used to build /stream URLs. Clients
   *  only ever see this domain — never api.telegram.org, never the bot token. */
  publicBaseUrl: string;
}

/**
 * A storage key encodes everything needed to fetch/delete the file later
 * WITHOUT a database round-trip:
 *
 *   "<chatId>:<messageId>:<fileId>"
 *
 * Optionally includes <filePath> so getVideoStream can download directly
 * without calling getFile (which fails for files >20MB).
 *
 *   "<chatId>:<messageId>:<fileId>[:<filePath>]"
 *
 * filePath is base64-url-encoded to avoid colon ambiguity.
 */
function encodeKey(chatId: string, messageId: number, fileId: string, filePath?: string): string {
  const base = `${chatId}:${messageId}:${fileId}`;
  if (!filePath) return base;
  const safe = Buffer.from(filePath, "utf8").toString("base64url");
  return `${base}::${safe}`;
}

function decodeKey(storageKey: string): { chatId: string; messageId: number; fileId: string; filePath?: string } {
  const sepIdx = storageKey.indexOf("::");
  if (sepIdx !== -1) {
    const base = storageKey.slice(0, sepIdx);
    const encoded = storageKey.slice(sepIdx + 2);
    const parts = base.split(":");
    if (parts.length >= 3) {
      const [chatId, messageIdStr, ...fileIdParts] = parts;
      const messageId = Number(messageIdStr);
      if (chatId && !Number.isNaN(messageId)) {
        try {
          const filePath = Buffer.from(encoded, "base64url").toString("utf8");
          return { chatId, messageId, fileId: fileIdParts.join(":"), filePath };
        } catch {}
      }
    }
  }
  const parts = storageKey.split(":");
  if (parts.length < 3) throw new BadRequestError(`Malformed Telegram storage key: "${storageKey}"`);
  const [chatId, messageIdStr, ...fileIdParts] = parts;
  const messageId = Number(messageIdStr);
  const fileId = fileIdParts.join(":");
  if (!chatId || Number.isNaN(messageId) || !fileId) {
    throw new BadRequestError(`Malformed Telegram storage key: "${storageKey}"`);
  }
  return { chatId, messageId, fileId };
}

export class TelegramStorageProvider implements StorageProvider {
  readonly name = "telegram";
  private readonly client: TelegramClient;
  private readonly chatId: string;
  private readonly publicBaseUrl: string;

  constructor(config: TelegramStorageProviderConfig) {
    this.client = new TelegramClient(config.botToken);
    this.chatId = config.chatId;
    this.publicBaseUrl = config.publicBaseUrl.replace(/\/$/, "");
  }

  private cacheFile(fileId: string, data: Buffer, mimeType: string): void {
    localVideoCache.set(fileId, { data, mimeType });
    try {
      const cacheUrl = `https://${CACHE_NAMESPACE}/video/${fileId}`;
      const req = new Request(cacheUrl);
      const resp = new Response(data, {
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(data.length),
          "Cache-Control": "public, max-age=86400"
        }
      });
      caches.default.put(req, resp).catch(() => {});
    } catch {}
  }

  private async lookupCachedFile(fileId: string): Promise<{ data: Buffer | Readable; mimeType: string } | null> {
    const local = localVideoCache.get(fileId);
    if (local) return local;
    try {
      const cacheUrl = `https://${CACHE_NAMESPACE}/video/${fileId}`;
      const req = new Request(cacheUrl);
      const resp = await caches.default.match(req);
      if (resp && resp.ok) {
        const mimeType = resp.headers.get("content-type") || "video/mp4";
        const bytes = await resp.bytes();
        return { data: Buffer.from(bytes), mimeType };
      }
    } catch {}
    return null;
  }

  async uploadVideo(file: MediaFile, _key: string): Promise<UploadResult> {
    const result = await this.client.sendVideo(this.chatId, file);
    const video = result.video;
    if (!video) throw new UpstreamServiceError("Telegram did not return a video object after upload");

    const filePath = await this.getFilePath(video.file_id);
    const storageKey = encodeKey(String(result.chat.id), result.message_id, video.file_id, filePath ?? undefined);
    const autoThumbnailKey = video.thumbnail
      ? encodeKey(String(result.chat.id), result.message_id, video.thumbnail.file_id)
      : undefined;

    this.cacheFile(video.file_id, file.data, file.mimeType);

    return {
      storageKey,
      storageUniqueId: video.file_unique_id,
      mimeType: video.mime_type || file.mimeType,
      fileSize: video.file_size || file.data.length,
      width: video.width || 0,
      height: video.height || 0,
      duration: video.duration || 0,
      provider: this.name,
      autoThumbnailKey
    };
  }

  private async getFilePath(fileId: string): Promise<string | null> {
    try {
      const info = await this.client.getFileInfo(fileId);
      return info?.file_path ?? null;
    } catch {
      return null;
    }
  }

  async uploadThumbnail(file: MediaFile, _key: string): Promise<ThumbnailUploadResult> {
    const result = await this.client.sendPhoto(this.chatId, file);
    const photos = result.photo;
    if (!photos || photos.length === 0) {
      throw new UpstreamServiceError("Telegram did not return photo sizes after thumbnail upload");
    }
    const largest = photos[photos.length - 1];
    const thumbnailKey = encodeKey(String(result.chat.id), result.message_id, largest.file_id);
    return { thumbnailKey, provider: this.name };
  }

  async getVideoStream(storageKey: string, range?: { start: number; end?: number }): Promise<StreamResult> {
    let fileId: string;
    let filePath: string | undefined;
    try {
      const decoded = decodeKey(storageKey);
      fileId = decoded.fileId;
      filePath = decoded.filePath;
    } catch {
      fileId = storageKey;
      filePath = undefined;
    }

    const cached = await this.lookupCachedFile(fileId);
    if (cached) {
      if (cached.data instanceof Buffer) {
        const buf = cached.data;
        const totalSize = buf.length;
        let start = 0;
        let end = totalSize - 1;
        if (range) {
          start = Math.max(0, range.start);
          end = range.end !== undefined ? Math.min(range.end, totalSize - 1) : totalSize - 1;
        }
        const chunk = buf.slice(start, end + 1);
        return {
          body: Readable.from([chunk]),
          contentType: cached.mimeType,
          contentLength: chunk.length,
          contentRange: range ? `bytes ${start}-${end}/${totalSize}` : undefined,
          acceptsRanges: true
        };
      }
      return {
        body: Readable.from(cached.data as any),
        contentType: cached.mimeType,
        acceptsRanges: true
      };
    }

    const rangeHeader = range ? `bytes=${range.start}-${range.end ?? ""}` : undefined;
    const resp = await this.client.fetchFileBytes(fileId, rangeHeader, filePath);
    if (!resp || !resp.ok) {
      throw new UpstreamServiceError(`Could not stream Telegram file for key "${storageKey}"`);
    }
    const cr = resp.headers.get("content-range") || undefined;
    return {
      body: Readable.from(resp.body as any),
      contentType: resp.headers.get("content-type") || "video/mp4",
      contentLength: Number(resp.headers.get("content-length")) || undefined,
      contentRange: cr,
      acceptsRanges: true
    };
  }

  async getDownloadUrl(storageKey: string, options: DownloadUrlOptions = {}): Promise<string> {
    // Never return a raw api.telegram.org/file/<bot_token>/... URL — always
    // route through this server's own /stream endpoint.
    const variant = options.variant || "video";
    const params = new URLSearchParams({ key: storageKey, variant, provider: this.name });
    return `${this.publicBaseUrl}/stream?${params.toString()}`;
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    const { chatId, messageId } = decodeKey(storageKey);
    await this.client.deleteMessage(chatId, messageId);
    return true;
  }

  async fileExists(storageKey: string): Promise<boolean> {
    try {
      const { fileId } = decodeKey(storageKey);
      const info = await this.client.getFileInfo(fileId);
      return info !== null;
    } catch {
      return false;
    }
  }
}

export { encodeKey as encodeTelegramStorageKey, decodeKey as decodeTelegramStorageKey };
