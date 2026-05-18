const CACHE_KEY = 'serveflow_categories_v1';
const TTL_MS = 30 * 60 * 1000;

export function loadCachedCategories() {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const payload = JSON.parse(raw);
        if (!payload?.expires_at_ms || Date.now() > payload.expires_at_ms) {
            sessionStorage.removeItem(CACHE_KEY);
            return null;
        }
        return Array.isArray(payload.data) ? payload.data : null;
    } catch {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
    }
}

export function cacheCategories(list) {
    try {
        sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ data: list, expires_at_ms: Date.now() + TTL_MS })
        );
    } catch {
        /* sessionStorage full or disabled */
    }
}
