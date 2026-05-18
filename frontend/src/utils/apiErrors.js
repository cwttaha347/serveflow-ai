const DJANGO_HTML_ERROR =
    /<!doctype html>[\s\S]*<title>\s*Bad Request\s*\(\s*400\s*\)\s*<\/title>/i;

/**
 * Extract a user-facing message from an axios / API error.
 */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
    if (!err) return fallback;

    const status = err.response?.status;
    const data = err.response?.data;

    if (status === 502 || status === 503) {
        return 'Server is starting, please wait a moment and try again.';
    }

    if (typeof data === 'string' && DJANGO_HTML_ERROR.test(data)) {
        if (status === 400) {
            return 'The server rejected this request (host/configuration). Restart the backend, use http://localhost:5173, or check ALLOWED_HOSTS in backend/.env.';
        }
        return 'The server returned an unexpected HTML error page instead of JSON.';
    }

    if (typeof data === 'string' && data.trim()) {
        const trimmed = data.trim();
        if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
            if (status === 400) {
                return 'Bad request — check that the backend is running and ALLOWED_HOSTS includes your URL.';
            }
            if (/502|503|Bad Gateway|Service Temporarily Unavailable/i.test(trimmed)) {
                return 'Server is starting, please wait a moment and try again.';
            }
            return 'Server returned an HTML error page instead of JSON.';
        }
        return trimmed;
    }
    if (data?.detail) {
        return String(data.detail);
    }
    if (data?.error) {
        return String(data.error);
    }
    if (data?.message) {
        return String(data.message);
    }
    if (data && typeof data === 'object') {
        const parts = [];
        for (const [key, value] of Object.entries(data)) {
            if (value == null) continue;
            const text = Array.isArray(value) ? value.join(', ') : String(value);
            if (text) parts.push(key === 'non_field_errors' ? text : `${key}: ${text}`);
        }
        if (parts.length) return parts.join(' · ');
    }
    if (err.message === 'Network Error') {
        return 'Network error. Check your connection and try again.';
    }
    if (err.code === 'ECONNABORTED') {
        return 'Request timed out. Please try again.';
    }
    if (err.message) {
        return err.message;
    }
    return fallback;
}
