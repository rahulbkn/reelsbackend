import type { Request, Response, NextFunction } from "express";
import { VideoDeleteService } from "../services/VideoDeleteService";

export class VideoDeleteController {
  constructor(private readonly deleteService: VideoDeleteService) {}

  handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requesterUploader = typeof req.body?.uploader === "string" ? req.body.uploader : undefined;
      await this.deleteService.delete(req.params.id as string, requesterUploader);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };
}
