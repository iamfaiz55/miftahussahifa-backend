import fs from 'node:fs';

export interface ProcessImageOptions {
  quality?: number;
  maxWidth?: number;
}

export async function processImage(
  filePath: string,
  quality: number = 80,
  maxWidth: number = 1920
): Promise<string> {
  // If sharp is installed in the future, image processing can be applied here
  // Currently verifies file existence and returns the path
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return filePath;
}
