import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import {
    MapPin, Calendar, Clock, DollarSign, User, AlertCircle,
    Star, FileText, CheckCircle, PlayCircle, Package, ArrowLeft,
    Brain, Receipt, CheckCircle2, Navigation, MessageSquare, ShieldCheck
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import ChatInterface from '../components/ChatInterface';
import { formatMoney } from '../utils/money';
import { useAuth } from '../context/AuthContext';

const RequestDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { error: showError, success: showSuccess } = useToast();
    const { user } = useAuth();
    const { settings } = useSettings();

    const [request, setRequest] = useState(null);
    const [job, setJob] = useState(null);
    const [hasReview, setHasReview] = useState(false);
    const [linkedRequests, setLinkedRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeChat, setActiveChat] = useState(false);

    const fetchRequestDetails = async () => {
        try {
            const res = await api.get(`/requests/${id}/`);
            setRequest(res.data.request || null);
            setJob(res.data.job || null);
            setHasReview(res.data.hasReview || false);
            setLinkedRequests(res.data.linked_requests || []);
        } catch (err) {
            showError("Failed to load request details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequestDetails();
    }, [id]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 font-bold animate-pulse">Loading updates...</p>
            </div>
        );
    }

    if (!request) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <AlertCircle className="w-16 h-16 text-red-500" />
                <p className="text-slate-500 font-bold">Request not found.</p>
                <button onClick={() => navigate(-1)} className="text-blue-600 font-bold">Go back</button>
            </div>
        );
    }

    const getStatusStyles = (status) => {
        const styles = {
            pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
            accepted: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
            started: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
            completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
            cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
        };
        return styles[status] || 'bg-slate-100 text-slate-800';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-6xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 pb-12"
        >
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 text-slate-500 hover:text-blue-600 transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Request Details</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Request #{request.id}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {job && ['accepted', 'started'].includes(job.status) && (
                        <button
                            onClick={() => navigate(`/dashboard/tracking/${job.id}`)}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 active:scale-95 text-sm uppercase tracking-widest"
                        >
                            <Navigation className="w-4 h-4" /> Track Pro
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                {/* Main Info Column */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="glass-card p-10 rounded-[3rem] bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/5 shadow-2xl">
                        <div className="flex justify-between items-start mb-8 pb-6 border-b border-slate-100 dark:border-white/5">
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-tight pr-4">{request.title}</h2>
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shrink-0 ${getStatusStyles(job?.status || request.status)}`}>
                                {job?.status || request.status}
                            </span>
                        </div>

                        <div className="space-y-8">
                            <section>
                                <h3 className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400 mb-4">Description</h3>
                                <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed text-lg">
                                    {request.description}
                                </p>
                            </section>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                                <section>
                                    <h3 className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400 mb-4">Location</h3>
                                    <div className="flex items-center gap-4 text-slate-700 dark:text-slate-200">
                                        <div className="p-3 bg-blue-600/10 rounded-2xl">
                                            <MapPin className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <span className="font-bold">{request.address}</span>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400 mb-4">Preferred date</h3>
                                    <div className="flex items-center gap-4 text-slate-700 dark:text-slate-200">
                                        <div className="p-3 bg-purple-600/10 rounded-2xl">
                                            <Calendar className="w-6 h-6 text-purple-600" />
                                        </div>
                                        <span className="font-bold">
                                            {request.preferred_date
                                                ? new Date(request.preferred_date).toLocaleString()
                                                : 'Not scheduled'}
                                        </span>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>

                    {/* No separate AI summary block: title/description are already rewritten if AI is enabled. */}
                </div>

                {/* Sidebar Column */}
                <div className="lg:col-span-1 space-y-8">

                    {/* Status Timeline */}
                    {job && (
                        <div className="glass-card p-8 rounded-[2.5rem] bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/5 shadow-xl">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-8">Service Status</h2>

                            <div className="space-y-6 relative">
                                <div className="absolute left-6 top-2 bottom-2 w-0.5 bg-slate-100 dark:bg-slate-800"></div>

                                {[
                                    { status: 'pending', label: 'Pro Assigned', icon: Clock },
                                    { status: 'accepted', label: 'Pro Accepted', icon: CheckCircle },
                                    { status: 'started', label: 'Work Started', icon: PlayCircle },
                                    { status: 'completed', label: 'Job Finished', icon: Package }
                                ].map((step, idx) => {
                                    const isCompleted = ['pending', 'accepted', 'started', 'completed'].indexOf(job.status) >= idx;
                                    const isActive = step.status === job.status;

                                    return (
                                        <div key={step.status} className={`relative flex items-center gap-6 ${isCompleted ? 'opacity-100' : 'opacity-30'}`}>
                                            <div className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center z-10 bg-white dark:bg-slate-900 transition-all
                                                ${isActive ? 'border-blue-600 text-blue-600 shadow-lg shadow-blue-600/20' :
                                                    isCompleted ? 'border-emerald-500 text-emerald-500' : 'border-slate-200 dark:border-slate-800 text-slate-300'}`}>
                                                {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <step.icon className="w-5 h-5" />}
                                            </div>

                                            <div className="flex-1">
                                                <p className={`font-black uppercase tracking-widest text-xs transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                                                    {step.label}
                                                </p>
                                                {step.time && isCompleted && (
                                                    <p className="text-[10px] text-slate-500 font-medium mt-1">
                                                        {new Date(step.time).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Provider Info */}
                            {job.provider && (
                                <div className="mt-10 pt-8 border-t border-slate-100 dark:border-white/5">
                                    <div className="flex items-center justify-between p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/50">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center font-black text-white text-xl shadow-lg shadow-blue-600/20 shrink-0">
                                                {job.provider.user?.first_name?.[0] || 'P'}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                                    {job.provider.user?.first_name} {job.provider.user?.last_name}
                                                </p>
                                                <div className="flex items-center gap-1.5 text-amber-500 mt-1">
                                                    <Star className="w-4 h-4 fill-current" />
                                                    <span className="text-sm font-black">{job.provider.rating || '4.9'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setActiveChat(true)}
                                            className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                                            title="Message Provider"
                                        >
                                            <MessageSquare className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Sidebar Actions */}
                            {job.status === 'completed' && (
                                <div className="mt-8 space-y-3">
                                    <button
                                        onClick={() => navigate(request.invoice_id ? `/dashboard/invoices/${request.invoice_id}` : '/dashboard/invoices')}
                                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-slate-900/10"
                                    >
                                        <Receipt className="w-4 h-4" /> View Invoice
                                    </button>

                                    {!hasReview ? (
                                        <button
                                            onClick={() => navigate(`/dashboard/reviews/create/${job.id}`)}
                                            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/10"
                                        >
                                            <Star className="w-4 h-4" /> Leave Review
                                        </button>
                                    ) : (
                                        <div className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl font-black text-xs uppercase tracking-widest border border-emerald-500/20">
                                            <Star className="w-4 h-4 fill-current" /> Review Done
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Financial Summary */}
                    <div className="glass-card p-8 rounded-[2.5rem] bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/5 shadow-xl">
                        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-6">Quote & Budget</h2>

                        <div className="space-y-6">
                            {request.budget && (
                                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-500">
                                            <DollarSign className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Max Budget</span>
                                    </div>
                                    <span className="text-xl font-black text-slate-900 dark:text-white">
                                        {formatMoney(request.budget, settings)}
                                    </span>
                                </div>
                            )}

                            {job && (
                                <div className={`p-6 rounded-[2rem] shadow-xl ${job.status === 'completed' ? 'bg-emerald-600 text-white shadow-emerald-500/20' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-slate-900/10'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                                            {user?.role === 'provider' ? 'Net Earnings' : 'Total Price'}
                                        </span>
                                        {job.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                                    </div>
                                    <p className="text-4xl font-black tracking-tight">
                                        {formatMoney(user?.role === 'provider' ? (job.provider_earnings || 0) : (request.budget || 0), settings)}
                                    </p>
                                    <p className="text-[10px] font-bold uppercase tracking-widest mt-2 opacity-80">
                                        {job.status === 'completed' ? 'Payment Released' : 'Payment Pre-Authorized'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Related Requests (Multi-issue Split) */}
                    {linkedRequests.length > 0 && (
                        <div className="glass-card p-8 rounded-[2.5rem] bg-slate-900 dark:bg-white text-white dark:text-slate-900 border border-slate-200 dark:border-white/5 shadow-xl">
                            <div className="flex items-center gap-3 mb-6">
                                <Package className="w-5 h-5 text-blue-500" />
                                <h2 className="text-xl font-black uppercase tracking-tight">Related Issues</h2>
                            </div>
                            <div className="space-y-3">
                                {linkedRequests.map(req => (
                                    <button
                                        key={req.id}
                                        onClick={() => navigate(`/dashboard/requests/${req.id}`)}
                                        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/10 dark:bg-slate-100 hover:bg-white/20 dark:hover:bg-slate-200 transition-all text-left"
                                    >
                                        <div className="min-w-0 pr-4">
                                            <p className="text-xs font-black truncate opacity-90">{req.title}</p>
                                            <p className="text-[10px] uppercase font-bold opacity-50 tracking-widest mt-1">{req.status}</p>
                                        </div>
                                        <ArrowLeft className="w-4 h-4 rotate-180 shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Chat Interface */}
            {activeChat && job && (
                <ChatInterface
                    jobId={job.id}
                    otherUser={{ 
                        username: job.provider?.user?.first_name || job.provider?.user?.username || 'Provider' 
                    }}
                    isOpen={activeChat}
                    onClose={() => setActiveChat(false)}
                />
            )}
        </motion.div>
    );
};

export default RequestDetail;
