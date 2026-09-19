import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";

export const UPLOADS_DIR = process.env.UPLOADS_DIR || "/app/uploads";

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

const MIME_BY_EXT = Object.fromEntries(Object.entries(EXT_BY_MIME).map(([mime, ext]) => [ext, mime]));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || "";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!EXT_BY_MIME[file.mimetype]) {
      return cb(new Error("Only JPEG, PNG, GIF, WEBP, or SVG images are allowed"));
    }
    cb(null, true);
  },
});

export function deleteImageFile(image) {
  if (!image || /^https?:\/\//i.test(image)) return;
  fs.unlink(path.join(UPLOADS_DIR, image), () => {});
}

export function imageMimeFromFilename(filename) {
  return MIME_BY_EXT[path.extname(filename).toLowerCase()] || "application/octet-stream";
}

export function readImageBase64(image) {
  if (!image || /^https?:\/\//i.test(image)) return null;
  try {
    return fs.readFileSync(path.join(UPLOADS_DIR, image)).toString("base64");
  } catch {
    return null;
  }
}

export function writeImageFromBase64(mime, base64Data) {
  const ext = EXT_BY_MIME[mime];
  if (!ext || typeof base64Data !== "string") return null;
  const filename = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), Buffer.from(base64Data, "base64"));
  return filename;
}
