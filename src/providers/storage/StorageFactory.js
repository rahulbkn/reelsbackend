import { validateProviderConfig } from "./config";
import { TelegramStorageProvider } from "./telegram/TelegramStorageProvider";
import { R2StorageProvider } from "./r2/R2StorageProvider";
import { SupabaseStorageProvider } from "./supabase/SupabaseStorageProvider";
import { S3StorageProvider } from "./s3/S3StorageProvider";
import { LocalStorageProvider } from "./local/LocalStorageProvider";
import { ServerConfigError } from "../../utils/errors";
/**
 * Builds the active StorageProvider from `env.STORAGE_PROVIDER`. This is
 * the ONLY place that knows every provider class exists — routes,
 * controllers and services only ever see the StorageProvider interface.
 *
 * Migrating from Telegram to R2 later is exactly:
 *   1. Implement R2StorageProvider's methods (skeleton already in place).
 *   2. Set STORAGE_PROVIDER=r2 in your .env / deployment config.
 *   Nothing else changes.
 */
export function createStorageProvider(env) {
    const providerName = env.STORAGE_PROVIDER;
    validateProviderConfig(providerName, env);
    switch (providerName) {
        case "telegram":
            return new TelegramStorageProvider({
                botToken: env.TELEGRAM_BOT_TOKEN,
                chatId: env.TELEGRAM_CHAT_ID,
                publicBaseUrl: env.PUBLIC_BASE_URL
            });
        case "r2":
            return new R2StorageProvider({
                accountId: env.R2_ACCOUNT_ID,
                accessKeyId: env.R2_ACCESS_KEY_ID,
                secretAccessKey: env.R2_SECRET_ACCESS_KEY,
                bucket: env.R2_BUCKET,
                publicBaseUrl: env.R2_PUBLIC_BASE_URL
            });
        case "supabase":
            return new SupabaseStorageProvider({
                supabaseUrl: env.SUPABASE_URL,
                serviceKey: env.SUPABASE_SERVICE_KEY,
                bucket: env.SUPABASE_BUCKET
            });
        case "s3":
            return new S3StorageProvider({
                endpoint: env.S3_ENDPOINT,
                region: env.S3_REGION || "auto",
                accessKeyId: env.S3_ACCESS_KEY_ID,
                secretAccessKey: env.S3_SECRET_ACCESS_KEY,
                bucket: env.S3_BUCKET
            });
        case "local":
            return new LocalStorageProvider({
                root: env.LOCAL_STORAGE_ROOT,
                publicBaseUrl: env.PUBLIC_BASE_URL
            });
        default:
            throw new ServerConfigError(`Unknown STORAGE_PROVIDER: "${providerName}"`);
    }
}
