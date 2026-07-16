import type { StorageProvider } from "../types/storage";
import type { VideoRepository } from "../repositories/VideoRepository";
import type { ClientVideoView, VideoMetadata } from "../types/video";
import { NotFoundError } from "../utils/errors";
import type { CacheStore } from "../utils/cache";

const URL_CACHE_TTL_SECONDS = 300;

/**
 * Turns internal `VideoMetadata` (which knows about storageProvider /
 * storageKey) into `ClientVideoView` (which only has resolved URLs).
 * Clients hitting the feed/detail endpoints never learn whether a video
 * lives in Telegram, R2, or Supabase.
 */
export class VideoFeedService {
  constructor(private readonly storage: StorageProvider, private readonly videos: VideoRepository, private readonly cache: CacheStore) {}

  async getFeed(params: { page: number; perPage: number; category?: string; uploader?: string }): Promise<{ items: ClientVideoView[]; total: number; page: number; perPage: number }> {
    const { items, total } = await this.videos.list(params);
    const views = await Promise.all(items.map((v) => this.toClientView(v)));
    return { items: views, total, page: params.page, perPage: params.perPage };
  }

  async getById(id: string): Promise<ClientVideoView> {
    const record = await this.videos.getById(id);
    if (!record) throw new NotFoundError(`Video "${id}" not found`);
    return this.toClientView(record);
  }

  async recordView(id: string): Promise<void> {
    await this.videos.incrementCounter(id, "views");
  }

  async like(id: string): Promise<void> {
    await this.videos.incrementCounter(id, "likes");
  }

  async share(id: string): Promise<void> {
    await this.videos.incrementCounter(id, "shares");
  }

  private async toClientView(record: VideoMetadata): Promise<ClientVideoView> {
    const cacheKey = `download-url:${record.storageProvider}:${record.storageKey}:${record.thumbnailKey || ""}`;
    let urls = await this.cache.get<{ videoUrl: string; thumbnailUrl: string }>(cacheKey);
    if (!urls) {
      const videoUrl = await this.storage.getDownloadUrl(record.storageKey, { variant: "video" });
      const thumbnailUrl = record.thumbnailKey
        ? await this.storage.getDownloadUrl(record.thumbnailKey, { variant: "thumbnail" })
        : await this.storage.getDownloadUrl(record.storageKey, { variant: "thumbnail" });
      urls = { videoUrl, thumbnailUrl };
      await this.cache.set(cacheKey, urls, URL_CACHE_TTL_SECONDS);
    }

    let qualityUrls: Record<string, string> | undefined;
    if (record.qualities) {
      qualityUrls = {};
      for (const [label, key] of Object.entries(record.qualities)) {
        qualityUrls[label] = await this.storage.getDownloadUrl(key, { variant: "video" });
      }
    }

    return {
      id: record.id,
      title: record.title,
      description: record.description,
      hashtags: record.hashtags,
      category: record.category,
      language: record.language,
      duration: record.duration,
      width: record.width,
      height: record.height,
      uploader: record.uploader,
      uploadDate: record.uploadDate,
      views: record.views,
      likes: record.likes,
      comments: record.comments,
      shares: record.shares,
      videoUrl: urls.videoUrl,
      thumbnailUrl: urls.thumbnailUrl,
      qualities: qualityUrls
    };
  }
}
