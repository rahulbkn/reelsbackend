import type { Request, Response, NextFunction } from "express";
import { BadRequestError, UpstreamServiceError } from "../utils/errors";
import { createLogger } from "../utils/logger";

const logger = createLogger("HlsController");
const CACHE_NAMESPACE = "reels-video-cache";
const SEGMENT_SIZE = 2 * 1024 * 1024; // 2 MB per segment

export class HlsController {
  handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = String(req.query.key || "");
      if (!key) throw new BadRequestError("Missing 'key' query parameter");

      const fileId = this.extractFileId(key);
      if (!fileId) throw new BadRequestError("Invalid storage key");

      const fileSize = await this.resolveFileSize(fileId, key);
      if (!fileSize || fileSize <= 0) {
        throw new UpstreamServiceError("Could not determine file size for HLS manifest");
      }

      const numSegments = Math.ceil(fileSize / SEGMENT_SIZE);
      const streamPath = `/stream?key=${encodeURIComponent(key)}&variant=video`;
      const targetDuration = 10;

      let playlist = `#EXTM3U\n#EXT-X-VERSION:4\n#EXT-X-TARGETDURATION:${targetDuration}\n`;
      playlist += `#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:VOD\n`;

      for (let i = 0; i < numSegments; i++) {
        const start = i * SEGMENT_SIZE;
        const end = Math.min(start + SEGMENT_SIZE, fileSize);
        const byteLength = end - start;
        playlist += `#EXTINF:${targetDuration},\n#EXT-X-BYTERANGE:${byteLength}@${start}\n${streamPath}\n`;
      }

      playlist += "#EXT-X-ENDLIST\n";

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Content-Disposition", 'attachment; filename="playlist.m3u8"');
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(playlist);
    } catch (error) {
      next(error);
    }
  };

  private extractFileId(storageKey: string): string | null {
    const sepIdx = storageKey.indexOf("::");
    const base = sepIdx !== -1 ? storageKey.slice(0, sepIdx) : storageKey;
    const parts = base.split(":");
    if (parts.length < 3) return null;
    return parts.slice(2).join(":");
  }

  private async resolveFileSize(fileId: string, storageKey: string): Promise<number | null> {
    try {
      const cacheUrl = `https://${CACHE_NAMESPACE}/video/${fileId}`;
      const cached = await caches.default.match(new Request(cacheUrl));
      if (cached?.ok) {
        const len = Number(cached.headers.get("content-length"));
        if (len > 0) return len;
      }
    } catch {}

    try {
      const url = new URL("/stream", "https://reels-backend.rahulkumarbknv.workers.dev");
      url.searchParams.set("key", storageKey);
      url.searchParams.set("variant", "video");
      const headResp = await fetch(url.toString(), { method: "HEAD" });
      if (headResp.ok) {
        const len = Number(headResp.headers.get("content-length"));
        if (len > 0) return len;
      }
    } catch (e) {
      logger.error("resolveFileSize HEAD failed", { error: (e as Error).message });
    }

    return null;
  }
}
