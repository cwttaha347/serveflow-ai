import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../api';
import { clearDraft, getDraft, markResumeAfterAuth, saveDraft, shouldResumeAfterAuth } from '../utils/chatbotDraft';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

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
        category_id: '',
        preferred_date: '',
        mode: '',
        urgency: 'medium',
        selected_provider: null,
    });
    const [snapshot, setSnapshot] = useState(null);
    const [error, setError] = useState('');

    const token = localStorage.getItem('token');
    const isAuthPage = useMemo(
        () => ['/login', '/register', '/forgot-password', '/reset-password', '/verify-otp'].includes(location.pathname),
        [location.pathname]
    );
    const addAssistantMessage = useCallback((text, options = []) => {
        const id = `m-${messageCounter.current++}`;
        setMessages((prev) => [...prev, { id, role: 'assistant', text, options, consumed: false }]);
    }, []);

    useEffect(() => {
        api.get('categories/')
            .then((res) => setCategories((res.data || []).filter((c) => c.is_active)))
            .catch(() => setCategories([]));
    }, []);

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
                category_id: draft.category_id || '',
                preferred_date: draft.preferred_date || '',
                mode: draft.mode_preference || '',
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
                options.push(...buildCategoryOptions());
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

    const runIntent = async (messageOverride) => {
        const outboundMessage = (messageOverride ?? chatMessage).trim();
        if (!outboundMessage) return;
        const userMessageId = `m-${messageCounter.current++}`;
        setMessages((prev) => [...prev, { id: userMessageId, role: 'user', text: outboundMessage }]);
        setChatMessage('');
        setBusy(true);
        setError('');
        try {
            const res = await api.post('chatbot/intent/', {
                    message: outboundMessage,
                    context: {
                        form,
                        available_categories: categories.map((c) => ({ id: c.id, name: c.name })),
                        conversation_history: messages.slice(-8).map((m) => ({ role: m.role, text: m.text })),
                    },
            });
            const data = res.data;
            const mappedCategory = resolveCategoryId(data.suggested_category);
            const nextForm = {
                ...form,
                description: form.description || data.summary || form.description || outboundMessage,
                title: form.title || data.suggested_title || form.title,
                mode: data.preferred_mode || form.mode,
                urgency: data.urgency || form.urgency,
                category_id: form.category_id || mappedCategory || form.category_id,
            };
            // Best-effort title if still missing.
            if (!String(nextForm.title || '').trim() && String(nextForm.description || '').trim()) {
                nextForm.title = String(nextForm.description).split(' ').slice(0, 6).join(' ');
            }
            setForm(nextForm);
            const defaultOptions = Array.isArray(data.quick_options) ? data.quick_options : [];
            const requiredCategory = !mappedCategory && !String(nextForm.category_id || '').trim();
            const options = requiredCategory ? [...defaultOptions, ...buildCategoryOptions()] : defaultOptions;
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
                saveDraft(draft);
                setSnapshot(draft.snapshot_data);
                setForm((prev) => ({
                    ...prev,
                    title: draft.title,
                    description: draft.description,
                    category_id: String(draft.category_id),
                    mode: draft.mode_preference || prev.mode,
                }));
                await streamAssistantMessage('Draft is ready. Choose your assignment mode, then confirm to publish.', [
                    { label: 'Manual mode', value: 'manual', action: 'set_mode' },
                    { label: 'Auto mode', value: 'auto', action: 'set_mode' },
                    { label: 'Broadcast mode', value: 'broadcast', action: 'set_mode' },
                    { label: token ? 'Final confirm publish' : 'Login to continue', value: 'publish', action: 'publish' },
                ]);
            } else {
                // Only show the AI reply when we can't auto-draft yet
                await streamAssistantMessage(
                    data.assistant_reply || 'I understood your request and prepared next steps.',
                    options
                );
            }
        } catch {
            let fallbackResult;
            setForm((prev) => {
                fallbackResult = buildFallbackIntent(outboundMessage, prev);
                return fallbackResult.nextForm;
            });
            await streamAssistantMessage(
                fallbackResult?.reply || 'I can continue without AI. I prepared your details from this chat.',
                fallbackResult?.options || buildCategoryOptions()
            );
        } finally {
            setBusy(false);
        }
    };

    const generateSnapshot = async () => {
        // Skip if draft already generated
        if (snapshot) {
            await streamAssistantMessage('Draft already prepared. Choose assignment mode, then confirm to publish.', [
                { label: 'Manual mode', value: 'manual', action: 'set_mode' },
                { label: 'Auto mode', value: 'auto', action: 'set_mode' },
                { label: 'Broadcast mode', value: 'broadcast', action: 'set_mode' },
                { label: token ? 'Final confirm publish' : 'Login to continue', value: 'publish', action: 'publish' },
            ]);
            return;
        }
        const normalized = { ...form };
        if (!normalized.description && chatMessage.trim()) normalized.description = chatMessage.trim();
        if (!normalized.title && normalized.description) normalized.title = normalized.description.split(' ').slice(0, 5).join(' ');
        if (!normalized.title || !normalized.description || !normalized.category_id) {
            setError('I still need title, description, and category. Try Analyze Message once, then Prepare Draft.');
            return;
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
            saveDraft(draft);
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
            await streamAssistantMessage('Draft is ready. Choose assignment mode, then final confirm.', [
                { label: 'Manual mode', value: 'manual', action: 'set_mode' },
                { label: 'Auto mode', value: 'auto', action: 'set_mode' },
                { label: 'Broadcast mode', value: 'broadcast', action: 'set_mode' },
                { label: token ? 'Final confirm publish' : 'Login to continue', value: 'publish', action: 'publish' },
            ]);
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to prepare draft.');
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
        setBusy(true);
        setError('');
        try {
            const res = await api.post('chatbot/publish/', {
                category_id: Number(draft.category_id),
                title: draft.title,
                description: draft.description,
                preferred_date: draft.preferred_date || null,
                mode: form.mode || draft.mode_preference || snapshot?.recommended_mode || 'manual',
                selected_provider: form.selected_provider || null,
                budget_recommended: snapshot?.analysis?.budget_recommended || null,
                severity_score: draft.severity_score || 5,
                idempotency_key: draft.idempotency_key,
                draft_expires_at: draft.expires_at,
                final_confirmed: true,
            });
            clearDraft();
            api.post('chatbot/event/', {
                event_name: 'chat_publish_client_success',
                stage: 'final_publish',
                context: { request_id: res.data.request_id },
            }).catch(() => {});
            setPublished(true);
            addAssistantMessage(`Request created and published successfully (ID: ${res.data.request_id}).`);
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to publish request.');
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
            setForm((prev) => ({ ...prev, category_id: String(resolvedId) }));
            addAssistantMessage(`Category set to ${selectedName}.`, [
                { label: 'Prepare draft now', value: 'prepare_draft', action: 'prepare_draft' },
            ]);
            return;
        }
        if (option.action === 'set_mode') {
            setForm((prev) => ({ ...prev, mode: option.value }));
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
        if (option.action === 'pick_provider') {
            setForm((prev) => ({ ...prev, selected_provider: Number(option.value) || null }));
            addAssistantMessage('Provider selected. You can confirm publish now.');
            return;
        }
        if (option.action === 'prepare_draft') {
            await generateSnapshot();
            return;
        }
        if (option.action === 'publish') {
            if (!snapshot) {
                await generateSnapshot();
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
                                                    className="rounded-full border border-blue-400/40 bg-blue-500/20 px-2 py-1 text-xs hover:bg-blue-500/30"
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

                        <div className="flex items-end gap-2">
                            <textarea
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3 text-sm"
                                placeholder="Describe your issue naturally..."
                                rows={2}
                                disabled={busy}
                            />
                            <button
                                onClick={() => runIntent()}
                                disabled={busy || !chatMessage.trim()}
                                className="rounded-xl bg-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-600 disabled:opacity-60"
                            >
                                {busy ? '...' : 'Send'}
                            </button>
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
                                    <span className="text-blue-300 font-bold">{settings.currency_symbol}{Number(snapshot.analysis?.budget_recommended || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Recommended Mode:</span>
                                    <span className="text-blue-300 font-bold capitalize">{snapshot.recommended_mode}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-700 mt-1">
                                    Based on category rate card + {snapshot.analysis?.budget_floor !== snapshot.analysis?.budget_recommended ? 'historical job data' : 'base pricing formula'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default ZeroTouchChatbot;
