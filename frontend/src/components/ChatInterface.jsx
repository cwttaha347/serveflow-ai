import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, Loader2 } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { playNotificationSound } from '../utils/sound';

const ChatInterface = ({ jobId, otherUser, isOpen, onClose }) => {
    const { user, token } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);
    const bottomRef = useRef(null);
    const wsRef = useRef(null);

    // Initial Load & WebSocket Connection
    useEffect(() => {
        if (!isOpen || !jobId || !user) return; // Guard against null user

        // Fetch history
        const fetchHistory = async () => {
            try {
                const res = await api.get(`messages/?job_id=${jobId}`);
                setMessages(res.data);
                setLoading(false);
                setTimeout(scrollToBottom, 100);
            } catch (err) {
                console.error("Failed to fetch messages", err);
                setLoading(false);
            }
        };

        fetchHistory();

        // Connect WebSocket
        const wsUrl = `ws://127.0.0.1:8000/ws/chat/${jobId}/?token=${token}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("Chat connected");
            setSocket(ws);
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'chat_message') {
                setMessages(prev => [...prev, {
                    content: data.message,
                    sender: { id: data.sender_id }, // minimal sender info
                    created_at: new Date().toISOString(),
                    is_realtime: true
                }]);
                setTimeout(scrollToBottom, 100);

                // Play sound if message is from OTHER person
                if (data.sender_id !== user.id) {
                    playNotificationSound();
                }
            }
        };

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [isOpen, jobId, token, user?.id]);

    const scrollToBottom = () => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !socket) return;

        const msg = newMessage;
        setNewMessage(''); // optimistic clear

        // Send via WebSocket
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
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                            {otherUser?.username?.[0]?.toUpperCase() || <MessageSquare size={20} />}
                        </div>
                        <div>
                            <h3 className="font-bold text-white">{otherUser?.username || 'Chat'}</h3>
                            <p className="text-xs text-blue-400">Job #{jobId}</p>
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
                                <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`
                                        max-w-[75%] p-3 rounded-2xl text-sm leading-relaxed
                                        ${isMe
                                            ? 'bg-blue-600 text-white rounded-br-none shadow-[0_0_15px_rgba(37,99,235,0.3)]'
                                            : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'}
                                    `}>
                                        {msg.content}
                                    </div>
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
                            onChange={(e) => setNewMessage(e.target.value)}
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
