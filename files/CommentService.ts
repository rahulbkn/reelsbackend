import type { CommentRepository } from "../repositories/CommentRepository";
import type { VideoRepository } from "../repositories/VideoRepository";
import type { Comment } from "../types/comment";
import { BadRequestError, NotFoundError } from "../utils/errors";

const MAX_COMMENT_LENGTH = 2000;
const MAX_AUTHOR_LENGTH = 80;

export class CommentService {
  constructor(
    private readonly comments: CommentRepository,
    private readonly videos: VideoRepository
  ) {}

  async add(videoId: string, author: string | undefined, text: string | undefined): Promise<Comment> {
    const video = await this.videos.getById(videoId);
    if (!video) throw new NotFoundError(`Video "${videoId}" not found`);

    const trimmedText = text?.trim();
    if (!trimmedText) throw new BadRequestError("text is required");
    if (trimmedText.length > MAX_COMMENT_LENGTH) {
      throw new BadRequestError(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`);
    }

    const trimmedAuthor = (author?.trim() || "Anonymous").slice(0, MAX_AUTHOR_LENGTH);

    const comment = await this.comments.create({ videoId, author: trimmedAuthor, text: trimmedText });
    await this.videos.incrementCounter(videoId, "comments");
    return comment;
  }

  async list(
    videoId: string,
    page: number,
    perPage: number
  ): Promise<{ items: Comment[]; total: number; page: number; perPage: number }> {
    const video = await this.videos.getById(videoId);
    if (!video) throw new NotFoundError(`Video "${videoId}" not found`);

    const { items, total } = await this.comments.listByVideo(videoId, { page, perPage });
    return { items, total, page, perPage };
  }
}
