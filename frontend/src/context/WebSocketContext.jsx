import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { buildWsUrl } from '../utils/ws';
import api from '../api';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const { token, user } = useAuth();
    const { success, info, error: showError } = useToast();
    const [socket, setSocket] = useState(null);
    const [lastMessage, setLastMessage] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [unreadByJob, setUnreadByJob] = useState({});
    const [totalUnread, setTotalUnread] = useState(0);

    // Ref to prevent multiple connections
    const wsRef = useRef(null);

    useEffect(() => {
        const handleInteraction = () => {
            import('../utils/sound').then(mod => mod.warmAudioContext());
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
        if (!token) return;
        try {
            const [feedRes, msgRes] = await Promise.all([
                api.get('notifications/feed/'),
                api.get('messages/unread_summary/'),
            ]);
            // Use combined count from feed (NotificationItem + chat messages)
            setTotalUnread(Number(feedRes.data?.unread_count || 0));
            // Per-job unread breakdown from messages endpoint
            const jobs = Array.isArray(msgRes.data?.jobs) ? msgRes.data.jobs : [];
            const map = {};
            jobs.forEach((row) => {
                map[String(row.job_id)] = Number(row.unread_count || 0);
            });
            setUnreadByJob(map);
        } catch (err) {
            console.error('Failed to refresh unread summary', err);
        }
    }, [token]);

    const markJobRead = useCallback(async (jobId) => {
        if (!jobId) return;
        try {
            await api.post('messages/mark_read/', { job_id: jobId });
            await refreshUnreadSummary();
        } catch (err) {
            console.error('Failed to mark job as read', err);
        }
    }, [refreshUnreadSummary]);

    const markNotificationRead = useCallback(async (id) => {
        if (!id) return;
        try {
            await api.post('notifications/read/', { id });
            await refreshUnreadSummary();
        } catch (err) {
            console.error('Failed to mark notification as read', err);
        }
    }, [refreshUnreadSummary]);

    useEffect(() => {
        // Connect only if we have a token and user
        if (token && user && !socket) {
            connect();
            refreshUnreadSummary();
        } else if (!token) {
            setUnreadByJob({});
            setTotalUnread(0);
        }

        // Clean up on unmount or logout
        return () => {
            if (!token && socket) {
                disconnect();
            }
        };
    }, [token, user, refreshUnreadSummary]);

    const connect = () => {
        if (wsRef.current) return; // Already connecting/connected

        const wsUrl = buildWsUrl('/ws/notifications/', token);
        console.log("Connecting to WebSocket:", wsUrl);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("WebSocket connected");
            setIsConnected(true);
            setSocket(ws);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("WebSocket message:", data);
                setLastMessage(data);
                handleNotification(data);
            } catch (e) {
                console.error("WebSocket message error:", e);
            }
        };

        ws.onclose = () => {
            console.log("WebSocket disconnected");
            setIsConnected(false);
            setSocket(null);
            wsRef.current = null;

            // Simple reconnect logic (optional)
            if (token) {
                setTimeout(connect, 3000);
            }
        };

        ws.onerror = (err) => {
            console.error("WebSocket error:", err);
            ws.close();
        };
    };

    const disconnect = () => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    };

    const handleNotification = (data) => {
        // Handle different notification types
        // Expected payload: { message: "...", type: "...", payload: {...} }
        const { message, type } = data;

        // Play sound for all real-time events
        import('../utils/sound').then(mod => mod.playNotificationSound());

        switch (type) {
            case 'request_update':
                success(message); // Green toast for updates
                break;
            case 'job_update':
                info(message); // Blue toast for job info
                break;
            case 'new_job':
                success("🚨 New Job Alert: " + message);
                break;
            case 'chat_message':
                // We don't toast chat messages if we are IN the chat, but global toaster is fine for now
                info(`New message: ${String(message || '').substring(0, 30)}...`);
                refreshUnreadSummary();
                break;
            default:
                info(message);
        }
    };

    return (
        <WebSocketContext.Provider value={{ socket, lastMessage, isConnected, totalUnread, unreadByJob, refreshUnreadSummary, markJobRead, markNotificationRead }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    return useContext(WebSocketContext);
};
