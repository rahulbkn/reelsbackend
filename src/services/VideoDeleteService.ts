import type { StorageProvider } from "../types/storage";
import type { VideoRepository } from "../repositories/VideoRepository";
import { ForbiddenError, NotFoundError } from "../utils/errors";
import { createLogger } from "../utils/logger";

const logger = createLogger("VideoDeleteService");

export class VideoDeleteService {
  constructor(private readonly storage: StorageProvider, private readonly videos: VideoRepository) {}

  async delete(id: string, requesterUploader?: string): Promise<void> {
    const record = await this.videos.getById(id);
    if (!record) throw new NotFoundError(`Video "${id}" not found`);

    if (requesterUploader && record.uploader !== requesterUploader) {
      throw new ForbiddenError("You can only delete your own videos");
    }

    if (record.thumbnailKey && record.thumbnailKey !== record.storageKey) {
      await this.storage.deleteFile(record.thumbnailKey).catch((e: unknown) =>
        logger.error("thumbnail delete failed", { error: (e as Error).message })
      );
    }

    await this.storage.deleteFile(record.storageKey).catch((e: unknown) =>
      logger.error("video delete failed", { error: (e as Error).message, storageKey: record.storageKey })
    );

    await this.videos.delete(id);
    logger.info("video deleted", { id });
  }
}
