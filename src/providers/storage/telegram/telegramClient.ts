import { withRetry } from "../../../utils/retry";
import { createLogger } from "../../../utils/logger";
import { UpstreamServiceError } from "../../../utils/errors";
import type { TelegramFileInfo, TelegramMessageResult, TelegramResponse } from "../../../types/telegram";

const logger = createLogger("telegramClient");

export class TelegramClient {
  constructor(private readonly botToken: string, private readonly timeoutMs = 15000) {
    if (!botToken) throw new UpstreamServiceError("Telegram bot token is not configured");
  }

  private apiUrl(method: string): string {
    return `https://api.telegram.org/bot${this.botToken}/${method}`;
  }

  private fileUrl(filePath: string): string {
    return `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
  }

  async sendVideo(chatId: string, file: { data: Buffer; filename?: string; mimeType: string }): Promise<TelegramMessageResult> {
    return withRetry(
      async () => {
        const form = new FormData();
        form.append("chat_id", chatId);
        const blob = new Blob([file.data], { type: file.mimeType });
        form.append("video", blob, file.filename || "video.mp4");
        form.append("supports_streaming", "true");

        const resp = await fetch(this.apiUrl("sendVideo"), {
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(this.timeoutMs)
        });

        if (!resp.ok) {
          const errText = await resp.text();
          logger.error("sendVideo failed", { status: resp.status, body: errText.slice(0, 200) });
          throw new UpstreamServiceError(`Telegram sendVideo failed: ${errText.slice(0, 200)}`);
        }
        const result = (await resp.json()) as TelegramResponse<TelegramMessageResult>;
        if (!result.ok || !result.result) {
          throw new UpstreamServiceError(`Telegram sendVideo error: ${result.description || "unknown"}`);
        }
        return result.result;
      },
      { retries: 2, baseDelayMs: 2000 }
    );
  }

  async sendPhoto(chatId: string, file: { data: Buffer; filename?: string; mimeType: string }): Promise<TelegramMessageResult> {
    return withRetry(
      async () => {
        const form = new FormData();
        form.append("chat_id", chatId);
        const blob = new Blob([file.data], { type: file.mimeType });
        form.append("photo", blob, file.filename || "thumb.jpg");

        const resp = await fetch(this.apiUrl("sendPhoto"), {
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(this.timeoutMs)
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new UpstreamServiceError(`Telegram sendPhoto failed: ${errText.slice(0, 200)}`);
        }
        const result = (await resp.json()) as TelegramResponse<TelegramMessageResult>;
        if (!result.ok || !result.result) {
          throw new UpstreamServiceError(`Telegram sendPhoto error: ${result.description || "unknown"}`);
        }
        return result.result;
      },
      { retries: 2, baseDelayMs: 1500 }
    );
  }

  async getFileInfo(fileId: string): Promise<TelegramFileInfo | null> {
    try {
      const resp = await fetch(`${this.apiUrl("getFile")}?file_id=${encodeURIComponent(fileId)}`, {
        signal: AbortSignal.timeout(this.timeoutMs)
      });
      const data = (await resp.json()) as TelegramResponse<TelegramFileInfo>;
      if (!data.ok || !data.result) return null;
      return data.result;
    } catch (e: unknown) {
      logger.error("getFileInfo failed", { error: (e as Error).message });
      return null;
    }
  }

  async resolveFileUrl(fileId: string): Promise<string | null> {
    const info = await this.getFileInfo(fileId);
    if (!info?.file_path) return null;
    return this.fileUrl(info.file_path);
  }

  async fetchFileBytes(fileId: string, rangeHeader?: string, filePath?: string) {
    let url: string | null;
    if (filePath) {
      url = this.fileUrl(filePath);
    } else {
      url = await this.resolveFileUrl(fileId);
    }
    if (!url) return null;
    const headers: Record<string, string> = {};
    if (rangeHeader) headers.Range = rangeHeader;
    try {
      return await fetch(url, { headers, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch {
      return null;
    }
  }

  async deleteMessage(chatId: string, messageId: number): Promise<void> {
    if (!chatId || !messageId) return;
    try {
      await fetch(this.apiUrl("deleteMessage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (e: unknown) {
      logger.error("deleteMessage failed", { error: (e as Error).message });
    }
  }
}
