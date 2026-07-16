import type {
  DownloadUrlOptions,
  MediaFile,
  StorageProvider,
  StreamResult,
  ThumbnailUploadResult,
  UploadResult
} from "../../../types/storage";
import { ProviderNotImplementedError } from "../../../utils/errors";

export interface SupabaseStorageProviderConfig {
  supabaseUrl: string;
  serviceKey: string;
  bucket: string;
}

/**
 * Skeleton for a Supabase Storage-backed provider (REST calls to
 * `${supabaseUrl}/storage/v1/object/...`). Implement using the Supabase
 * Storage REST API directly and register in StorageFactory.ts. Set
 * STORAGE_PROVIDER=supabase to activate.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = "supabase";

  constructor(private readonly config: SupabaseStorageProviderConfig) {}

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
