/**
 * The canonical StorageProvider contract lives in /types/storage.ts.
 * Re-exported here so `import { StorageProvider } from
 * "providers/storage/StorageProvider"` also works, matching the folder
 * layout requested for this architecture.
 */
export type {
  StorageProvider,
  MediaFile,
  UploadResult,
  ThumbnailUploadResult,
  StreamResult,
  DownloadUrlOptions
} from "../../types/storage";
