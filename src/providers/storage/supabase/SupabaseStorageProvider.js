import { ProviderNotImplementedError } from "../../../utils/errors";
/**
 * Skeleton for a Supabase Storage-backed provider (REST calls to
 * `${supabaseUrl}/storage/v1/object/...`). Implement using the Supabase
 * Storage REST API directly and register in StorageFactory.ts. Set
 * STORAGE_PROVIDER=supabase to activate.
 */
export class SupabaseStorageProvider {
    config;
    name = "supabase";
    constructor(config) {
        this.config = config;
    }
    async uploadVideo(_file, _key) {
        throw new ProviderNotImplementedError(this.name);
    }
    async uploadThumbnail(_file, _key) {
        throw new ProviderNotImplementedError(this.name);
    }
    async getVideoStream(_storageKey) {
        throw new ProviderNotImplementedError(this.name);
    }
    async getDownloadUrl(_storageKey, _options) {
        throw new ProviderNotImplementedError(this.name);
    }
    async deleteFile(_storageKey) {
        throw new ProviderNotImplementedError(this.name);
    }
    async fileExists(_storageKey) {
        throw new ProviderNotImplementedError(this.name);
    }
}
