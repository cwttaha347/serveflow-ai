import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { playNotificationSound } from '../utils/sound';
import { buildWsUrl } from '../utils/ws';
import { useWebSocket } from '../context/WebSocketContext';

const ChatInterface = ({ jobId, otherUser, isOpen, onClose }) => {
    const { user, token } = useAuth();
    const { markJobRead } = useWebSocket();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [otherUserTyping, setOtherUserTyping] = useState(false);
    const [connectionState, setConnectionState] = useState('connecting');
    const bottomRef = useRef(null);
    const wsRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const connectTimeoutRef = useRef(null);
    const reconnectAttemptRef = useRef(0);
    const shouldReconnectRef = useRef(true);

    // Initial Load & WebSocket Connection
    useEffect(() => {
        if (!isOpen || !jobId || !user) return;
        shouldReconnectRef.current = true;

        const fetchHistory = async () => {
            try {
                const res = await api.get(`messages/?job_id=${jobId}`);
                setMessages(res.data);
                markJobRead(jobId);
                setLoading(false);
                setTimeout(scrollToBottom, 100);
            } catch (err) {
                console.error("Failed to fetch messages", err);
                setLoading(false);
            }
        };

        fetchHistory();

        const connectChatSocket = () => {
            const wsUrl = buildWsUrl(`/ws/chat/${jobId}/`, token);
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;
            setConnectionState('connecting');
            // Prevent infinite "connecting..." state on network edge cases.
            if (connectTimeoutRef.current) window.clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = window.setTimeout(() => {
                if (ws.readyState === WebSocket.CONNECTING) {
                    setConnectionState('error');
                    ws.close(4000, 'connection timeout');
                }
            }, 10000);

            ws.onopen = () => {
                reconnectAttemptRef.current = 0;
                setConnectionState('connected');
                setSocket(ws);
                if (connectTimeoutRef.current) window.clearTimeout(connectTimeoutRef.current);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'chat_message') {
                    setMessages(prev => {
                        const exists = prev.find(m => m.id === data.message_id);
                        if (exists) return prev;

                        return [...prev, {
                            id: data.message_id,
                            content: data.message,
                            sender: { id: data.sender_id },
                            created_at: data.timestamp || new Date().toISOString(),
                            is_read: false
                        }];
                    });
                    setTimeout(scrollToBottom, 100);

                    if (data.sender_id !== user.id) {
                        playNotificationSound();
                        markJobRead(jobId);
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'read_receipt',
                                message_id: data.message_id
                            }));
                        }
                    }
                } else if (data.type === 'typing') {
                    if (data.sender_id !== user.id) {
                        setOtherUserTyping(data.is_typing);
                    }
                } else if (data.type === 'read_receipt') {
                    setMessages(prev => prev.map(m =>
                        m.id === data.message_id ? { ...m, is_read: true } : m
                    ));
                }
            };

            ws.onclose = (event) => {
                setSocket(null);
                setConnectionState('disconnected');
                if (connectTimeoutRef.current) window.clearTimeout(connectTimeoutRef.current);
                // Stop retries on auth/policy close codes.
                if ([1008, 4001, 4401, 4403].includes(event.code)) {
                    setConnectionState('error');
                    return;
                }
                if (!shouldReconnectRef.current || !isOpen) return;
                reconnectAttemptRef.current += 1;
                if (reconnectAttemptRef.current > 6) {
                    setConnectionState('error');
                    return;
                }
                const delay = Math.min(10000, 1000 * reconnectAttemptRef.current);
                reconnectTimeoutRef.current = window.setTimeout(connectChatSocket, delay);
            };

            ws.onerror = () => {
                setConnectionState('error');
            };
        };

        connectChatSocket();

        return () => {
            shouldReconnectRef.current = false;
            if (reconnectTimeoutRef.current) window.clearTimeout(reconnectTimeoutRef.current);
            if (connectTimeoutRef.current) window.clearTimeout(connectTimeoutRef.current);
            if (wsRef.current) wsRef.current.close();
        };
    }, [isOpen, jobId, token, user?.id, markJobRead]);

    const scrollToBottom = () => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleTyping = (e) => {
        setNewMessage(e.target.value);
        if (!socket) return;

        if (!isTyping) {
            setIsTyping(true);
            socket.send(JSON.stringify({ type: 'typing', is_typing: true }));
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            socket.send(JSON.stringify({ type: 'typing', is_typing: false }));
        }, 2000);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !socket) return;

        const msg = newMessage;
        setNewMessage('');
        setIsTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        socket.send(JSON.stringify({ type: 'typing', is_typing: false }));

        socket.send(JSON.stringify({
            message: msg
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center md:justify-end md:items-end md:p-6 bg-black/50 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none pointer-events-auto">
            <div className="w-full h-full md:w-96 md:h-[600px] bg-[#0f172a]/95 glass-dark border border-slate-700/50 md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                                {otherUser?.username?.[0]?.toUpperCase() || <MessageSquare size={20} />}
                            </div>
                            {otherUserTyping && (
                                <div className="absolute -bottom-1 -right-1 flex gap-0.5 bg-blue-600 rounded-full px-1.5 py-1 border-2 border-[#0f172a]">
                                    <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-white">{otherUser?.username || 'Chat'}</h3>
                            <p className="text-xs text-blue-400">
                                {otherUserTyping ? 'is typing...' : `Job #${jobId}`}
                            </p>
                            <p className={`text-[10px] ${connectionState === 'connected' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {connectionState}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    ) : (
                        messages.map((msg, idx) => {
                            const isMe = msg.sender.id === user.id || msg.sender_id === user.id;
                            return (
                                <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className={`
                                        max-w-[75%] p-3 rounded-2xl text-sm leading-relaxed
                                        ${isMe
                                            ? 'bg-blue-600 text-white rounded-br-none shadow-[0_0_15px_rgba(37,99,235,0.3)]'
                                            : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'}
                                    `}>
                                        {msg.content}
                                    </div>
                                    {isMe && (
                                        <div className="flex items-center gap-1 mt-1 px-1">
                                            <span className="text-[10px] text-slate-500">
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {msg.is_read ? (
                                                <div className="flex -space-x-1">
                                                    <CheckCircle2 size={10} className="text-blue-400 fill-blue-400/20" />
                                                    <CheckCircle2 size={10} className="text-blue-400 fill-blue-400/20" />
                                                </div>
                                            ) : (
                                                <CheckCircle2 size={10} className="text-slate-600" />
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleSend} className="p-4 border-t border-slate-700 bg-slate-900/50">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={handleTyping}
                            placeholder="Type a message..."
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim()}
                            className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] active:scale-95"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChatInterface;
