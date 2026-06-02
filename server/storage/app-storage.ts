import { Client } from '@replit/object-storage';
import { Readable } from 'stream';

// Initialize Object Storage client with bucket name from environment
// In Replit, use REPL_SLUG as bucket name for automatic bucket creation
const bucketName = process.env.REPL_SLUG || 'mangaverse';
const client = new Client({ bucketId: bucketName });

export async function uploadImage(
  buffer: Buffer,
  filename: string,
  folder: 'covers' | 'chapters'
): Promise<string> {
  try {
    const key = `${folder}/${filename}`;
    console.log(`[AppStorage] Uploading image to: ${key}`);
    
    await client.uploadFromBytes(key, buffer);
    
    console.log(`[AppStorage] Successfully uploaded: ${key}`);
    return key;
  } catch (error) {
    console.error(`[AppStorage] Error uploading image ${filename}:`, error);
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getImageStream(filename: string): Promise<Readable> {
  try {
    console.log(`[AppStorage] Retrieving image: ${filename}`);
    
    const stream = await client.downloadAsStream(filename);
    
    console.log(`[AppStorage] Successfully retrieved stream for: ${filename}`);
    return stream;
  } catch (error) {
    console.error(`[AppStorage] Error retrieving image ${filename}:`, error);
    throw new Error(`Failed to retrieve image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getImageBytes(filename: string): Promise<Buffer> {
  try {
    console.log(`[AppStorage] Retrieving image bytes: ${filename}`);
    
    const result = await client.downloadAsBytes(filename);
    
    if (!result.ok) {
      console.error(`[AppStorage] Download failed for ${filename}:`, JSON.stringify(result.error, null, 2));
      throw new Error(`Failed to download bytes: ${JSON.stringify(result.error)}`);
    }
    
    // result.value is typed as [Buffer] (tuple with one Buffer element)
    const buffer = Array.isArray(result.value) ? result.value[0] : result.value as Buffer;
    console.log(`[AppStorage] Successfully retrieved ${buffer.length} bytes for: ${filename}`);
    return buffer;
  } catch (error) {
    console.error(`[AppStorage] Error retrieving image bytes ${filename}:`, error);
    throw new Error(`Failed to retrieve image bytes: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deleteImage(filename: string): Promise<void> {
  try {
    console.log(`[AppStorage] Deleting image: ${filename}`);
    
    await client.delete(filename);
    
    console.log(`[AppStorage] Successfully deleted: ${filename}`);
  } catch (error) {
    console.error(`[AppStorage] Error deleting image ${filename}:`, error);
    throw new Error(`Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function listImages(prefix: string): Promise<string[]> {
  try {
    console.log(`[AppStorage] Listing images with prefix: ${prefix}`);
    
    const result = await client.list({ prefix });
    
    if (!result.ok) {
      throw new Error(`Failed to list objects: ${result.error}`);
    }
    
    const keys = result.value.map((obj: any) => obj.key);
    
    console.log(`[AppStorage] Found ${keys.length} images with prefix: ${prefix}`);
    return keys;
  } catch (error) {
    console.error(`[AppStorage] Error listing images with prefix ${prefix}:`, error);
    throw new Error(`Failed to list images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
