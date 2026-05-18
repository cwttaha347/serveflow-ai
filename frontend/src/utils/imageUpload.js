/** Shared image upload limits (aligned with nginx + Django). */
import heic2any from 'heic2any';

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const UPLOAD_MAX_MB = UPLOAD_MAX_BYTES / (1024 * 1024);
export const IMAGE_MAX_DIMENSION = 1920;
export const IMAGE_JPEG_QUALITY = 0.82;
/** Target size after client compression (mobile camera photos). */
export const IMAGE_TARGET_MAX_BYTES = 1.5 * 1024 * 1024;

const SKIP_TYPES = new Set(['image/gif', 'image/svg+xml']);
const HEIC_TYPES = new Set(['image/heic', 'image/heif']);
const HEIC_EXT = /\.(heic|heif)$/i;

function isHeicFile(file) {
    const type = String(file.type || '').toLowerCase();
    return HEIC_TYPES.has(type) || HEIC_EXT.test(file.name || '');
}

async function decodeHeicToJpeg(file) {
    const result = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.85,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    const baseName = (file.name || 'photo').replace(HEIC_EXT, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
    });
}

function loadImageElement(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Could not read this image. Try JPG or PNG, or pick from gallery.'));
        };
        img.src = url;
    });
}

function canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Image compression failed.'))),
            'image/jpeg',
            quality
        );
    });
}

function scaledDimensions(width, height, maxDim) {
    const longest = Math.max(width, height);
    if (longest <= maxDim) {
        return { width, height };
    }
    const scale = maxDim / longest;
    return {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
    };
}

async function compressToJpeg(file, options) {
    const maxDim = options.maxDimension;
    const targetBytes = options.targetMaxBytes;
    const hardMax = options.hardMaxBytes;
    const minQuality = options.minQuality ?? 0.35;

    let img = await loadImageElement(file);
    let dim = maxDim;
    let quality = options.quality ?? IMAGE_JPEG_QUALITY;
    let blob;

    for (let attempt = 0; attempt < 4; attempt += 1) {
        const { width, height } = scaledDimensions(img.naturalWidth, img.naturalHeight, dim);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Image processing is not supported in this browser.');
        }
        ctx.drawImage(img, 0, 0, width, height);

        quality = options.quality ?? IMAGE_JPEG_QUALITY;
        blob = await canvasToBlob(canvas, quality);
        while (blob.size > targetBytes && quality > minQuality) {
            quality -= 0.07;
            blob = await canvasToBlob(canvas, quality);
        }

        if (blob.size <= hardMax) {
            break;
        }
        dim = Math.round(dim * 0.82);
        if (dim < 720) {
            break;
        }
    }

    if (!blob || blob.size > hardMax) {
        throw new Error('COMPRESS_STILL_TOO_LARGE');
    }

    const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
    return {
        file: new File([blob], `${baseName}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
        }),
        compressed: true,
    };
}

/**
 * Resize and compress photos before upload. Returns the original file when already small
 * or when compression is not applicable (e.g. GIF).
 */
export async function prepareImageForUpload(file, options = {}) {
    if (!file || !(file instanceof File)) {
        throw new Error('No image selected.');
    }
    if (!file.type.startsWith('image/') && !isHeicFile(file)) {
        throw new Error('Please choose an image file.');
    }
    if (SKIP_TYPES.has(file.type)) {
        if (file.size > UPLOAD_MAX_BYTES) {
            throw new Error(`GIF/SVG must be under ${UPLOAD_MAX_MB}MB.`);
        }
        return { file, compressed: false };
    }

    let working = file;
    if (isHeicFile(file)) {
        working = await decodeHeicToJpeg(file);
    }

    const maxDim = options.maxDimension ?? IMAGE_MAX_DIMENSION;
    const targetBytes = options.targetMaxBytes ?? IMAGE_TARGET_MAX_BYTES;
    const hardMax = options.hardMaxBytes ?? UPLOAD_MAX_BYTES;

    if (
        working.size <= targetBytes &&
        working.type === 'image/jpeg' &&
        !isHeicFile(file)
    ) {
        try {
            const img = await loadImageElement(working);
            if (Math.max(img.naturalWidth, img.naturalHeight) <= maxDim) {
                return { file: working, compressed: working !== file };
            }
        } catch {
            // fall through to compression
        }
    }

    return compressToJpeg(working, {
        maxDimension: maxDim,
        targetMaxBytes: targetBytes,
        hardMaxBytes: hardMax,
        quality: options.quality,
        minQuality: options.minQuality,
    });
}

export function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
