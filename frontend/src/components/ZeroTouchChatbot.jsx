import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../api';
import { clearDraft, getDraft, markResumeAfterAuth, saveDraft, shouldResumeAfterAuth } from '../utils/chatbotDraft';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../utils/money';
import { dedupeCategories, dedupeOptions, mergeCategoryQuickOptions } from '../utils/categoryOptions';
import { cacheCategories, loadCachedCategories } from '../utils/categoriesCache';

const SEND_DEBOUNCE_MS = 450;

const ZeroTouchChatbot = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { settings } = useSettings();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [published, setPublished] = useState(false);
    const [categories, setCategories] = useState([]);
    const [chatMessage, setChatMessage] = useState('');
    const messageCounter = useRef(1);
    const [messages, setMessages] = useState([
        {
            id: 'm-0',
            role: 'assistant',
            text: 'Describe your issue. I will guide you in chat and handle request setup automatically.',
            options: [],
            consumed: false,
        },
    ]);
    const [form, setForm] = useState({
        title: '',
        description: '',
        rewritten_description: '',
        category_id: '',
        preferred_date: '',
        mode: '',
        urgency: 'medium',
        selected_provider: null,
        custom_budget: '',
    });
    const [snapshot, setSnapshot] = useState(null);
    const [error, setError] = useState('');
    const [recoveryHint, setRecoveryHint] = useState(false);
    const formRef = useRef(form);
    const sendDebounceRef = useRef(null);
    const intentInFlightRef = useRef(false);
    const budgetPromptShownRef = useRef(false);

    const token = localStorage.getItem('token');
    const currencySymbol = settings?.currency_symbol || '$';
    const isAuthPage = useMemo(
        () => ['/login', '/register', '/forgot-password', '/reset-password', '/verify-otp'].includes(location.pathname),
        [location.pathname]
    );
    const addAssistantMessage = useCallback((text, options = []) => {
        const id = `m-${messageCounter.current++}`;
        setMessages((prev) => [...prev, { id, role: 'assistant', text, options, consumed: false }]);
    }, []);

    const toDateTimeLocalValue = useCallback((value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return '';
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        const hours = String(parsed.getHours()).padStart(2, '0');
        const minutes = String(parsed.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }, []);

    useEffect(() => {
        const cached = loadCachedCategories();
        if (cached?.length) {
            setCategories(dedupeCategories(cached.filter((c) => c.is_active)));
        }
        api.get('categories/')
            .then((res) => {
                const list = dedupeCategories((res.data || []).filter((c) => c.is_active));
                setCategories(list);
                cacheCategories(list);
            })
            .catch(() => {
                if (!cached?.length) setCategories([]);
            });
    }, []);

    useEffect(() => {
        formRef.current = form;
    }, [form]);

    useEffect(() => {
        const draft = getDraft();
        if (!draft) return;
        if (shouldResumeAfterAuth() && token) {
            setOpen(true);
            setSnapshot(draft.snapshot_data || null);
            setForm((prev) => ({
                ...prev,
                title: draft.title || '',
                description: draft.description || '',
                rewritten_description: draft.rewritten_description || '',
                category_id: draft.category_id || '',
                preferred_date: draft.preferred_date || '',
                mode: draft.mode_preference || '',
                custom_budget: draft.custom_budget || '',
            }));
            addAssistantMessage('Welcome back. Your draft is restored. Final confirm is ready in chat.', [
                { label: 'Publish now', value: 'publish', action: 'publish' },
            ]);
            api.post('chatbot/event/', {
                event_name: 'chat_resume_success',
                stage: 'post_auth_resume',
                context: { draft_id: draft.draft_id },
            }).catch(() => {});
        }
    }, [token, addAssistantMessage]);

    const streamAssistantMessage = useCallback(
        (text, options = []) =>
            new Promise((resolve) => {
                const id = `m-${messageCounter.current++}`;
                let index = 0;
                setMessages((prev) => [...prev, { id, role: 'assistant', text: '', options: [], consumed: false }]);
                const timer = window.setInterval(() => {
                    index += 3;
                    const chunk = text.slice(0, index);
                    setMessages((prev) =>
                        prev.map((m) => (m.id === id ? { ...m, text: chunk, options: chunk.length >= text.length ? options : [] } : m))
                    );
                    if (index >= text.length) {
                        window.clearInterval(timer);
                        resolve(id);
                    }
                }, 22);
            }),
        []
    );

    const resolveCategoryId = useCallback(
        (suggestedCategory) => {
            const lower = String(suggestedCategory || '').toLowerCase().trim();
            if (!lower) return '';
            const matched = categories.find((c) => {
                const name = String(c.name || '').toLowerCase();
                return name === lower || name.includes(lower) || lower.includes(name);
            });
            return matched ? String(matched.id) : '';
        },
        [categories]
    );

    const buildCategoryOptions = useCallback(
        () =>
            (categories || []).slice(0, 6).map((cat) => ({
                label: cat.name,
                value: String(cat.id),
                action: 'choose_category',
            })),
        [categories]
    );

    const buildFallbackIntent = useCallback(
        (message, prevForm) => {
            const next = { ...prevForm };
            if (!next.description) next.description = message;
            if (!next.title) next.title = message.split(' ').slice(0, 6).join(' ');
            if (!next.mode) next.mode = 'auto';

            const options = [];
            if (!next.category_id) {
                options.push(...mergeCategoryQuickOptions([], buildCategoryOptions(), '', { skipCategoryGrid: false }));
            }
            const canPrepareDraft = !!(next.title && next.description && next.category_id);
            if (canPrepareDraft) {
                options.push({ label: 'Prepare draft now', value: 'prepare_draft', action: 'prepare_draft' });
            }
            if (next.mode) {
                options.push({ label: 'Use auto mode', value: 'auto', action: 'set_mode' });
                options.push({ label: 'Use manual mode', value: 'manual', action: 'set_mode' });
            }
            const reply = canPrepareDraft
                ? 'Understood. I captured your issue and I am ready to prepare your draft.'
                : 'Understood. I captured your issue. Select category in chat and I will prepare your draft next.';
            return { nextForm: next, reply, options };
        },
        [buildCategoryOptions]
    );

    const promptBudgetOnce = useCallback(() => {
        if (budgetPromptShownRef.current) return;
        budgetPromptShownRef.current = true;
        addAssistantMessage(
            `Optional: set your max budget (${currencySymbol}) in the panel below, or leave blank to use the AI estimate.`
        );
    }, [addAssistantMessage, currencySymbol]);

    const publishReadyOptions = useCallback(
        () => [
            { label: 'Auto mode', value: 'auto', action: 'set_mode' },
            { label: 'Manual mode', value: 'manual', action: 'set_mode' },
            { label: 'Broadcast mode', value: 'broadcast', action: 'set_mode' },
            { label: token ? 'Confirm & publish' : 'Login to publish', value: 'publish', action: 'publish' },
        ],
        [token]
    );

    const runIntent = async (messageOverride) => {
        const outboundMessage = (messageOverride ?? chatMessage).trim();
        if (!outboundMessage || intentInFlightRef.current) return;
        intentInFlightRef.current = true;
        const userMessageId = `m-${messageCounter.current++}`;
        setMessages((prev) => [...prev, { id: userMessageId, role: 'user', text: outboundMessage }]);
        setChatMessage('');
        const normalizedInput = outboundMessage.toLowerCase();
        const publishAliases = ['publish', 'confirm', 'final confirm', 'submit', 'post'];
        const manualAliases = ['manual', 'manual mode'];
        const autoAliases = ['auto', 'auto mode'];
        const broadcastAliases = ['broadcast', 'broadcast mode'];
        if (manualAliases.includes(normalizedInput)) {
            setForm((prev) => ({ ...prev, mode: 'manual' }));
            const draft = getDraft();
            if (draft) saveDraft({ ...draft, mode_preference: 'manual' });
            if (snapshot?.providers?.length) {
                addAssistantMessage('Pick your provider manually.', (snapshot.providers || []).slice(0, 6).map((p) => ({
                    label: `${p.provider_name} (${p.rating})`,
                    value: String(p.provider_id),
                    action: 'pick_provider',
                })));
            } else {
                addAssistantMessage('Mode set to manual.');
            }
            intentInFlightRef.current = false;
            return;
        }
        if (autoAliases.includes(normalizedInput)) {
            setForm((prev) => ({ ...prev, mode: 'auto' }));
            const draft = getDraft();
            if (draft) saveDraft({ ...draft, mode_preference: 'auto' });
            addAssistantMessage('Mode set to auto.');
            intentInFlightRef.current = false;
            return;
        }
        if (broadcastAliases.includes(normalizedInput)) {
            setForm((prev) => ({ ...prev, mode: 'broadcast' }));
            const draft = getDraft();
            if (draft) saveDraft({ ...draft, mode_preference: 'broadcast' });
            addAssistantMessage('Mode set to broadcast.');
            intentInFlightRef.current = false;
            return;
        }
        if (publishAliases.includes(normalizedInput)) {
            if (!snapshot) {
                const prepared = await generateSnapshot();
                if (!prepared) {
                    intentInFlightRef.current = false;
                    return;
                }
            }
            await publish();
            intentInFlightRef.current = false;
            return;
        }
        setBusy(true);
        setError('');
        setRecoveryHint(false);
        try {
            const res = await api.post('chatbot/intent/', {
                    message: outboundMessage,
                    context: {
                        form: {
                            ...form,
                            custom_budget: form.custom_budget || null,
                        },
                        available_categories: categories.map((c) => ({ id: c.id, name: c.name })),
                        conversation_history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
                    },
            }, { timeout: 28000 });
            const data = res.data;
            const mappedCategory = resolveCategoryId(data.suggested_category);
            const suggestedCategoryName = mappedCategory
                ? categories.find((c) => String(c.id) === String(mappedCategory))?.name
                : '';
            const nextForm = {
                ...form,
                // AI wins: use suggested title/description as the canonical request fields.
                title: data.suggested_title || form.title || '',
                description: data.suggested_description || data.summary || form.description || outboundMessage,
                rewritten_description: data.suggested_description || data.summary || outboundMessage,
                mode: data.preferred_mode || form.mode,
                urgency: data.urgency || form.urgency,
                category_id: mappedCategory || form.category_id || '',
            };
            const suggestedDate = toDateTimeLocalValue(data.preferred_date_iso);
            if (suggestedDate) {
                nextForm.preferred_date = suggestedDate;
            }
            const suggestedProvider = Number(data.suggested_provider_id) || null;
            if (suggestedProvider) {
                nextForm.selected_provider = suggestedProvider;
            }
            const suggestedBudget = data.suggested_budget;
            if (suggestedBudget != null && Number(suggestedBudget) > 0) {
                nextForm.custom_budget = String(suggestedBudget);
            }
            // Best-effort title if still missing.
            if (!String(nextForm.title || '').trim() && String(nextForm.description || '').trim()) {
                nextForm.title = String(nextForm.description).split(' ').slice(0, 6).join(' ');
            }
            setForm(nextForm);
            if (suggestedDate) {
                addAssistantMessage('I inferred a preferred date/time from your message and prefilled it. Please confirm or edit before publish.');
            }
            const defaultOptions = Array.isArray(data.quick_options) ? data.quick_options : [];
            const options = dedupeOptions(
                mergeCategoryQuickOptions(defaultOptions, buildCategoryOptions(), mappedCategory, {
                    skipCategoryGrid: Boolean(mappedCategory),
                })
            );
            let assistantReply = data.assistant_reply || 'I understood your request and prepared next steps.';
            if (mappedCategory && suggestedCategoryName) {
                assistantReply = `Category: ${suggestedCategoryName}. Review budget (optional), then confirm to publish.`;
            }
            const canPrepareDraft = !!(
                String(nextForm.description || '').trim() &&
                String(nextForm.title || '').trim() &&
                String(nextForm.category_id || '').trim()
            );
            if (canPrepareDraft && !options.some((o) => o?.action === 'prepare_draft')) {
                options.push({ label: 'Prepare draft now', value: 'prepare_draft', action: 'prepare_draft' });
            }
            // Seamless automation: if we already have enough to build the draft, do it immediately
            // and show only one consolidated message (skip the generic AI reply).
            if (canPrepareDraft && !snapshot) {
                const resDraft = await api.post('chatbot/draft/snapshot/', {
                    category_id: Number(nextForm.category_id),
                    title: nextForm.title,
                    description: nextForm.description,
                    preferred_date: nextForm.preferred_date || null,
                    mode_preference: nextForm.mode || null,
                });
                const draft = resDraft.data.draft;
                saveDraft({
                    ...draft,
                    rewritten_description: nextForm.rewritten_description,
                    custom_budget: nextForm.custom_budget || '',
                });
                setSnapshot(draft.snapshot_data);
                setForm((prev) => ({
                    ...prev,
                    title: draft.title,
                    description: draft.description,
                    rewritten_description: nextForm.rewritten_description,
                    category_id: String(draft.category_id),
                    mode: draft.mode_preference || prev.mode,
                }));
                promptBudgetOnce();
                await streamAssistantMessage('Draft is ready. Set mode and confirm to publish.', publishReadyOptions());
                if ((nextForm.mode || draft.mode_preference || resDraft.data?.draft?.snapshot_data?.recommended_mode) === 'manual') {
                    const topProvider = (resDraft.data?.draft?.snapshot_data?.providers || [])[0];
                    if (topProvider?.provider_id) {
                        setForm((prev) => ({ ...prev, selected_provider: Number(topProvider.provider_id) }));
                        addAssistantMessage(
                            `I preselected ${topProvider.provider_name} for manual mode. You can change provider or confirm publish.`,
                            (resDraft.data?.draft?.snapshot_data?.providers || []).slice(0, 6).map((p) => ({
                                label: `${p.provider_name} (${p.rating})`,
                                value: String(p.provider_id),
                                action: 'pick_provider',
                            }))
                        );
                    }
                }
            } else {
                // Only show the AI reply when we can't auto-draft yet
                await streamAssistantMessage(assistantReply, options);
            }
            setRecoveryHint(false);
        } catch (e) {
            const fallbackResult = buildFallbackIntent(outboundMessage, formRef.current);
            setForm(fallbackResult.nextForm);
            await streamAssistantMessage(
                fallbackResult.reply ||
                    'I could not reach AI right now, but your request details are captured and I can continue.',
                fallbackResult.options.length
                    ? fallbackResult.options
                    : dedupeOptions(mergeCategoryQuickOptions([], buildCategoryOptions(), '', { skipCategoryGrid: false }))
            );
            setRecoveryHint(true);
            const statusCode = e?.response?.status;
            if (statusCode >= 500) {
                setError('AI service is temporarily unavailable. Continue in chat and publish once draft is ready.');
            } else if (e?.code === 'ECONNABORTED') {
                setError('AI response timed out. Your details are saved; try Send again or continue with draft options.');
            }
        } finally {
            intentInFlightRef.current = false;
            setBusy(false);
        }
    };

    const scheduleRunIntent = (messageOverride) => {
        if (sendDebounceRef.current) {
            window.clearTimeout(sendDebounceRef.current);
        }
        sendDebounceRef.current = window.setTimeout(() => {
            sendDebounceRef.current = null;
            runIntent(messageOverride);
        }, SEND_DEBOUNCE_MS);
    };

    useEffect(
        () => () => {
            if (sendDebounceRef.current) {
                window.clearTimeout(sendDebounceRef.current);
            }
        },
        []
    );

    const generateSnapshot = async () => {
        // Skip if draft already generated
        if (snapshot) {
            promptBudgetOnce();
            await streamAssistantMessage('Draft already prepared. Set mode and confirm to publish.', publishReadyOptions());
            return true;
        }
        const normalized = { ...form };
        if (!normalized.description && chatMessage.trim()) normalized.description = chatMessage.trim();
        if (!normalized.title && normalized.description) normalized.title = normalized.description.split(' ').slice(0, 5).join(' ');
        if (!normalized.title || !normalized.description || !normalized.category_id) {
            setError('I still need title, description, and category. Try Analyze Message once, then Prepare Draft.');
            return false;
        }
        setBusy(true);
        setError('');
        try {
            const res = await api.post('chatbot/draft/snapshot/', {
                category_id: Number(normalized.category_id),
                title: normalized.title,
                description: normalized.description,
                preferred_date: normalized.preferred_date || null,
                mode_preference: normalized.mode || null,
            });
            const draft = res.data.draft;
            saveDraft({
                ...draft,
                rewritten_description: normalized.rewritten_description || '',
            });
            api.post('chatbot/event/', {
                event_name: 'chat_snapshot_ready',
                stage: 'draft_generation',
                context: { draft_id: draft.draft_id, category_id: draft.category_id },
            }).catch(() => {});
            setSnapshot(draft.snapshot_data);
            setForm((prev) => ({
                ...prev,
                title: normalized.title,
                description: normalized.description,
                category_id: normalized.category_id,
                mode: draft.mode_preference || prev.mode,
            }));
            promptBudgetOnce();
            await streamAssistantMessage('Draft is ready. Set mode and confirm to publish.', publishReadyOptions());
            return true;
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to prepare draft.');
            return false;
        } finally {
            setBusy(false);
        }
    };

    const publish = async () => {
        const draft = getDraft();
        if (!draft) {
            api.post('chatbot/event/', {
                event_name: 'chat_draft_expired',
                stage: 'publish_attempt',
                reason_code: 'ttl_expired',
            }).catch(() => {});
            setError('Draft expired. Please regenerate.');
            return;
        }
        if (!token) {
            markResumeAfterAuth();
            navigate('/login');
            return;
        }
        const effectiveMode = form.mode || draft.mode_preference || snapshot?.recommended_mode || 'manual';
        if (effectiveMode === 'manual' && !form.selected_provider) {
            if (snapshot?.providers?.length) {
                addAssistantMessage('Manual mode requires selecting a provider first.', (snapshot.providers || []).slice(0, 6).map((p) => ({
                    label: `${p.provider_name} (${p.rating})`,
                    value: String(p.provider_id),
                    action: 'pick_provider',
                })));
            } else {
                addAssistantMessage('Manual mode requires selecting a provider. Choose Auto or Broadcast to publish without picking one.', [
                    { label: 'Auto mode', value: 'auto', action: 'set_mode' },
                    { label: 'Broadcast mode', value: 'broadcast', action: 'set_mode' },
                ]);
            }
            return;
        }
        setBusy(true);
        setError('');
        try {
            const floor = Number(snapshot?.analysis?.budget_floor ?? 0);
            let budgetRecommended = snapshot?.analysis?.budget_recommended ?? null;
            const custom = (form.custom_budget || '').trim();
            if (custom) {
                const n = parseFloat(custom);
                if (!Number.isFinite(n) || n <= 0) {
                    setError('Enter a valid positive budget.');
                    setBusy(false);
                    return;
                }
                if (floor > 0 && n < floor) {
                    setError(`Budget must be at least ${formatMoney(floor, settings)}.`);
                    setBusy(false);
                    return;
                }
                budgetRecommended = n;
            }
            const res = await api.post('chatbot/publish/', {
                category_id: Number(draft.category_id),
                title: draft.title,
                description: draft.description,
                rewritten_description: form.rewritten_description || draft.rewritten_description || '',
                preferred_date: draft.preferred_date || null,
                mode: effectiveMode,
                selected_provider: form.selected_provider || null,
                budget_recommended: budgetRecommended,
                severity_score: draft.severity_score || 5,
                idempotency_key: draft.idempotency_key,
                draft_expires_at: draft.expires_at,
                final_confirmed: true,
            });
            const checkoutUrl = res.data?.checkout_url || res.data?.children?.[0]?.checkout_url;
            if (checkoutUrl) {
                addAssistantMessage('Opening secure checkout. After payment, your request will go live.');
                window.location.assign(checkoutUrl);
                return;
            }
            clearDraft();
            api.post('chatbot/event/', {
                event_name: 'chat_publish_client_success',
                stage: 'final_publish',
                context: { request_id: res.data.request_id },
            }).catch(() => {});
            const requestIds = Array.isArray(res.data?.request_ids)
                ? res.data.request_ids.filter((id) => id !== null && id !== undefined)
                : [];
            const firstRequestId = res.data?.request_id || requestIds[0];
            setPublished(true);
            addAssistantMessage(
                requestIds.length > 1
                    ? `Requests published successfully (IDs: ${requestIds.join(', ')}).`
                    : `Request created and published successfully${firstRequestId ? ` (ID: ${firstRequestId})` : ''}.`
            );
        } catch (e) {
            const d = e.response?.data;
            if (d?.budget_floor != null) {
                setError(`Budget must be at least ${formatMoney(d.budget_floor, settings)}.`);
            } else {
                setError(d?.error || d?.detail || 'Failed to publish request.');
            }
        } finally {
            setBusy(false);
        }
    };

    const consumeOptions = (messageId) => {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, consumed: true, options: [] } : m)));
    };

    const handleOptionSelect = async (messageId, option) => {
        consumeOptions(messageId);
        if (option.action === 'choose_category') {
            const directId = categories.find((c) => String(c.id) === String(option.value))?.id;
            const byName = categories.find((c) => String(c.name || '').toLowerCase() === String(option.value || '').toLowerCase())?.id;
            const resolvedId = directId || byName || option.value;
            const selectedName = categories.find((c) => String(c.id) === String(resolvedId))?.name || String(option.label || 'selected category');
            const next = { ...formRef.current, category_id: String(resolvedId) };
            setForm(next);
            if (next.title && next.description) {
                await generateSnapshot();
                return;
            }
            addAssistantMessage(`Category set to ${selectedName}.`, [
                { label: 'Prepare draft now', value: 'prepare_draft', action: 'prepare_draft' },
            ]);
            return;
        }
        if (option.action === 'set_mode') {
            setForm((prev) => ({ ...prev, mode: option.value }));
            const draft = getDraft();
            if (draft) saveDraft({ ...draft, mode_preference: option.value });
            if (option.value === 'manual' && snapshot?.providers?.length) {
                addAssistantMessage('Pick your provider manually.', (snapshot.providers || []).slice(0, 6).map((p) => ({
                    label: `${p.provider_name} (${p.rating})`,
                    value: String(p.provider_id),
                    action: 'pick_provider',
                })));
            } else {
                addAssistantMessage(`Mode set to ${option.value}.`);
            }
            return;
        }
        if (option.action === 'set_urgency') {
            setForm((prev) => ({ ...prev, urgency: option.value }));
            addAssistantMessage(`Urgency set to ${option.value}.`);
            return;
        }
        if (option.action === 'set_preferred_date') {
            const normalized = toDateTimeLocalValue(option.value);
            if (normalized) {
                setForm((prev) => ({ ...prev, preferred_date: normalized }));
                addAssistantMessage('Date/time suggestion applied. You can adjust it before publish.');
            } else {
                addAssistantMessage('Could not parse the suggested date. Please enter it manually.');
            }
            return;
        }
        if (option.action === 'set_selected_provider') {
            const selected = Number(option.value) || null;
            if (selected) {
                setForm((prev) => ({ ...prev, selected_provider: selected }));
                addAssistantMessage('Provider suggestion applied. Confirm or change before publish.');
            }
            return;
        }
        if (option.action === 'pick_provider') {
            setForm((prev) => ({ ...prev, selected_provider: Number(option.value) || null }));
            const draft = getDraft();
            if (draft) saveDraft({ ...draft, selected_provider: Number(option.value) || null });
            addAssistantMessage('Provider selected. You can confirm publish now.');
            return;
        }
        if (option.action === 'prepare_draft') {
            await generateSnapshot();
            return;
        }
        if (option.action === 'publish') {
            if (!snapshot) {
                const prepared = await generateSnapshot();
                if (!prepared) {
                    return;
                }
            }
            await publish();
        }
    };

    if (isAuthPage && !open) return null;
    if (user?.role === 'provider') return null;

    return (
        <motion.div 
            drag
            dragConstraints={{ left: -window.innerWidth + 400, right: 0, top: -window.innerHeight + 600, bottom: 0 }}
            dragElastic={0.1}
            dragMomentum={false}
            className="fixed bottom-6 right-6 z-[999] cursor-grab active:cursor-grabbing"
        >
            {!open ? (
                <button
                    onClick={() => setOpen(true)}
                    className="relative h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-white shadow-[0_0_25px_rgba(99,102,241,0.7)] transition-transform hover:scale-105"
                    aria-label="Open chatbot"
                >
                    <span className="pointer-events-none absolute inset-0 rounded-full animate-ping bg-indigo-400/20" />
                    <span className="relative flex h-full w-full items-center justify-center">
                        <Bot className="h-6 w-6" />
                        <Sparkles className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 text-cyan-200" />
                    </span>
                </button>
            ) : (
                <div className="w-[360px] max-w-[90vw] rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                        <h3 className="font-black text-sm">Autonomous Request Chatbot</h3>
                        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">x</button>
                    </div>
                    <div className="p-4 space-y-3 max-h-[70vh] overflow-auto">
                        {error && <p className="text-sm text-red-300">{error}</p>}
                        {published && <p className="text-sm text-green-300">Published to provider network.</p>}

                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                                        msg.role === 'user' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-100 border border-slate-700'
                                    }`}
                                >
                                    {msg.text}
                                    {!msg.consumed && Array.isArray(msg.options) && msg.options.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-slate-600 bg-slate-900/90 p-2">
                                            {msg.options.map((opt, idx) => (
                                                <button
                                                    key={`${msg.id}-opt-${idx}`}
                                                    onClick={() => handleOptionSelect(msg.id, opt)}
                                                    className={`rounded-full border px-2 py-1 text-xs hover:bg-blue-500/30 ${
                                                        opt.suggested || String(opt.label || '').startsWith('Suggested:')
                                                            ? 'border-emerald-400/60 bg-emerald-500/25 font-semibold'
                                                            : 'border-blue-400/40 bg-blue-500/20'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {busy && (
                            <div className="flex justify-start">
                                <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-slate-800 text-slate-100 border border-slate-700 flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                                    <span>Working…</span>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            {recoveryHint && (
                                <p className="text-xs text-slate-400">
                                    Type another message or tap a category above to continue. Send stays off until you type again.
                                </p>
                            )}
                            <div className="flex items-end gap-2">
                                <textarea
                                    value={chatMessage}
                                    onChange={(e) => {
                                        setChatMessage(e.target.value);
                                        if (recoveryHint && e.target.value.trim()) setRecoveryHint(false);
                                    }}
                                    className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3 text-sm"
                                    placeholder="Describe your issue naturally..."
                                    rows={2}
                                    disabled={busy}
                                />
                                <button
                                    onClick={() => scheduleRunIntent()}
                                    disabled={busy || !chatMessage.trim()}
                                    className="rounded-xl bg-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-600 disabled:opacity-60"
                                >
                                    {busy ? '...' : 'Send'}
                                </button>
                            </div>
                        </div>

                        {snapshot && (
                            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3 space-y-2 text-sm">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">AI Cost Estimate</p>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Est. Hours:</span>
                                    <span className="text-blue-300 font-bold">{snapshot.analysis?.estimated_hours}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Budget:</span>
                                    <span className="text-blue-300 font-bold">{formatMoney(snapshot.analysis?.budget_recommended || 0, settings)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Recommended Mode:</span>
                                    <span className="text-blue-300 font-bold capitalize">{snapshot.recommended_mode}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-700 mt-1">
                                    Based on category rate card + {snapshot.analysis?.budget_floor !== snapshot.analysis?.budget_recommended ? 'historical job data' : 'base pricing formula'}
                                </p>
                                <div className="pt-2 space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">My budget (optional)</label>
                                    <motion.div layout className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">{currencySymbol}</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min={snapshot.analysis?.budget_floor != null ? Number(snapshot.analysis.budget_floor) : undefined}
                                            value={form.custom_budget}
                                            onChange={(e) => setForm((prev) => ({ ...prev, custom_budget: e.target.value }))}
                                            className="w-full rounded-lg bg-slate-900 border border-slate-600 px-2 py-1.5 text-xs pl-7"
                                            placeholder={`Suggested ${formatMoney(snapshot.analysis?.budget_recommended || 0, settings)}`}
                                        />
                                    </motion.div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default ZeroTouchChatbot;
