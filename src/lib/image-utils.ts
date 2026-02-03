import https from "https";
import http from "http";

interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Get image dimensions from a URL by reading only the headers/minimal data
 * Works with JPEG, PNG, GIF, and WebP formats
 */
export async function getImageDimensions(
  url: string
): Promise<ImageDimensions | null> {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === "https:" ? https : http;

      const request = client.get(url, { timeout: 10000 }, (response) => {
        // Handle redirects
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          request.destroy();
          getImageDimensions(response.headers.location).then(resolve);
          return;
        }

        if (response.statusCode !== 200) {
          request.destroy();
          resolve(null);
          return;
        }

        const chunks: Buffer[] = [];
        let totalLength = 0;
        const maxBytes = 65536; // Read up to 64KB for dimension detection

        response.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          totalLength += chunk.length;

          // Check if we have enough data to determine dimensions
          const buffer = Buffer.concat(chunks);
          const dimensions = parseImageDimensions(buffer);

          if (dimensions) {
            request.destroy();
            resolve(dimensions);
            return;
          }

          // Stop if we've read too much without finding dimensions
          if (totalLength >= maxBytes) {
            request.destroy();
            resolve(null);
          }
        });

        response.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const dimensions = parseImageDimensions(buffer);
          resolve(dimensions);
        });

        response.on("error", () => {
          resolve(null);
        });
      });

      request.on("error", () => {
        resolve(null);
      });

      request.on("timeout", () => {
        request.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Parse image dimensions from buffer data
 * Supports PNG, JPEG, GIF, and WebP
 */
function parseImageDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24) return null;

  // PNG: starts with 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    if (buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }
  }

  // GIF: starts with GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46
  ) {
    if (buffer.length >= 10) {
      const width = buffer.readUInt16LE(6);
      const height = buffer.readUInt16LE(8);
      return { width, height };
    }
  }

  // JPEG: starts with FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return parseJpegDimensions(buffer);
  }

  // WebP: starts with RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return parseWebPDimensions(buffer);
  }

  return null;
}

/**
 * Parse JPEG dimensions by scanning for SOF markers
 */
function parseJpegDimensions(buffer: Buffer): ImageDimensions | null {
  let offset = 2; // Skip SOI marker

  while (offset < buffer.length - 9) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];

    // SOF markers (Start of Frame) contain image dimensions
    // SOF0 = 0xC0, SOF1 = 0xC1, SOF2 = 0xC2
    if (marker >= 0xc0 && marker <= 0xc3) {
      if (offset + 9 <= buffer.length) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
    }

    // Skip to next marker
    if (marker >= 0xd0 && marker <= 0xd9) {
      // Markers without length
      offset += 2;
    } else if (offset + 4 <= buffer.length) {
      const length = buffer.readUInt16BE(offset + 2);
      offset += 2 + length;
    } else {
      break;
    }
  }

  return null;
}

/**
 * Parse WebP dimensions
 */
function parseWebPDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 30) return null;

  // Check for VP8 (lossy)
  if (
    buffer[12] === 0x56 &&
    buffer[13] === 0x50 &&
    buffer[14] === 0x38 &&
    buffer[15] === 0x20
  ) {
    if (buffer.length >= 30) {
      // VP8 bitstream starts at offset 20
      const width = (buffer.readUInt16LE(26) & 0x3fff);
      const height = (buffer.readUInt16LE(28) & 0x3fff);
      return { width, height };
    }
  }

  // Check for VP8L (lossless)
  if (
    buffer[12] === 0x56 &&
    buffer[13] === 0x50 &&
    buffer[14] === 0x38 &&
    buffer[15] === 0x4c
  ) {
    if (buffer.length >= 25) {
      // VP8L has packed width/height starting at offset 21
      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width, height };
    }
  }

  // Check for VP8X (extended)
  if (
    buffer[12] === 0x56 &&
    buffer[13] === 0x50 &&
    buffer[14] === 0x38 &&
    buffer[15] === 0x58
  ) {
    if (buffer.length >= 30) {
      const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
      const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
      return { width, height };
    }
  }

  return null;
}

/**
 * Check if an image has an acceptable aspect ratio for wide card layouts
 * @param width Image width
 * @param height Image height
 * @param minRatio Minimum acceptable width/height ratio (default 0.75 to allow 4:3 portrait images)
 * @returns true if aspect ratio is acceptable
 */
export function isAcceptableAspectRatio(
  width: number,
  height: number,
  minRatio = 0.75
): boolean {
  if (width <= 0 || height <= 0) return false;
  const ratio = width / height;
  // Accept images that are reasonably wide (ratio >= minRatio)
  // Also reject extremely wide images (ratio > 4) as they look bad too
  return ratio >= minRatio && ratio <= 4;
}

/**
 * Check if an image URL has an acceptable aspect ratio
 * Returns true if the image is acceptable, false if it needs replacement, null if check failed
 */
export async function checkImageRatio(
  url: string,
  minRatio = 0.75
): Promise<boolean | null> {
  const dimensions = await getImageDimensions(url);
  if (!dimensions) return null;
  return isAcceptableAspectRatio(dimensions.width, dimensions.height, minRatio);
}
