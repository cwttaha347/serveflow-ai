/**
 * Resolve uploaded media (profile photos, category images) to a same-origin URL.
 * Media is served at /media/ (nginx → Django), not under /api/.
 */
export const resolveMediaUrl = (url, { cacheBust } = {}) => {
    if (!url) return null;
    if (url instanceof File) return null;

    const str = String(url);
    if (str.startsWith('blob:') || str.startsWith('data:')) {
        return str;
    }

    let path = null;
    let search = '';

    if (str.startsWith('http://') || str.startsWith('https://')) {
        try {
            const parsed = new URL(str);
            search = parsed.search || '';
            if (parsed.pathname.startsWith('/media/')) {
                path = parsed.pathname;
            } else {
                const match = str.match(/\/media\/[^?\s#]+/);
                if (match) {
                    path = match[0];
                    const q = str.indexOf('?');
                    if (q !== -1) {
                        const hash = str.indexOf('#', q);
                        search = hash === -1 ? str.slice(q) : str.slice(q, hash);
                    }
                } else {
                    return str;
                }
            }
        } catch {
            return str;
        }
    } else {
        const q = str.indexOf('?');
        if (q !== -1) {
            search = str.slice(q);
            path = str.slice(0, q);
        } else {
            path = str;
        }
        path = path.startsWith('/') ? path : `/${path}`;
        if (!path.startsWith('/media/')) {
            path = `/media${path.startsWith('/') ? path : `/${path}`}`;
        }
    }

    if (cacheBust && !search) {
        search = `?v=${encodeURIComponent(cacheBust)}`;
    }

    return `${window.location.origin}${path}${search}`;
};

/** @deprecated Use resolveMediaUrl — kept for existing imports */
export const resolvePhotoUrl = resolveMediaUrl;
