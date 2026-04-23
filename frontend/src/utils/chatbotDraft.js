const STORAGE_KEY = 'serveflow_chatbot_draft_v1';
const RESUME_FLAG_KEY = 'serveflow_chatbot_resume_after_auth';
const TTL_MS = 15 * 60 * 1000;

export const chatbotDraftConfig = {
    STORAGE_KEY,
    RESUME_FLAG_KEY,
    TTL_MS,
};

export const createDraftEnvelope = (draft) => {
    const now = Date.now();
    return {
        version: 1,
        created_at_ms: now,
        expires_at_ms: now + TTL_MS,
        ...draft,
    };
};

export const saveDraft = (draft) => {
    const payload = createDraftEnvelope(draft);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return payload;
};

export const getDraft = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
        const payload = JSON.parse(raw);
        if (!payload?.expires_at_ms || Date.now() > payload.expires_at_ms) {
            clearDraft();
            return null;
        }
        return payload;
    } catch {
        clearDraft();
        return null;
    }
};

export const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(RESUME_FLAG_KEY);
};

export const markResumeAfterAuth = () => {
    localStorage.setItem(RESUME_FLAG_KEY, '1');
};

export const shouldResumeAfterAuth = () => localStorage.getItem(RESUME_FLAG_KEY) === '1';
