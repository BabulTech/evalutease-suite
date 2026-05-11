/**
 * Client-side image optimization using Canvas API
 * 
 * Optimizes images by:
 * - Resizing to target dimensions
 * - Converting to WebP format
 * - Compressing with quality parameter (0-100)
 * - Maintaining aspect ratio
 * 
 * No external dependencies required
 */

export interface OptimizationConfig {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-100, default 75
  format?: 'webp' | 'jpeg' | 'png';
}

/**
 * Optimize a File to WebP with resizing and compression
 * @returns Optimized File object ready to upload
 */
export async function optimizeImage(
  file: File,
  config: OptimizationConfig = {}
): Promise<File> {
  const { maxWidth = 400, maxHeight = 400, quality = 75, format = 'webp' } = config;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Calculate dimensions maintaining aspect ratio
        let { width, height } = img;
        const maxRatio = Math.max(width, height);
        const targetRatio = Math.max(maxWidth, maxHeight);

        if (maxRatio > targetRatio) {
          const scale = targetRatio / maxRatio;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }

            // Generate filename with format
            const timestamp = Date.now();
            const ext = format === 'webp' ? 'webp' : format === 'jpeg' ? 'jpg' : 'png';
            const optimizedName = `optimized-${timestamp}.${ext}`;

            // Create optimized File
            const optimizedFile = new File([blob], optimizedName, {
              type: `image/${format === 'jpeg' ? 'jpeg' : format}`,
              lastModified: Date.now(),
            });

            resolve(optimizedFile);
          },
          `image/${format === 'jpeg' ? 'jpeg' : format}`,
          quality / 100
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Optimize avatar: 256x256, quality 75%, WebP
 * Target size: ~20-40 KB
 */
export function optimizeAvatar(file: File): Promise<File> {
  return optimizeImage(file, {
    maxWidth: 256,
    maxHeight: 256,
    quality: 75,
    format: 'webp',
  });
}

/**
 * Optimize logo: 400x400, quality 80%, WebP
 * Target size: ~15-30 KB
 */
export function optimizeLogo(file: File): Promise<File> {
  return optimizeImage(file, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 80,
    format: 'webp',
  });
}

/**
 * Get estimated file size after optimization
 * @returns Size in KB
 */
export async function estimateOptimizedSize(
  file: File,
  config: OptimizationConfig = {}
): Promise<number> {
  try {
    const optimized = await optimizeImage(file, config);
    return Math.round(optimized.size / 1024);
  } catch (err) {
    return Math.round(file.size / 1024);
  }
}
