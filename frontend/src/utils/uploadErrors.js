import { UPLOAD_MAX_MB } from './imageUpload';
import { getErrorMessage } from './apiErrors';

export const IMAGE_RESIZED_TOAST = 'Photo was resized automatically for faster upload.';

/**
 * User-facing message when client-side image prep fails (before upload).
 */
export function getImagePrepErrorMessage(err) {
    const msg = String(err?.message || '');
    if (msg === 'COMPRESS_STILL_TOO_LARGE' || /still too large after compression/i.test(msg)) {
        return `This photo is still over ${UPLOAD_MAX_MB}MB after resizing. Try a closer shot or another photo.`;
    }
    if (/Could not read this image/i.test(msg)) {
        return 'Could not read this photo. Save as JPG in your gallery, or use Manual Description.';
    }
    if (/compression failed|not supported/i.test(msg)) {
        return 'Could not prepare this photo for upload. Try JPG/PNG or use Manual Description.';
    }
    return msg || 'Could not prepare image for upload.';
}

/**
 * User-facing message for failed image uploads (413, FILE_TOO_LARGE, network, etc.).
 */
export function getImageUploadErrorMessage(err, fallback = 'Image upload failed. Please try again.') {
    if (!err) return fallback;

    const status = err?.response?.status;
    const payload = err?.response?.data || {};
    const code = String(payload.code || '').toUpperCase();
    const backendMsg = payload.error || payload.detail;

    if (code === 'FILE_TOO_LARGE' || status === 413) {
        return (
            backendMsg ||
            `Photo exceeds the ${UPLOAD_MAX_MB}MB limit. The app resizes large photos automatically—if you still see this, try another image.`
        );
    }
    if (code === 'UNSUPPORTED_FORMAT') {
        return backendMsg || 'Unsupported image format. Use JPG, PNG, WEBP, or HEIC.';
    }
    if (!err.response) {
        const msg = String(err?.message || '');
        if (err?.code === 'ECONNABORTED' || /timeout/i.test(msg)) {
            return 'Upload timed out. A resized photo usually uploads faster—try again.';
        }
        if (err?.code === 'ERR_NETWORK') {
            return 'Network error while uploading. Check your connection and try again.';
        }
    }

    return getErrorMessage(err, fallback);
}
