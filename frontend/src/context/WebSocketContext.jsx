import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const { token, user } = useAuth();
    const { success, info, error: showError } = useToast();
    const [socket, setSocket] = useState(null);
    const [lastMessage, setLastMessage] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    // Ref to prevent multiple connections
    const wsRef = useRef(null);

    useEffect(() => {
        // Connect only if we have a token and user
        if (token && user && !socket) {
            connect();
        }

        // Clean up on unmount or logout
        return () => {
            if (!token && socket) {
                disconnect();
            }
        };
    }, [token, user]);

    const connect = () => {
        if (wsRef.current) return; // Already connecting/connected

        const wsUrl = `ws://localhost:8000/ws/notifications/?token=${token}`;
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
                info("New Job Available: " + message);
                break;
            case 'chat_message':
                // We don't toast chat messages if we are IN the chat, but global toaster is fine for now
                info(`New message: ${message.substring(0, 30)}...`);
                break;
            default:
                info(message);
        }
    };

    return (
        <WebSocketContext.Provider value={{ socket, lastMessage, isConnected }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    return useContext(WebSocketContext);
};
