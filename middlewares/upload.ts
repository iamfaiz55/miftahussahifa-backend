import type { Request } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { processImage } from '../utils/image.utils.js';

// Where to store files on disk
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Ensure the folder exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const PROFILE_IMAGE_DIR = path.join(UPLOAD_DIR, 'profile-images');
if (!fs.existsSync(PROFILE_IMAGE_DIR)) {
  fs.mkdirSync(PROFILE_IMAGE_DIR, { recursive: true });
}

const CAROUSEL_VIDEO_DIR = path.join(UPLOAD_DIR, 'carousel-videos');
if (!fs.existsSync(CAROUSEL_VIDEO_DIR)) {
  fs.mkdirSync(CAROUSEL_VIDEO_DIR, { recursive: true });
}

const GALLERY_VIDEO_DIR = path.join(UPLOAD_DIR, 'gallery-videos');
if (!fs.existsSync(GALLERY_VIDEO_DIR)) {
  fs.mkdirSync(GALLERY_VIDEO_DIR, { recursive: true });
}

// Create a safe, unique filename
function makeFilename(originalName: string) {
  const ext = path.extname(originalName).toLowerCase();
  const base = path
    .basename(originalName, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // slugify
    .replace(/(^-|-$)/g, '');
  const rand = crypto.randomBytes(6).toString('hex');
  return `${base}-${Date.now()}-${rand}${ext}`;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, makeFilename(file.originalname)),
});

const allowedImageMimes = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
]);

const allowedImageExtensions = new Set([
  '.png',
  '.jpeg',
  '.jpg',
  '.webp',
  '.gif',
  '.avif',
  '.svg',
]);

const allowedVideoMimes = new Set([
  'video/mp4',
  'video/avi',
  'video/mov',
  'video/wmv',
  'video/flv',
  'video/webm',
  'video/mkv',
]);

const allowedVideoExtensions = new Set([
  '.mp4',
  '.avi',
  '.mov',
  '.wmv',
  '.flv',
  '.webm',
  '.mkv',
]);

const allowedDocumentMimes = new Set([
  'application/pdf',
]);

const allowedDocumentExtensions = new Set([
  '.pdf',
]);

// Helper functions to check allowed file types
export const isImageFile = (mimetype: string, originalname: string): boolean => {
  const mimeLower = mimetype.toLowerCase();
  const extLower = path.extname(originalname).toLowerCase();
  return (
    mimeLower.startsWith('image/') ||
    allowedImageMimes.has(mimeLower) ||
    allowedImageExtensions.has(extLower) ||
    (mimeLower === 'application/octet-stream' && extLower === '')
  );
};

export const isVideoFile = (mimetype: string, originalname: string): boolean => {
  const mimeLower = mimetype.toLowerCase();
  const extLower = path.extname(originalname).toLowerCase();
  return (
    mimeLower.startsWith('video/') ||
    allowedVideoMimes.has(mimeLower) ||
    allowedVideoExtensions.has(extLower) ||
    (mimeLower === 'application/octet-stream' && extLower === '')
  );
};

export const isDocumentFile = (mimetype: string, originalname: string): boolean => {
  const mimeLower = mimetype.toLowerCase();
  const extLower = path.extname(originalname).toLowerCase();
  return (
    allowedDocumentMimes.has(mimeLower) ||
    allowedDocumentExtensions.has(extLower)
  );
};

const imageFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => void =
  (_req, file, cb) => {
    if (isImageFile(file.mimetype, file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(`Only image files are allowed! File: ${file.originalname} (Mimetype: ${file.mimetype})`));
    }
  };

const videoFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => void =
  (_req, file, cb) => {
    if (isVideoFile(file.mimetype, file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(`Only video files are allowed! File: ${file.originalname} (Mimetype: ${file.mimetype})`));
    }
  };

const documentFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => void =
  (_req, file, cb) => {
    if (isDocumentFile(file.mimetype, file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(`Only PDF files are allowed! File: ${file.originalname} (Mimetype: ${file.mimetype})`));
    }
  };

const mixedFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => void =
  (_req, file, cb) => {
    if (
      isImageFile(file.mimetype, file.originalname) ||
      isVideoFile(file.mimetype, file.originalname) ||
      isDocumentFile(file.mimetype, file.originalname)
    ) {
      cb(null, true);
    } else {
      cb(new Error(`Only image, video, and PDF files are allowed! File: ${file.originalname} (Mimetype: ${file.mimetype})`));
    }
  };

// Multer instances for different file types
export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFilter,
});

export const uploadVideo = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB for videos/parts
  fileFilter: videoFilter,
});

export const uploadDocument = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for PDFs
  fileFilter: documentFilter,
});

export const uploadMixed = multer({
  storage,
  // Allow larger files for video parts; thumbnails are small and unaffected
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max per file
  fileFilter: mixedFilter,
});

const profileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PROFILE_IMAGE_DIR),
  filename: (_req, file, cb) => cb(null, makeFilename(file.originalname)),
});

export const uploadProfileImage = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: imageFilter,
});

// Helper to get a public URL path you can save in DB
export const toPublicUrl = (filename: string) => `/uploads/${filename}`;

/**
 * Helper to process an uploaded image, delete the original non-webp file,
 * and update Multer file metadata to reflect the generated WebP file.
 */
const adjustProcessedFile = async (file: Express.Multer.File, quality: number, maxWidth?: number) => {
  if (!isImageFile(file.mimetype, file.originalname)) {
    return; // Skip non-images (like videos or PDFs)
  }

  // 1. Process image using existing processImage utility (compresses in-place + generates WebP versions)
  await processImage(file.path, quality, maxWidth);

  const ext = path.extname(file.path).toLowerCase();
  if (ext !== '.webp') {
    const dir = path.dirname(file.path);
    const fileName = path.basename(file.path, ext);
    const webpPath = path.join(dir, `${fileName}.webp`);

    if (fs.existsSync(webpPath)) {
      // 2. Delete original non-webp file (e.g. original .png or .jpg) to save disk space
      try {
        fs.unlinkSync(file.path);
      } catch (err: any) {
        console.error(`Failed to delete original file ${file.path}:`, err.message);
      }

      // 3. Update multer file properties to reflect the WebP file so controllers save the .webp path
      file.filename = `${fileName}.webp`;
      file.path = webpPath;
      file.mimetype = 'image/webp';
      file.size = fs.statSync(webpPath).size;
    }
  }
};

/**
 * Middleware to compress uploaded images.
 * Should be used after multer middleware.
 */
export const compressUploadedImages = async (req: Request, _res: any, next: any) => {
  try {
    let maxWidth = 1200; // Default for products & regular uploads
    if (req.originalUrl && (req.originalUrl.includes('carousel') || req.originalUrl.includes('offer-banner') || req.originalUrl.includes('banner'))) {
      maxWidth = 1920; // High resolution for sliders and banners
    }

    if (req.file) {
      await adjustProcessedFile(req.file, 75, maxWidth);
    }
    if (req.files) {
      // Handle both array and dictionary of files
      if (Array.isArray(req.files)) {
        for (const file of req.files) {
          await adjustProcessedFile(file, 75, maxWidth);
        }
      } else {
        const filesDict = req.files as { [fieldname: string]: Express.Multer.File[] };
        for (const fieldname in filesDict) {
          const files = filesDict[fieldname];
          if (files) {
            for (const file of files) {
              await adjustProcessedFile(file, 75, maxWidth);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in compressUploadedImages middleware:', error);
    // We don't want to block the request if compression fails
  }
  next();
};
