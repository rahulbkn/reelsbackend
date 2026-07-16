import type {
  DownloadUrlOptions,
  MediaFile,
  StorageProvider,
  StreamResult,
  ThumbnailUploadResult,
  UploadResult
} from "../../../types/storage";
import { ProviderNotImplementedError } from "../../../utils/errors";

export interface S3StorageProviderConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

/**
 * Skeleton for any S3-compatible backend (AWS S3, Backblaze B2, MinIO,
 * etc). Implement using the AWS SDK v3 S3 client pointed at `endpoint`,
 * register in StorageFactory.ts, and set STORAGE_PROVIDER=s3 to activate.
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";

  constructor(private readonly config: S3StorageProviderConfig) {}

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
