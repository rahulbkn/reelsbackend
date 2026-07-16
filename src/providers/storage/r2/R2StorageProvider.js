import { ProviderNotImplementedError } from "../../../utils/errors";
/**
 * Skeleton for a Cloudflare R2-backed provider (S3-compatible API). To
 * activate:
 *   1. Implement each method using the S3-compatible R2 endpoint
 *      (`https://<accountId>.r2.cloudflarestorage.com`), e.g. via
 *      aws4fetch or the AWS SDK v3 S3 client pointed at that endpoint.
 *   2. Register it in StorageFactory.ts.
 *   3. Set STORAGE_PROVIDER=r2 — no other code changes required.
 */
export class R2StorageProvider {
    config;
    name = "r2";
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
