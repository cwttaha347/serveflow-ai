/** Deduplicate categories by id (fallback: normalized name). */
export function dedupeCategories(list) {
    const seen = new Set();
    return (list || []).filter((c) => {
        const key = c?.id != null ? `id:${c.id}` : `name:${String(c?.name || '').trim().toLowerCase()}`;
        if (!key || key === 'name:' || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/** Deduplicate chatbot quick-option chips by action + value/label. */
export function dedupeOptions(options) {
    const seen = new Set();
    return (options || []).filter((o) => {
        const key = `${o?.action || ''}:${String(o?.value ?? o?.label ?? '').trim().toLowerCase()}`;
        if (!key || key === ':' || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Merge AI quick_options with category chips without duplicating choose_category rows.
 * Puts suggested category first when provided.
 * When skipCategoryGrid is true and a category is already suggested, omit the full category grid.
 */
export function mergeCategoryQuickOptions(defaultOptions, categoryOptions, suggestedCategoryId, { skipCategoryGrid = false } = {}) {
    const hasCategoryChips = (defaultOptions || []).some((o) => o?.action === 'choose_category');
    let merged;
    if (skipCategoryGrid && suggestedCategoryId) {
        merged = (defaultOptions || []).filter((o) => o?.action !== 'choose_category');
        const suggestedChip = (defaultOptions || []).find(
            (o) => o?.action === 'choose_category' && String(o.value) === String(suggestedCategoryId)
        );
        if (suggestedChip) {
            merged = [{ ...suggestedChip, label: `Suggested: ${String(suggestedChip.label || '').replace(/^Suggested:\s*/i, '')}`, suggested: true }, ...merged];
        }
    } else {
        merged = hasCategoryChips
            ? [...(defaultOptions || [])]
            : [...(defaultOptions || []), ...(categoryOptions || [])];
    }

    if (suggestedCategoryId && !skipCategoryGrid) {
        merged = merged.map((o) => {
            if (o?.action !== 'choose_category') return o;
            if (String(o.value) === String(suggestedCategoryId)) {
                const base = String(o.label || '').replace(/^Suggested:\s*/i, '');
                return { ...o, label: `Suggested: ${base}`, suggested: true };
            }
            return o;
        });
        const suggested = merged.filter(
            (o) => o?.action === 'choose_category' && String(o.value) === String(suggestedCategoryId)
        );
        const rest = merged.filter(
            (o) => !(o?.action === 'choose_category' && String(o.value) === String(suggestedCategoryId))
        );
        merged = [...suggested, ...rest];
    }

    return dedupeOptions(merged);
}
