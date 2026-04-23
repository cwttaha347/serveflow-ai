import { useState, useEffect } from 'react';
import api from '../api';
import {
    Briefcase, DollarSign, Star, CheckCircle, Clock,
    XCircle, ArrowRight, Zap, Target, TrendingUp,
    ShieldCheck, Tag, Award, MessageSquare
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ChatInterface from '../components/ChatInterface';
import { useWebSocket } from '../context/WebSocketContext';

const ProviderDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { settings } = useSettings();
    const [stats, setStats] = useState({ total_jobs: 0, completed: 0, earnings: 0, rating: 0 });
    const [providerInfo, setProviderInfo] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [loading, setLoading] = useState(true);
    const { unreadByJob, lastMessage, isConnected } = useWebSocket();

    // Auto-refresh on new jobs or status updates
    useEffect(() => {
        if (lastMessage && ['new_job', 'job_update', 'request_update'].includes(lastMessage.type)) {
            fetchProviderData();
        }
    }, [lastMessage]);

    const handleOpenChat = (jobId, otherUserName) => {
        setActiveChat({ jobIds: jobId, otherUserName });
    };
    const { success, error: showError } = useToast();

    useEffect(() => {
        fetchProviderData();
    }, []);

    const fetchProviderData = async () => {
        try {
            const [jobsRes, providerRes, analyticsRes] = await Promise.all([
                api.get('jobs/'),
                api.get('providers/me/'),
                api.get('providers/analytics/').catch(() => ({ data: {} }))
            ]);

            setJobs(jobsRes.data);
            setProviderInfo(providerRes.data);

            const completed = jobsRes.data.filter(j => j.status === 'completed').length;
            const earnings = jobsRes.data
                .filter(j => j.status === 'completed')
                .reduce((sum, j) => sum + Number(j.provider_earnings || 0), 0);

            setStats({
                total_jobs: analyticsRes.data.total_jobs ?? jobsRes.data.length,
                completed: analyticsRes.data.completed_jobs ?? completed,
                earnings: analyticsRes.data.earned_total ?? earnings,
                rating: providerRes.data.rating || 0
            });
        } catch (error) {
            console.error('Error fetching provider data:', error);
            showError('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptJob = async (jobId) => {
        try {
            await api.post(`jobs/${jobId}/accept/`);
            success('Mission accepted! Protocol initiated.');
            fetchProviderData();
        } catch (error) {
            showError('Failed to initiate protocol');
        }
    };

    const handleStartJob = async (jobId) => {
        try {
            await api.post(`jobs/${jobId}/start/`);
            success('Execution protocol started. Tactical timer active.');
            fetchProviderData();
        } catch (error) {
            showError('Failed to start mission execution');
        }
    };

    const handleCompleteJob = async (jobId) => {
        try {
            await api.post(`jobs/${jobId}/complete/`);
            success('Mission accomplished! Extraction sequence complete.');
            fetchProviderData();
        } catch (error) {
            showError('Failed to report mission completion');
        }
    };

    const handleDeclineJob = async (jobId) => {
        try {
            await api.patch(`jobs/${jobId}/`, { status: 'declined' });
            success('Job declined');
            fetchProviderData();
        } catch (error) {
            showError('Failed to decline job');
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
            accepted: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
            started: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
            completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
            declined: 'bg-red-500/10 text-red-500 border-red-500/20',
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
                <p className="text-slate-500 font-black uppercase tracking-widest animate-pulse">Initializing Command...</p>
            </div>
        );
    }

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-10 px-1 sm:px-0"
        >
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Execution Hub</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Managing active missions and performance metrics</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            {isConnected ? 'Live Sync Active' : 'Sync Offline'}
                        </span>
                    </div>
                    <button 
                        onClick={() => { fetchProviderData(); success('Hub synchronized with command center.'); }}
                        className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                        title="Force Synchronize"
                    >
                        <Clock className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Refresh</span>
                    </button>
                    <div className="w-full sm:w-auto px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                        <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none mb-1">Status</p>
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold leading-none flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            Online & Ready
                        </div>
                    </div>
                </div>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                {[
                    { label: 'Total Missions', value: stats.total_jobs, icon: Briefcase, color: 'blue' },
                    { label: 'Successful Ends', value: stats.completed, icon: CheckCircle, color: 'emerald' },
                    { label: 'Total Revenue', value: `${settings.currency_symbol}${stats.earnings.toLocaleString()}`, icon: DollarSign, color: 'blue', action: () => navigate('earnings') },
                    { label: 'Trust Rating', value: stats.rating, icon: Star, color: 'amber', action: () => navigate('profile') }
                ].map((s, i) => (
                    <motion.div
                        key={i}
                        variants={item}
                        onClick={s.action}
                        className={`glass-card p-6 rounded-[2rem] group relative overflow-hidden ${s.action ? 'cursor-pointer' : ''}`}
                    >
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-${s.color}-500/5 rounded-full blur-2xl group-hover:bg-${s.color}-500/10 transition-colors`} />
                        <div className="flex items-start justify-between relative z-10">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{s.value}</p>
                            </div>
                            <div className={`p-3 bg-${s.color}-50 dark:bg-${s.color}-900/10 rounded-xl group-hover:scale-110 transition-transform`}>
                                <s.icon className={`w-6 h-6 text-${s.color}-600 dark:text-${s.color}-400`} />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Provider Identity Card */}
            {providerInfo && (
                <motion.div variants={item} className="glass-card p-6 sm:p-8 rounded-[2.5rem] relative overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="flex items-start gap-5">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-blue-500/20 shrink-0">
                                {providerInfo.user?.first_name?.[0] || 'P'}
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                        {providerInfo.user?.first_name} {providerInfo.user?.last_name}
                                    </h3>
                                    {providerInfo.verification_status === 'verified' && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                                            <ShieldCheck className="w-3 h-3" /> Verified
                                        </span>
                                    )}
                                    {providerInfo.verification_status === 'pending' && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-500/20">
                                            <Clock className="w-3 h-3" /> Pending Verification
                                        </span>
                                    )}
                                </div>
                                {providerInfo.bio && (
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 max-w-lg">{providerInfo.bio}</p>
                                )}
                                <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                                    {providerInfo.experience_years > 0 && (
                                        <span className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-blue-500" /> {providerInfo.experience_years} Yrs Experience</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button onClick={() => navigate('profile')} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shrink-0">
                            Edit Profile
                        </button>
                    </div>
                    {/* Categories & Skills */}
                    <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/5 space-y-3">
                        {providerInfo.categories?.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Categories:</span>
                                {providerInfo.categories.map(cat => (
                                    <span key={cat.id} className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold border border-blue-500/20">
                                        {cat.name}
                                    </span>
                                ))}
                            </div>
                        )}
                        {providerInfo.skills?.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Skills:</span>
                                {providerInfo.skills.map((skill, i) => (
                                    <span key={i} className="px-2.5 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-md text-[11px] font-bold border border-purple-500/15">
                                        <Tag className="w-3 h-3 inline mr-1" />{skill}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Jobs List */}
            <motion.div variants={item} className="space-y-6">
                <div className="flex items-center justify-between pl-4">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Available Missions</h2>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                        {jobs.length} POTENTIAL TASKS
                    </span>
                </div>

                <div className="grid gap-4">
                    {jobs.length === 0 ? (
                        <div className="glass-card p-20 text-center rounded-[3rem]">
                            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Zap className="w-10 h-10 text-slate-300" />
                            </div>
                            <p className="text-slate-500 font-bold">Scanning for new opportunities...</p>
                        </div>
                    ) : (
                        jobs.map((job) => (
                            <motion.div
                                key={job.id}
                                layoutId={job.id}
                                className="glass-card p-6 rounded-[2.5rem] flex flex-col lg:flex-row lg:items-center justify-between gap-6 group"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 min-w-0">
                                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900/50 rounded-[1.5rem] flex flex-col items-center justify-center border border-slate-100 dark:border-slate-800 group-hover:bg-blue-500/5 transition-colors">
                                        <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">ID</p>
                                        <p className="text-xl font-black text-slate-900 dark:text-white leading-none">#{job.id}</p>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3
                                                onClick={() => navigate(`jobs/${job.id}`)}
                                                className="text-xl font-black text-slate-900 dark:text-white hover:text-blue-600 cursor-pointer transition-colors"
                                            >
                                                {job.request?.title || `Job #${job.id}`}
                                            </h3>
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(job.status)}`}>
                                                {job.status}
                                            </span>
                                            {Number(unreadByJob[String(job.id)] || 0) > 0 && (
                                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-blue-600 text-white border-blue-500">
                                                    {unreadByJob[String(job.id)]} unread
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                            <span className="flex items-center gap-2">
                                                <Target className="w-4 h-4 text-blue-500" />
                                                Match: {job.match_score}%
                                            </span>
                                            <span className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-purple-500" />
                                                Initiated: {new Date(job.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    {job.status === 'pending' ? (
                                        <>
                                            <button
                                                onClick={() => handleAcceptJob(job.id)}
                                                className="w-full sm:w-auto px-6 sm:px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 shadow-xl shadow-emerald-500/20 transition-all"
                                            >
                                                Initialize
                                            </button>
                                            <button
                                                onClick={() => handleDeclineJob(job.id)}
                                                className="p-4 border border-slate-200 dark:border-slate-800 text-slate-400 rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all"
                                            >
                                                <XCircle className="w-6 h-6" />
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => navigate(`jobs/${job.id}`)}
                                            className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:translate-x-1 transition-all"
                                        >
                                            <ArrowRight className="w-6 h-6" />
                                        </button>
                                    )}
                                    {['accepted', 'started', 'completed'].includes(job.status) && (
                                        <button
                                            onClick={() => handleOpenChat(job.id, job.request?.user?.first_name || job.request?.user?.username || 'Customer')}
                                            className="relative p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20"
                                            title="Message Customer"
                                        >
                                            <MessageSquare className="w-6 h-6" />
                                            {Number(unreadByJob[String(job.id)] || 0) > 0 && (
                                                <span className="absolute -top-2 -right-2 min-w-[20px] h-[20px] px-1.5 rounded-full bg-white text-blue-700 text-[10px] font-black flex items-center justify-center border border-blue-200">
                                                    {Number(unreadByJob[String(job.id)]) > 99 ? '99+' : Number(unreadByJob[String(job.id)])}
                                                </span>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </motion.div>

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

export default ProviderDashboard;
