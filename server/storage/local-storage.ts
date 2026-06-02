import fs from 'fs/promises';
import path from 'path';

const STORAGE_BASE_PATH = path.join(process.cwd(), 'data', 'storage');

function sanitizeFilePath(filename: string, folder: 'covers' | 'chapters'): string {
  const normalized = path.normalize(filename);
  
  if (normalized.includes('..') || path.isAbsolute(normalized) || normalized.includes('\\')) {
    throw new Error(`Invalid file path: ${filename}`);
  }
  
  const basename = path.basename(normalized);
  const fullPath = path.join(STORAGE_BASE_PATH, folder, basename);
  
  if (!fullPath.startsWith(STORAGE_BASE_PATH)) {
    throw new Error(`Path traversal attempt detected: ${filename}`);
  }
  
  return fullPath;
}

export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

export async function uploadImage(
  buffer: Buffer,
  filename: string,
  folder: 'covers' | 'chapters'
): Promise<string> {
  try {
    const filePath = sanitizeFilePath(filename, folder);
    const folderPath = path.dirname(filePath);
    await ensureDirectory(folderPath);
    
    console.log(`[LocalStorage] Uploading image to: ${filePath}`);
    
    await fs.writeFile(filePath, buffer);
    
    console.log(`[LocalStorage] Successfully uploaded: ${filePath}`);
    return path.join(folder, path.basename(filename));
  } catch (error) {
    console.error(`[LocalStorage] Error uploading image ${filename}:`, error);
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getImageBuffer(filename: string): Promise<Buffer> {
  try {
    const normalized = path.normalize(filename);
    if (normalized.includes('..') || path.isAbsolute(normalized)) {
      throw new Error(`Invalid file path: ${filename}`);
    }
    
    const filePath = path.join(STORAGE_BASE_PATH, normalized);
    
    if (!filePath.startsWith(STORAGE_BASE_PATH)) {
      throw new Error(`Path traversal attempt detected: ${filename}`);
    }
    
    console.log(`[LocalStorage] Retrieving image: ${filePath}`);
    
    const buffer = await fs.readFile(filePath);
    
    console.log(`[LocalStorage] Successfully retrieved ${buffer.length} bytes for: ${filename}`);
    return buffer;
  } catch (error) {
    console.error(`[LocalStorage] Error retrieving image ${filename}:`, error);
    throw new Error(`Failed to retrieve image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deleteImage(filename: string): Promise<void> {
  try {
    const normalized = path.normalize(filename);
    if (normalized.includes('..') || path.isAbsolute(normalized)) {
      throw new Error(`Invalid file path: ${filename}`);
    }
    
    const filePath = path.join(STORAGE_BASE_PATH, normalized);
    
    if (!filePath.startsWith(STORAGE_BASE_PATH)) {
      throw new Error(`Path traversal attempt detected: ${filename}`);
    }
    
    console.log(`[LocalStorage] Deleting image: ${filePath}`);
    
    await fs.unlink(filePath);
    
    console.log(`[LocalStorage] Successfully deleted: ${filePath}`);
  } catch (error) {
    console.error(`[LocalStorage] Error deleting image ${filename}:`, error);
    throw new Error(`Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function listImages(prefix: string): Promise<string[]> {
  try {
    const normalized = path.normalize(prefix);
    if (normalized.includes('..') || path.isAbsolute(normalized)) {
      throw new Error(`Invalid path: ${prefix}`);
    }
    
    const dirPath = path.join(STORAGE_BASE_PATH, normalized);
    
    if (!dirPath.startsWith(STORAGE_BASE_PATH)) {
      throw new Error(`Path traversal attempt detected: ${prefix}`);
    }
    
    console.log(`[LocalStorage] Listing images in: ${dirPath}`);
    
    await ensureDirectory(dirPath);
    const files = await fs.readdir(dirPath);
    
    const fullPaths = files.map(file => path.join(prefix, file));
    
    console.log(`[LocalStorage] Found ${fullPaths.length} images in: ${prefix}`);
    return fullPaths;
  } catch (error) {
    console.error(`[LocalStorage] Error listing images in ${prefix}:`, error);
    throw new Error(`Failed to list images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
