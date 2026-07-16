import type { Request, Response, NextFunction } from "express";
import type { ExecutionContext, KVNamespace } from "@cloudflare/workers-types";
import crypto from "crypto";
import { VideoUploadService } from "../services/VideoUploadService";
import { BadRequestError } from "../utils/errors";

export class ChunkedUploadController {
  constructor(
    private readonly uploadService: VideoUploadService,
    private readonly kv: KVNamespace | null
  ) {}

  private async checkRateLimit(ip: string): Promise<void> {
    if (!this.kv) return;
    const key = `ratelimit:upload:${ip}`;
    const count = Number(await this.kv.get(key)) || 0;
    if (count >= 10) throw new BadRequestError("Upload limit reached, try again in an hour");
    await this.kv.put(key, String(count + 1), { expirationTtl: 3600 });
  }

  initUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.checkRateLimit(req.ip || "unknown");
      const { title, description, uploader, category, hashtags, fileName, fileSize, mimeType, totalChunks } = req.body;
      if (!title?.trim()) throw new BadRequestError("title is required");
      if (!uploader?.trim()) throw new BadRequestError("uploader is required");
      if (!category?.trim()) throw new BadRequestError("category is required");
      if (!totalChunks) throw new BadRequestError("totalChunks is required");

      const uploadId = crypto.randomUUID();
      const tags = typeof hashtags === "string"
        ? hashtags.split(",").map((h: string) => h.trim()).filter(Boolean)
        : Array.isArray(hashtags) ? hashtags : [];

      if (this.kv) {
        await this.kv.put(`upload:${uploadId}:meta`, JSON.stringify({
          title: title.trim(),
          description: description?.trim(),
          uploader: uploader.trim(),
          category: category.trim(),
          hashtags: tags,
          fileName: fileName || "",
          fileSize: Number(fileSize) || 0,
          mimeType: mimeType || "video/mp4",
          totalChunks: Number(totalChunks),
        }), { expirationTtl: 86400 });
      }

      res.json({ uploadId });
    } catch (error) {
      next(error);
    }
  };

  uploadChunk = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uploadId = req.query.uploadId as string;
      const chunkIndex = req.query.index as string;
      if (!uploadId || chunkIndex === undefined) throw new BadRequestError("Missing uploadId or index query param");
      if (!this.kv) throw new BadRequestError("KV namespace not available");

      const b64 = req.body as string;
      if (!b64 || typeof b64 !== "string" || b64.length === 0) {
        throw new BadRequestError("No base64 chunk data in body");
      }

      const chunk = Buffer.from(b64, "base64");
      if (chunk.length === 0) throw new BadRequestError("Empty chunk after base64 decode");

      await this.kv.put(`upload:${uploadId}:chunk:${chunkIndex}`, chunk, { expirationTtl: 86400 });

      res.json({ success: true, chunkIndex: Number(chunkIndex) });
    } catch (error) {
      next(error);
    }
  };

  completeUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uploadId } = req.body;
      if (!uploadId) throw new BadRequestError("Missing uploadId");
      if (!this.kv) throw new BadRequestError("KV namespace not available");

      const metaStr = await this.kv.get(`upload:${uploadId}:meta`);
      if (!metaStr) throw new BadRequestError("Upload session not found or expired");
      const meta = JSON.parse(metaStr);

      const { title, description, uploader, category, hashtags, mimeType, totalChunks, fileName } = meta;

      const chunks: Buffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        let found = false;
        for (let retry = 0; retry < 5; retry++) {
          const chunkData = await this.kv.get(`upload:${uploadId}:chunk:${i}`, { type: "arrayBuffer" });
          if (chunkData) {
            chunks.push(Buffer.from(chunkData));
            found = true;
            break;
          }
          await new Promise(r => setTimeout(r, 1000));
        }
        if (!found) {
          throw new BadRequestError(`Chunk ${i}/${totalChunks} not found after retries`);
        }
      }

      const delPromises = [this.kv.delete(`upload:${uploadId}:meta`)];
      for (let i = 0; i < totalChunks; i++) {
        delPromises.push(this.kv.delete(`upload:${uploadId}:chunk:${i}`));
      }
      Promise.all(delPromises).catch(() => {});

      const ctx = (req as any).ctx as ExecutionContext | undefined;
      const waitUntil = ctx ? (p: Promise<unknown>) => ctx.waitUntil(p) : undefined;

      const fullBuffer = Buffer.concat(chunks);

      const result = await this.uploadService.upload({
        video: { buffer: fullBuffer, mimeType: mimeType || "video/mp4", filename: fileName || "video.mp4" },
        title,
        description,
        hashtags,
        category,
        uploader,
      }, waitUntil);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
