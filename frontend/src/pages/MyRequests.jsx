import { useState, useEffect } from 'react';
import api from '../api';
import {
    Clock, MapPin, DollarSign, Eye, Trash2,
    Zap, Calendar, Navigation, Info, AlertCircle
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ChatInterface from '../components/ChatInterface';

const MyRequests = () => {
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeChat, setActiveChat] = useState(null);
    const { success, error: showError } = useToast();

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
            showError('Failed to load logs');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Terminate this protocol? This action cannot be undone.')) {
            try {
                await api.delete(`requests/${id}/`);
                success('Protocol terminated successfully.');
                fetchRequests();
            } catch (error) {
                showError('Failed to terminate protocol');
            }
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
            analyzing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
            matched: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
            assigned: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
            completed: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
            cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
        };
        return colors[status] || 'bg-slate-500/10 text-slate-500 border-slate-500/20';
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
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 font-black uppercase tracking-widest animate-pulse">Retrieving Protocols...</p>
            </div>
        );
    }

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-10"
        >
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Active Protocols</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Tracking and managing your initialized service requests</p>
                </div>
                <button
                    onClick={() => navigate('/create-request')}
                    className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-[2rem] font-bold shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
                >
                    <Zap className="w-5 h-5 fill-white" />
                    Initialize New
                </button>
            </header>

            <div className="grid gap-6">
                <AnimatePresence>
                    {requests.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="glass-card p-20 text-center rounded-[3rem]"
                        >
                            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Info className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">No Protocols Found</h3>
                            <p className="text-slate-500 font-medium mb-8 text-lg">Your service ecosystem is currently silent.</p>
                            <button
                                onClick={() => navigate('/create-request')}
                                className="px-8 py-3 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all"
                            >
                                Start First Deployment
                            </button>
                        </motion.div>
                    ) : (
                        requests.map((request) => (
                            <motion.div
                                key={request.id}
                                variants={item}
                                layout
                                className="glass-card p-8 rounded-[2.5rem] group hover:bg-white/90 dark:hover:bg-slate-900/60 transition-all"
                            >
                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center gap-4 flex-wrap">
                                            <div className="px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl font-black text-xs uppercase tracking-widest">
                                                ID: #{request.id}
                                            </div>
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border ${getStatusColor(request.status)}`}>
                                                {request.status}
                                            </span>
                                        </div>

                                        <div>
                                            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">
                                                {request.title}
                                            </h3>
                                            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-2xl">
                                                {request.description}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-x-8 gap-y-3 pt-2">
                                            <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                                <Navigation className="w-4 h-4 text-blue-500" />
                                                {request.address}
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                                <Calendar className="w-4 h-4 text-purple-500" />
                                                {new Date(request.created_at).toLocaleDateString()}
                                            </div>
                                            {request.budget && (
                                                <div className="flex items-center gap-2 text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                                    <DollarSign className="w-4 h-4" />
                                                    Allocated: ${request.budget}
                                                </div>
                                            )}
                                        </div>

                                        {request.ai_summary && Object.keys(request.ai_summary).length > 0 && (
                                            <div className="mt-6 p-6 bg-blue-500/5 dark:bg-blue-400/5 border border-blue-500/10 rounded-[2rem] relative overflow-hidden group/ai">
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover/ai:scale-150 transition-transform duration-700" />
                                                <div className="relative z-10 flex items-start gap-4">
                                                    <div className="p-3 bg-blue-500/10 rounded-xl">
                                                        <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400 fill-blue-600/20" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
                                                            Cognitive Summary
                                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                                        </p>
                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                                                            {request.ai_summary.summary || 'Cognitive analysis in progress...'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex lg:flex-col gap-3">
                                        <button
                                            onClick={() => navigate(`/dashboard/requests/${request.id}`)}
                                            className="px-8 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-3 group/btn shadow-sm"
                                        >
                                            Inspect
                                            <Eye className="w-4 h-4 group-hover/btn:scale-125 transition-transform" />
                                        </button>

                                        {['assigned', 'started'].includes(request.status) && request.job_id && (
                                            <button
                                                onClick={() => handleOpenChat(request.job_id, 'Provider')}
                                                className="px-8 py-4 bg-blue-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center gap-3 shadow-sm shadow-blue-500/20"
                                            >
                                                Message
                                                <Zap className="w-4 h-4 fill-white animate-pulse" />
                                            </button>
                                        )}

                                        {['pending', 'analyzing'].includes(request.status) && (
                                            <button
                                                onClick={() => handleDelete(request.id)}
                                                className="p-4 border border-red-200 dark:border-red-900/30 text-red-500 rounded-[1.5rem] hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                                                title="Terminate Protocol"
                                            >
                                                <Trash2 className="w-5 h-5" />
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

// Lazy import removed, moved to top
export default MyRequests;
