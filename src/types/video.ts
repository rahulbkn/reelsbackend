/**
 * Metadata that lives in the database — deliberately storage agnostic.
 * Never store a Telegram file_id, R2 URL, etc. directly here; that lives
 * behind storageProvider + storageKey/thumbnailKey, resolved on read via
 * the active StorageProvider.
 */
export interface VideoMetadata {
  id: string;
  title: string;
  description?: string;
  hashtags: string[];
  category: string;
  language?: string;
  duration: number; // seconds
  width: number;
  height: number;
  uploader: string;
  uploadDate: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;

  storageProvider: string;
  storageKey: string;
  thumbnailKey?: string;
  qualities?: Record<string, string>;
}

export type CreateVideoMetadata = Omit<
  VideoMetadata,
  "id" | "views" | "likes" | "comments" | "shares" | "uploadDate"
> & { uploadDate?: number };

/** Provider-independent shape returned to API clients. Clients must never
 *  learn whether the bytes live in Telegram, R2, or Supabase. */
export interface ClientVideoView {
  id: string;
  title: string;
  description?: string;
  hashtags: string[];
  category: string;
  language?: string;
  duration: number;
  width: number;
  height: number;
  uploader: string;
  uploadDate: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  videoUrl: string;
  thumbnailUrl: string;
  qualities?: Record<string, string>;
}

export interface UploadVideoResult extends ClientVideoView {
  ownerToken: string;
}
