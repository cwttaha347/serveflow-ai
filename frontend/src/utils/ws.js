const trimSlashes = (s = '') => String(s).replace(/^\/+|\/+$/g, '');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const isLocalHost = (hostname) => LOCAL_HOSTS.has(String(hostname || '').toLowerCase());

const shouldUseSameOrigin = (remoteHostname) => {
    const pageHost = window.location.hostname.toLowerCase();
    return isLocalHost(pageHost) && !isLocalHost(remoteHostname);
};

export const buildWsBase = (path = '/ws/notifications/') => {
    const normalizedPath = `/${trimSlashes(path)}/`;

    if (import.meta.env.PROD) {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        return `${protocol}://${window.location.host}${normalizedPath.replace(/\/$/, '')}`;
    }

    const explicitWs = (import.meta.env.VITE_WS_URL || '').trim();
    const explicitApi = (import.meta.env.VITE_API_URL || '').trim();

    if (explicitWs) {
        try {
            const url = new URL(explicitWs);
            if (!shouldUseSameOrigin(url.hostname)) {
                if (!url.pathname || url.pathname === '/' || url.pathname === '') {
                    url.pathname = normalizedPath;
                }
                return url.toString().replace(/\/$/, '');
            }
        } catch {
            // fall through
        }
    }

    if (explicitApi) {
        try {
            const apiUrl = new URL(explicitApi);
            if (!shouldUseSameOrigin(apiUrl.hostname)) {
                const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
                return `${wsProtocol}//${apiUrl.host}${normalizedPath.replace(/\/$/, '')}`;
            }
        } catch {
            // fall through
        }
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}${normalizedPath.replace(/\/$/, '')}`;
};

export const buildWsUrl = (path, token) => {
    const base = buildWsBase(path);
    const safeToken = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${base}${safeToken}`;
};
