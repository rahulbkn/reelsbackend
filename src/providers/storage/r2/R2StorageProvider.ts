import type {
  DownloadUrlOptions,
  MediaFile,
  StorageProvider,
  StreamResult,
  ThumbnailUploadResult,
  UploadResult
} from "../../../types/storage";
import { ProviderNotImplementedError } from "../../../utils/errors";

export interface R2StorageProviderConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl?: string;
}

/**
 * Skeleton for a Cloudflare R2-backed provider (S3-compatible API). To
 * activate:
 *   1. Implement each method using the S3-compatible R2 endpoint
 *      (`https://<accountId>.r2.cloudflarestorage.com`), e.g. via
 *      aws4fetch or the AWS SDK v3 S3 client pointed at that endpoint.
 *   2. Register it in StorageFactory.ts.
 *   3. Set STORAGE_PROVIDER=r2 — no other code changes required.
 */
export class R2StorageProvider implements StorageProvider {
  readonly name = "r2";

  constructor(private readonly config: R2StorageProviderConfig) {}

  async uploadVideo(_file: MediaFile, _key: string): Promise<UploadResult> {
    throw new ProviderNotImplementedError(this.name);
  }

  async uploadThumbnail(_file: MediaFile, _key: string): Promise<ThumbnailUploadResult> {
    throw new ProviderNotImplementedError(this.name);
  }

  async getVideoStream(_storageKey: string): Promise<StreamResult> {
    throw new ProviderNotImplementedError(this.name);
  }

  async getDownloadUrl(_storageKey: string, _options?: DownloadUrlOptions): Promise<string> {
    throw new ProviderNotImplementedError(this.name);
  }

  async deleteFile(_storageKey: string): Promise<boolean> {
    throw new ProviderNotImplementedError(this.name);
  }

  async fileExists(_storageKey: string): Promise<boolean> {
    throw new ProviderNotImplementedError(this.name);
  }
}
