import { Router, Request, Response } from "express";
import multer from "multer";
import { storageService } from "../services/storage";

export const storageRouter = Router();

// Configure multer for memory storage (files stay in memory as Buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// GET /storage/presigned?fileName=icon.png&contentType=image/png&folder=models
storageRouter.get("/presigned", async (req, res) => {
  const { fileName, contentType, folder } = req.query;

  if (!fileName || !contentType) {
    return res.status(400).json({ error: "missing_params" });
  }

  try {
    const data = await storageService.generateUploadUrl(
      (folder as string) || "uploads",
      (fileName as string),
      (contentType as string)
    );
    res.json(data);
  } catch (error) {
    console.error("Presign error", error);
    res.status(500).json({ error: "storage_error" });
  }
});

// Extend Request type to include multer's file property
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// POST /storage/upload - Upload file through backend (avoids CORS issues)
storageRouter.post("/upload", upload.single("file"), async (req: MulterRequest, res: Response) => {
  const file = req.file;
  const folder = (req.body.folder as string) || "vision-uploads";

  if (!file) {
    return res.status(400).json({ error: "no_file" });
  }

  try {
    const publicUrl = await storageService.uploadBuffer(
      file.buffer,
      folder,
      file.mimetype
    );
    res.json({ publicUrl, fileName: file.originalname });
  } catch (error) {
    console.error("Upload error", error);
    res.status(500).json({ error: "upload_failed" });
  }
});
