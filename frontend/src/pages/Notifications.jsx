import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useWebSocket } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';
import { getNotificationTarget } from '../utils/notificationNavigation';

const Notifications = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const { refreshUnreadSummary, feedVersion } = useWebSocket();
    const { user } = useAuth();
    const navigate = useNavigate();
    const userRole = user?.role || 'user';

    const load = async () => {
        try {
            setLoading(true);
            const res = await api.get('notifications/feed/');
            setItems(res.data.items || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [feedVersion]);

    const markRead = async (id = null) => {
        await api.post('notifications/read/', id ? { id } : {});
        await load();
        await refreshUnreadSummary();
    };

    const handleRowClick = async (item) => {
        await markRead(item.id);
        const target = getNotificationTarget({
            type: item.type,
            payload: item.payload,
            userRole,
        });
        if (target) navigate(target);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">Notifications</h1>
                <button onClick={() => markRead()} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">
                    Mark all read
                </button>
            </div>
            {loading ? (
                <div className="py-16 text-center text-slate-500">Loading notifications...</div>
            ) : (
                <div className="space-y-3">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleRowClick(item);
                                }
                            }}
                            onClick={() => handleRowClick(item)}
                            className={`rounded-2xl p-4 border text-left w-full cursor-pointer transition hover:opacity-95 ${item.is_read ? 'border-slate-200 dark:border-slate-700' : 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'}`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-900 dark:text-white">{item.title || item.type}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">{item.message}</p>
                                </div>
                                {!item.is_read && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            markRead(item.id);
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 shrink-0"
                                    >
                                        Mark read
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {!items.length && <div className="py-16 text-center text-slate-500">No notifications found.</div>}
                </div>
            )}
        </div>
    );
};

export default Notifications;
