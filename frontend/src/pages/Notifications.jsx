import { useEffect, useState } from 'react';
import api from '../api';
import { useWebSocket } from '../context/WebSocketContext';

const Notifications = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const { refreshUnreadSummary } = useWebSocket();

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
    }, []);

    const markRead = async (id = null) => {
        await api.post('notifications/read/', id ? { id } : {});
        await load();
        await refreshUnreadSummary();
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
                        <div key={item.id} className={`rounded-2xl p-4 border ${item.is_read ? 'border-slate-200 dark:border-slate-700' : 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'}`}>
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white">{item.title || item.type}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">{item.message}</p>
                                </div>
                                {!item.is_read && (
                                    <button onClick={() => markRead(item.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900">
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
