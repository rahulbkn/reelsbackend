import type { Env, StorageProviderName } from "../../config/env";
import { ServerConfigError } from "../../utils/errors";

export function validateProviderConfig(providerName: StorageProviderName, env: Env): void {
  switch (providerName) {
    case "telegram":
      if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
        throw new ServerConfigError("Telegram storage provider requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID");
      }
      return;
    case "r2":
      if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
        throw new ServerConfigError("R2 storage provider requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET");
      }
      return;
    case "supabase":
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY || !env.SUPABASE_BUCKET) {
        throw new ServerConfigError("Supabase storage provider requires SUPABASE_URL, SUPABASE_SERVICE_KEY and SUPABASE_BUCKET");
      }
      return;
    case "s3":
      if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_BUCKET) {
        throw new ServerConfigError("S3 storage provider requires S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_BUCKET");
      }
      return;
    case "local":
      if (!env.LOCAL_STORAGE_ROOT) {
        throw new ServerConfigError("Local storage provider requires LOCAL_STORAGE_ROOT");
      }
      return;
    default:
      throw new ServerConfigError(`Unknown STORAGE_PROVIDER: "${providerName}"`);
  }
}
