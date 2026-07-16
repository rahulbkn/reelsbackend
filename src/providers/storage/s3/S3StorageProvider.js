import { ProviderNotImplementedError } from "../../../utils/errors";
/**
 * Skeleton for any S3-compatible backend (AWS S3, Backblaze B2, MinIO,
 * etc). Implement using the AWS SDK v3 S3 client pointed at `endpoint`,
 * register in StorageFactory.ts, and set STORAGE_PROVIDER=s3 to activate.
 */
export class S3StorageProvider {
    config;
    name = "s3";
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
