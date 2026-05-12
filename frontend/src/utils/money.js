export const toNumber = (value) => {
    if (value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

export const currencySymbol = (settingsOrSymbol) => {
    if (typeof settingsOrSymbol === 'string') {
        const symbol = settingsOrSymbol.trim();
        return symbol || '$';
    }
    if (settingsOrSymbol && typeof settingsOrSymbol === 'object') {
        const symbol = String(settingsOrSymbol.currency_symbol || '').trim();
        return symbol || '$';
    }
    return '$';
};

export const formatMoney = (amount, settingsOrSymbol = '$') => {
    const n = toNumber(amount);
    const symbol = currencySymbol(settingsOrSymbol);
    if (n === null) return `${symbol}0.00`;
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${sign}${symbol}${formatted}`;
};

