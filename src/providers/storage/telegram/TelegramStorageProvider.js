import { Readable } from "stream";
import { TelegramClient } from "./telegramClient";
import { createLogger } from "../../../utils/logger";
import { BadRequestError, UpstreamServiceError } from "../../../utils/errors";
const logger = createLogger("TelegramStorageProvider");
/**
 * A storage key encodes everything needed to fetch/delete the file later
 * WITHOUT a database round-trip:
 *
 *   "<chatId>:<messageId>:<fileId>"
 *
 * This keeps the provider stateless while still satisfying the plain
 * `deleteFile(key)` / `getVideoStream(key)` signatures required by the
 * interface.
 */
function encodeKey(chatId, messageId, fileId) {
    return `${chatId}:${messageId}:${fileId}`;
}
function decodeKey(storageKey) {
    const parts = storageKey.split(":");
    if (parts.length < 3)
        throw new BadRequestError(`Malformed Telegram storage key: "${storageKey}"`);
    const [chatId, messageIdStr, ...fileIdParts] = parts;
    const messageId = Number(messageIdStr);
    const fileId = fileIdParts.join(":");
    if (!chatId || Number.isNaN(messageId) || !fileId) {
        throw new BadRequestError(`Malformed Telegram storage key: "${storageKey}"`);
    }
    return { chatId, messageId, fileId };
}
export class TelegramStorageProvider {
    name = "telegram";
    client;
    chatId;
    publicBaseUrl;
    constructor(config) {
        this.client = new TelegramClient(config.botToken);
        this.chatId = config.chatId;
        this.publicBaseUrl = config.publicBaseUrl.replace(/\/$/, "");
    }
    async uploadVideo(file, _key) {
        // `_key` is accepted for interface parity with providers where the
        // caller chooses the object key (R2/S3/Supabase). Telegram assigns its
        // own file_id, so the real, resolvable storageKey is generated below.
        const result = await this.client.sendVideo(this.chatId, file);
        const video = result.video;
        if (!video)
            throw new UpstreamServiceError("Telegram did not return a video object after upload");
        const storageKey = encodeKey(String(result.chat.id), result.message_id, video.file_id);
        const autoThumbnailKey = video.thumbnail
            ? encodeKey(String(result.chat.id), result.message_id, video.thumbnail.file_id)
            : undefined;
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
    async uploadThumbnail(file, _key) {
        const result = await this.client.sendPhoto(this.chatId, file);
        const photos = result.photo;
        if (!photos || photos.length === 0) {
            throw new UpstreamServiceError("Telegram did not return photo sizes after thumbnail upload");
        }
        const largest = photos[photos.length - 1];
        const thumbnailKey = encodeKey(String(result.chat.id), result.message_id, largest.file_id);
        return { thumbnailKey, provider: this.name };
    }
    async getVideoStream(storageKey, range) {
        const { fileId } = decodeKey(storageKey);
        const rangeHeader = range ? `bytes=${range.start}-${range.end ?? ""}` : undefined;
        const resp = await this.client.fetchFileBytes(fileId, rangeHeader);
        if (!resp || !resp.ok) {
            throw new UpstreamServiceError(`Could not stream Telegram file for key "${storageKey}"`);
        }
        return {
            body: Readable.from(resp.body),
            contentType: resp.headers.get("content-type") || "video/mp4",
            contentLength: Number(resp.headers.get("content-length")) || undefined,
            acceptsRanges: true
        };
    }
    async getDownloadUrl(storageKey, options = {}) {
        // Never return a raw api.telegram.org/file/<bot_token>/... URL — always
        // route through this server's own /stream endpoint.
        const variant = options.variant || "video";
        const params = new URLSearchParams({ key: storageKey, variant, provider: this.name });
        return `${this.publicBaseUrl}/stream?${params.toString()}`;
    }
    async deleteFile(storageKey) {
        const { chatId, messageId } = decodeKey(storageKey);
        await this.client.deleteMessage(chatId, messageId);
        return true;
    }
    async fileExists(storageKey) {
        try {
            const { fileId } = decodeKey(storageKey);
            const info = await this.client.getFileInfo(fileId);
            return info !== null;
        }
        catch {
            return false;
        }
    }
}
export { encodeKey as encodeTelegramStorageKey, decodeKey as decodeTelegramStorageKey };
