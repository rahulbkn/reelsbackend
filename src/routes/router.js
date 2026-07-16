import { Router } from "express";
import { uploadMiddleware } from "../utils/upload";
export function buildRouter(container) {
    const router = Router();
    // --- Videos: upload, feed, detail, interactions, delete -----------------
    router.post("/api/videos", uploadMiddleware, container.videoUploadController.handle);
    router.get("/api/videos", container.videoFeedController.getFeed);
    router.get("/api/videos/:id", container.videoFeedController.getById);
    router.post("/api/videos/:id/view", container.videoFeedController.recordView);
    router.post("/api/videos/:id/like", container.videoFeedController.like);
    router.post("/api/videos/:id/share", container.videoFeedController.share);
    router.delete("/api/videos/:id", container.videoDeleteController.handle);
    // --- Generic media stream — works for whichever provider is active -----
    router.get("/stream", container.streamController.handle);
    router.get("/health", (_req, res) => res.json({ success: true, provider: container.storage.name }));
    return router;
}
