import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { buildWsUrl } from '../utils/ws';
import api from '../api';

const WebSocketContext = createContext(null);

const INITIAL_RECONNECT_MS = 3000;
const MAX_RECONNECT_MS = 60000;
const MAX_RECONNECT_ATTEMPTS = 12;
const TOAST_DEDUPE_MS = 8000;

export const WebSocketProvider = ({ children }) => {
    const { token, user } = useAuth();
    const { success, info } = useToast();
    const [socket, setSocket] = useState(null);
    const [lastMessage, setLastMessage] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [unreadByJob, setUnreadByJob] = useState({});
    const [totalUnread, setTotalUnread] = useState(0);
    const [feedVersion, setFeedVersion] = useState(0);

    const wsRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const reconnectDelayRef = useRef(INITIAL_RECONNECT_MS);
    const reconnectAttemptsRef = useRef(0);
    const tokenRef = useRef(token);
    const userIdRef = useRef(user?.id);
    const toastHandlersRef = useRef({ success, info });
    const recentToastKeysRef = useRef(new Map());
    const connectRef = useRef(null);

    useEffect(() => {
        tokenRef.current = token;
    }, [token]);

    useEffect(() => {
        userIdRef.current = user?.id;
    }, [user?.id]);

    useEffect(() => {
        toastHandlersRef.current = { success, info };
    }, [success, info]);

    useEffect(() => {
        const handleInteraction = () => {
            import('../utils/sound').then((mod) => mod.warmAudioContext());
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };
        window.addEventListener('click', handleInteraction);
        window.addEventListener('touchstart', handleInteraction);
        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };
    }, []);

    const refreshUnreadSummary = useCallback(async () => {
        if (!tokenRef.current) return;
        try {
            const [feedRes, msgRes] = await Promise.all([
                api.get('notifications/feed/'),
                api.get('messages/unread_summary/'),
            ]);
            setTotalUnread(Number(feedRes.data?.unread_count || 0));
            const jobs = Array.isArray(msgRes.data?.jobs) ? msgRes.data.jobs : [];
            const map = {};
            jobs.forEach((row) => {
                map[String(row.job_id)] = Number(row.unread_count || 0);
            });
            setUnreadByJob(map);
        } catch (err) {
            if (import.meta.env.DEV) {
                console.warn('Failed to refresh unread summary', err);
            }
        }
    }, []);

    const bumpFeed = useCallback(() => {
        setFeedVersion((v) => v + 1);
    }, []);

    const markJobRead = useCallback(async (jobId) => {
        if (!jobId) return;
        try {
            await api.post('messages/mark_read/', { job_id: jobId });
            await refreshUnreadSummary();
            bumpFeed();
        } catch (err) {
            if (import.meta.env.DEV) {
                console.warn('Failed to mark job as read', err);
            }
        }
    }, [refreshUnreadSummary, bumpFeed]);

    const markNotificationRead = useCallback(async (id) => {
        if (!id) return;
        try {
            await api.post('notifications/read/', { id });
            await refreshUnreadSummary();
            bumpFeed();
        } catch (err) {
            if (import.meta.env.DEV) {
                console.warn('Failed to mark notification read', err);
            }
        }
    }, [refreshUnreadSummary, bumpFeed]);

    const shouldShowToast = useCallback((data) => {
        const key = data.notification_id
            ? `id:${data.notification_id}`
            : `${data.type || 'info'}:${String(data.message || '').slice(0, 120)}`;
        const now = Date.now();
        const seen = recentToastKeysRef.current;
        const last = seen.get(key);
        if (last && now - last < TOAST_DEDUPE_MS) {
            return false;
        }
        seen.set(key, now);
        if (seen.size > 100) {
            for (const [k, ts] of seen) {
                if (now - ts > TOAST_DEDUPE_MS) seen.delete(k);
            }
        }
        return true;
    }, []);

    const handleNotification = useCallback((data) => {
        setLastMessage(data);
        bumpFeed();
        refreshUnreadSummary();

        if (!shouldShowToast(data)) {
            return;
        }

        const { message, type } = data;
        const { success: showSuccess, info: showInfo } = toastHandlersRef.current;
        import('../utils/sound').then((mod) => mod.playNotificationSound());

        switch (type) {
            case 'request_update':
                showSuccess(message);
                break;
            case 'job_update':
                showInfo(message);
                break;
            case 'new_job':
                showSuccess(`New job: ${message}`);
                break;
            case 'invoice_paid':
                showSuccess(message || 'Invoice paid');
                break;
            case 'chat_message':
                showInfo(`New message: ${String(message || '').substring(0, 30)}...`);
                break;
            default:
                showInfo(message);
        }
    }, [shouldShowToast, refreshUnreadSummary, bumpFeed]);

    const clearReconnectTimer = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
    }, []);

    const scheduleReconnect = useCallback(() => {
        if (!tokenRef.current) return;
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            if (import.meta.env.DEV) {
                console.warn('WebSocket: stopped reconnecting after repeated failures');
            }
            return;
        }
        clearReconnectTimer();
        const delay = reconnectDelayRef.current;
        reconnectAttemptsRef.current += 1;
        reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_MS);
        reconnectTimerRef.current = setTimeout(() => {
            connectRef.current?.();
        }, delay);
    }, [clearReconnectTimer]);

    const disconnect = useCallback(() => {
        clearReconnectTimer();
        reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS;
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
        setSocket(null);
    }, [clearReconnectTimer]);

    const connect = useCallback(() => {
        if (!tokenRef.current || wsRef.current) return;

        const wsUrl = buildWsUrl('/ws/notifications/', tokenRef.current);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            reconnectDelayRef.current = INITIAL_RECONNECT_MS;
            reconnectAttemptsRef.current = 0;
            setIsConnected(true);
            setSocket(ws);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleNotification(data);
            } catch (e) {
                if (import.meta.env.DEV) {
                    console.warn('WebSocket message parse error:', e);
                }
            }
        };

        ws.onclose = () => {
            setIsConnected(false);
            setSocket(null);
            wsRef.current = null;
            if (tokenRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                scheduleReconnect();
            }
        };

        ws.onerror = () => {
            ws.close();
        };
    }, [handleNotification, scheduleReconnect]);

    connectRef.current = connect;

    useEffect(() => {
        if (token && user?.id) {
            reconnectAttemptsRef.current = 0;
            reconnectDelayRef.current = INITIAL_RECONNECT_MS;
            connect();
            refreshUnreadSummary();
        } else {
            disconnect();
            setUnreadByJob({});
            setTotalUnread(0);
        }
        return () => {
            clearReconnectTimer();
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, user?.id]);

    return (
        <WebSocketContext.Provider
            value={{
                socket,
                lastMessage,
                isConnected,
                totalUnread,
                unreadByJob,
                feedVersion,
                refreshUnreadSummary,
                markJobRead,
                markNotificationRead,
            }}
        >
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => useContext(WebSocketContext);
