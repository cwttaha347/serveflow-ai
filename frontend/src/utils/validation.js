// Input validation utilities

export const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    // Remove HTML tags and script tags
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .trim();
};

export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const validateName = (name) => {
    if (!name || name.trim().length < 2) return false;
    if (name.length > 100) return false;
    // Only allow letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    return nameRegex.test(name);
};

export const validateTextField = (text, minLength = 2, maxLength = 200) => {
    if (!text || text.trim().length < minLength) return false;
    if (text.length > maxLength) return false;
    return true;
};

export const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};
