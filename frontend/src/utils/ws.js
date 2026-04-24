const trimSlashes = (s = '') => String(s).replace(/^\/+|\/+$/g, '');

export const buildWsBase = (path = '/ws/notifications/') => {
    const normalizedPath = `/${trimSlashes(path)}/`;

    // In production (Hugging Face or similar), we prefer serving everything on the same origin
    // This ensures monolithic deployments work correctly regardless of env variables.
    if (process.env.NODE_ENV === 'production') {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = window.location.host;
        return `${protocol}://${host}${normalizedPath.replace(/\/$/, '')}`;
    }

    const explicitWs = (import.meta.env.VITE_WS_URL || '').trim();
    const explicitApi = (import.meta.env.VITE_API_URL || '').trim();

    if (explicitWs) {
        try {
            const url = new URL(explicitWs);
            // If caller set full ws path, keep it. Otherwise attach requested path.
            if (!url.pathname || url.pathname === '/' || url.pathname === '') {
                url.pathname = normalizedPath;
            }
            return url.toString().replace(/\/$/, '');
        } catch {
            // Fall through to derived host strategy.
        }
    }

    if (explicitApi) {
        try {
            const apiUrl = new URL(explicitApi);
            const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
            return `${wsProtocol}//${apiUrl.host}${normalizedPath.replace(/\/$/, '')}`;
        } catch {
            // Fall through to browser hostname strategy.
        }
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host; // This already includes the port (blank in production, :8000 in dev)
    
    // For local dev where backend is on 8000 but frontend on 5173
    return `${protocol}://${window.location.hostname}:8000${normalizedPath.replace(/\/$/, '')}`;

};

export const buildWsUrl = (path, token) => {
    const base = buildWsBase(path);
    const safeToken = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${base}${safeToken}`;
};
