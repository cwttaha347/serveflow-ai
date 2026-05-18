import { useState, useEffect } from 'react';
import api from '../api';
import {
    Clock, MapPin, DollarSign, Eye, Trash2,
    Zap, Calendar, Navigation, Info, AlertCircle, Plus, MessageSquare, Brain, Search, Filter, CheckCircle2, ChevronRight, Star, Loader2
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { motion, AnimatePresence } from 'framer-motion';
import ChatInterface from '../components/ChatInterface';
import { useWebSocket } from '../context/WebSocketContext';
import { formatMoney } from '../utils/money';

const MyRequests = () => {
    const { settings } = useSettings();
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeChat, setActiveChat] = useState(null);
    const { unreadByJob, lastMessage, isConnected } = useWebSocket();
    const { success, error: showError} = useToast();

    // Auto-refresh when request status changes
    useEffect(() => {
        if (lastMessage && ['request_update', 'job_update', 'new_bid'].includes(lastMessage.type)) {
            fetchRequests();
        }
    }, [lastMessage]);

    const handleOpenChat = (jobId, otherUserName) => {
        setActiveChat({ jobIds: jobId, otherUserName });
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const response = await api.get('requests/my_requests/');
            setRequests(response.data);
        } catch (error) {
            console.error('Error fetching requests:', error);
            showError('Failed to load your requests');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Cancel this request? If a provider already accepted or started, you may need support/dispute instead.')) {
            return;
        }
        try {
            // Preferred cancel semantics (status transition), not a hard delete.
            await api.post(`requests/${id}/cancel/`);
            success('Request cancelled successfully.');
            fetchRequests();
        } catch (error) {
            const code = error?.response?.data?.code;
            if (error?.response?.status === 409 || code === 'CANNOT_CANCEL_ACTIVE_JOB') {
                showError('This request is already in progress. You cannot cancel it here.');
                return;
            }
            // Backward compatibility: if cancel endpoint doesn’t exist yet, fall back.
            try {
                await api.delete(`requests/${id}/`);
                success('Request cancelled successfully.');
                fetchRequests();
            } catch {
                showError('Failed to cancel request');
            }
        }
    };

const getStatusStyles = (status) => {
    const styles = {
        pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        analyzing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        matched: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        assigned: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        completed: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
        cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    };
    return styles[status] || styles.pending;
};

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-bold animate-pulse">Loading your requests...</p>
        </div>
    );
}

return (
    <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-6xl mx-auto space-y-10 px-4 sm:px-6 lg:px-8"
    >
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
                <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">My Requests</h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Manage all your current and past service requests</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        {isConnected ? 'Live Sync Active' : 'Sync Offline'}
                    </span>
                </div>
                <button
                    onClick={() => { fetchRequests(); success('Hub synchronized.'); }}
                    className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                    title="Force Synchronize"
                >
                    <Clock className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Refresh</span>
                </button>
                <button
                    onClick={() => navigate('/create-request')}
                    className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-[1.5rem] font-black shadow-xl shadow-blue-600/20 hover:bg-blue-500 active:scale-95 transition-all text-sm uppercase tracking-widest"
                >
                    <Plus className="w-5 h-5" />
                    New Request
                </button>
            </div>
        </header>

        <div className="grid gap-6">
            <AnimatePresence mode="popLayout">
                {requests.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card p-20 text-center rounded-[3rem] border border-slate-200 dark:border-white/5 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl"
                    >
                        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Info className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">No Requests Yet</h3>
                        <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">You haven't made any requests. Let's start something new!</p>
                        <button
                            onClick={() => navigate('/create-request')}
                            className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                        >
                            Start Your First Request
                        </button>
                    </motion.div>
                ) : (
                    requests.map((request) => (
                        <motion.div
                            key={request.id}
                            variants={item}
                            layout
                            className="glass-card p-8 rounded-[2.5rem] bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/5 hover:border-blue-500/30 transition-all group"
                        >
                            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8 min-w-0">
                                <div className="flex-1 space-y-6">
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <div className="px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest">
                                            Request #{request.id}
                                        </div>
                                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusStyles(request.status)}`}>
                                            {request.status}
                                        </span>
                                        {request.job_id && Number(unreadByJob[String(request.job_id)] || 0) > 0 && (
                                            <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border bg-blue-600 text-white border-blue-500">
                                                {unreadByJob[String(request.job_id)]} unread
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">
                                            {request.title}
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-2xl line-clamp-2">
                                            {request.description}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-x-8 gap-y-4 pt-2">
                                        <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                            <MapPin className="w-4 h-4 text-blue-500" />
                                            <span className="truncate max-w-[200px]">{request.address}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                            <Calendar className="w-4 h-4 text-purple-500" />
                                            {new Date(request.created_at).toLocaleDateString()}
                                        </div>
                                        {request.budget && (
                                            <div className="flex items-center gap-2 text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                                <DollarSign className="w-4 h-4" />
                                                Budget: {formatMoney(request.budget, settings)}
                                            </div>
                                        )}
                                    </div>

                                    {/* No separate AI summary block: title/description are already rewritten if AI is enabled. */}
                                </div>

                                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full lg:w-auto min-w-0 lg:min-w-[200px]">
                                    <button
                                        onClick={() => navigate(`/dashboard/requests/${request.id}`)}
                                        className="w-full sm:flex-1 lg:flex-none px-6 sm:px-8 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-sm"
                                    >
                                        View Details
                                        <Eye className="w-4 h-4" />
                                    </button>

                                    {['assigned', 'started'].includes(request.status) && request.job_id && (
                                        <button
                                            onClick={() => handleOpenChat(request.job_id, 'Provider')}
                                            className="relative w-full sm:flex-1 lg:flex-none px-6 sm:px-8 py-4 bg-blue-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20"
                                        >
                                            Message Pro
                                            <MessageSquare className="w-4 h-4" />
                                            {Number(unreadByJob[String(request.job_id)] || 0) > 0 && (
                                                <span className="absolute -top-2 -right-2 min-w-[20px] h-[20px] px-1.5 rounded-full bg-white text-blue-700 text-[10px] font-black flex items-center justify-center border border-blue-200">
                                                    {Number(unreadByJob[String(request.job_id)]) > 99 ? '99+' : Number(unreadByJob[String(request.job_id)])}
                                                </span>
                                            )}
                                        </button>
                                    )}

                                    {['pending', 'analyzing'].includes(request.status) && (
                                        <button
                                            onClick={() => handleDelete(request.id)}
                                            className="w-full sm:flex-1 lg:flex-none px-6 sm:px-8 py-4 border-2 border-red-100 dark:border-red-900/20 text-red-500 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/10 transition-all flex items-center justify-center gap-3"
                                        >
                                            Cancel
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </AnimatePresence>
        </div>

        {/* Chat Interface */}
        {activeChat && (
            <ChatInterface
                jobId={activeChat.jobIds}
                otherUser={{ username: activeChat.otherUserName }}
                isOpen={!!activeChat}
                onClose={() => setActiveChat(null)}
            />
        )}
    </motion.div>
);
};

export default MyRequests;
