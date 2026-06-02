import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

export interface ImageOptimizationOptions {
  quality?: number;
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  generateThumbnail?: boolean;
  thumbnailWidth?: number;
}

export interface OptimizedImageResult {
  webpPath: string;
  avifPath?: string;
  jpegPath: string;
  thumbnailPath?: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
}

/**
 * Optimizes an image by converting it to WebP, AVIF, and optimized JPEG
 * @param inputPath - Path to the original image
 * @param outputDir - Directory to save optimized images
 * @param options - Optimization options
 * @returns Paths to all generated image formats and compression stats
 */
export async function optimizeImage(
  inputPath: string,
  outputDir: string,
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImageResult> {
  const {
    quality = 85,
    width,
    height,
    fit = 'inside',
    generateThumbnail = true,
    thumbnailWidth = 300,
  } = options;

  try {
    // Get original file stats
    const stats = await fs.stat(inputPath);
    const originalSize = stats.size;

    // Parse filename
    const ext = path.extname(inputPath);
    const basename = path.basename(inputPath, ext);
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Load and process image with sharp
    let pipeline = sharp(inputPath);

    // Resize if dimensions provided
    if (width || height) {
      pipeline = pipeline.resize(width, height, { fit });
    }

    // Generate WebP (primary format - best compression)
    const webpPath = path.join(outputDir, `${basename}.webp`);
    await pipeline
      .clone()
      .webp({ quality, effort: 6 })
      .toFile(webpPath);

    // Generate AVIF (next-gen format - even better compression)
    const avifPath = path.join(outputDir, `${basename}.avif`);
    try {
      await pipeline
        .clone()
        .avif({ quality, effort: 6 })
        .toFile(avifPath);
    } catch (error) {
      console.warn('[ImageOptimizer] AVIF generation failed (libavif may not be available):', error);
    }

    // Generate optimized JPEG (fallback for older browsers)
    const jpegPath = path.join(outputDir, `${basename}.jpg`);
    await pipeline
      .clone()
      .jpeg({ quality, mozjpeg: true })
      .toFile(jpegPath);

    // Generate thumbnail if requested
    let thumbnailPath: string | undefined;
    if (generateThumbnail) {
      thumbnailPath = path.join(outputDir, `${basename}_thumb.webp`);
      await sharp(inputPath)
        .resize(thumbnailWidth, null, { fit: 'inside' })
        .webp({ quality: 80 })
        .toFile(thumbnailPath);
    }

    // Calculate compression stats
    const webpStats = await fs.stat(webpPath);
    const optimizedSize = webpStats.size;
    const compressionRatio = ((originalSize - optimizedSize) / originalSize) * 100;

    console.log(`[ImageOptimizer] Optimized ${basename}: ${originalSize} bytes → ${optimizedSize} bytes (${compressionRatio.toFixed(1)}% reduction)`);

    return {
      webpPath,
      avifPath: await fileExists(avifPath) ? avifPath : undefined,
      jpegPath,
      thumbnailPath,
      originalSize,
      optimizedSize,
      compressionRatio,
    };
  } catch (error) {
    console.error('[ImageOptimizer] Error optimizing image:', error);
    throw new Error(`Image optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Batch optimize multiple images
 */
export async function optimizeImages(
  inputPaths: string[],
  outputDir: string,
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImageResult[]> {
  const results: OptimizedImageResult[] = [];

  for (const inputPath of inputPaths) {
    try {
      const result = await optimizeImage(inputPath, outputDir, options);
      results.push(result);
    } catch (error) {
      console.error(`[ImageOptimizer] Failed to optimize ${inputPath}:`, error);
    }
  }

  return results;
}

/**
 * Convert existing JPEG/PNG to WebP/AVIF without resizing
 */
export async function convertToModernFormats(
  inputPath: string,
  outputDir?: string
): Promise<{ webpPath: string; avifPath?: string }> {
  const dir = outputDir || path.dirname(inputPath);
  const basename = path.basename(inputPath, path.extname(inputPath));

  await fs.mkdir(dir, { recursive: true });

  const webpPath = path.join(dir, `${basename}.webp`);
  await sharp(inputPath).webp({ quality: 85, effort: 6 }).toFile(webpPath);

  let avifPath: string | undefined;
  try {
    avifPath = path.join(dir, `${basename}.avif`);
    await sharp(inputPath).avif({ quality: 85, effort: 6 }).toFile(avifPath);
  } catch (error) {
    console.warn('[ImageOptimizer] AVIF conversion skipped:', error);
  }

  return {
    webpPath,
    avifPath: avifPath && await fileExists(avifPath) ? avifPath : undefined,
  };
}

/**
 * Helper to check if file exists
 */
async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}
