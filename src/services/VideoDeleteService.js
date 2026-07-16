import { ForbiddenError, NotFoundError } from "../utils/errors";
import { createLogger } from "../utils/logger";
const logger = createLogger("VideoDeleteService");
export class VideoDeleteService {
    storage;
    videos;
    constructor(storage, videos) {
        this.storage = storage;
        this.videos = videos;
    }
    async delete(id, requesterUploader) {
        const record = await this.videos.getById(id);
        if (!record)
            throw new NotFoundError(`Video "${id}" not found`);
        if (requesterUploader && record.uploader !== requesterUploader) {
            throw new ForbiddenError("You can only delete your own videos");
        }
        if (record.thumbnailKey && record.thumbnailKey !== record.storageKey) {
            await this.storage.deleteFile(record.thumbnailKey).catch((e) => logger.error("thumbnail delete failed", { error: e.message }));
        }
        await this.storage.deleteFile(record.storageKey).catch((e) => logger.error("video delete failed", { error: e.message, storageKey: record.storageKey }));
        await this.videos.delete(id);
        logger.info("video deleted", { id });
    }
}
