export class VideoDeleteController {
    deleteService;
    constructor(deleteService) {
        this.deleteService = deleteService;
    }
    handle = async (req, res, next) => {
        try {
            const requesterUploader = typeof req.body?.uploader === "string" ? req.body.uploader : undefined;
            await this.deleteService.delete(req.params.id, requesterUploader);
            res.json({ success: true });
        }
        catch (error) {
            next(error);
        }
    };
}
