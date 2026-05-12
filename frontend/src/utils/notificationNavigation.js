/**
 * Returns a dashboard path for a notification, or null if none applies.
 * @param {{ type: string; payload?: Record<string, unknown>; userRole?: string }}} params
 * @returns {string | null}
 */
export function getNotificationTarget({ type, payload = {}, userRole }) {
    const p = payload && typeof payload === 'object' ? payload : {};
    const jobId = p.job_id != null ? Number(p.job_id) : null;
    const requestId = p.request_id != null ? Number(p.request_id) : null;
    const role = (userRole || '').toLowerCase();

    switch (type) {
        case 'chat_message':
            if (jobId) {
                if (role === 'provider') return `/dashboard/provider/jobs/${jobId}`;
                if (requestId) return `/dashboard/requests/${requestId}`;
                return `/dashboard/tracking/${jobId}`;
            }
            return null;
        case 'new_job':
            if (jobId && role === 'provider') return `/dashboard/provider/jobs/${jobId}`;
            return null;
        case 'job_update':
            if (jobId) {
                if (role === 'provider') return `/dashboard/provider/jobs/${jobId}`;
                if (requestId) return `/dashboard/requests/${requestId}`;
                if (role === 'user' || !role) return `/dashboard/tracking/${jobId}`;
            }
            return null;
        case 'request_update':
            if (requestId) return `/dashboard/requests/${requestId}`;
            return null;
        default:
            return null;
    }
}
