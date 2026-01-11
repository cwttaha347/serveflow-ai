import { useState, useEffect } from 'react';
import api from '../api';
import {
    Users, Briefcase, DollarSign, AlertTriangle, CheckCircle2,
    XCircle, Plus, Shield, Activity, Cpu, Server, Globe,
    ArrowRight, Search, Filter
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { motion } from 'framer-motion';

const AdminPanel = () => {
    const { settings } = useSettings();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ users: 0, providers: 0, jobs: 0, revenue: 0 });
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const { success, error: showError } = useToast();

    useEffect(() => {
        fetchAdminData();
    }, []);

    const fetchAdminData = async () => {
        try {
            const [usersRes, providersRes, jobsRes] = await Promise.all([
                api.get('users/'),
                api.get('providers/'),
                api.get('jobs/')
            ]);

            const jobs = jobsRes.data;
            const totalRevenue = jobs.reduce((acc, job) => {
                if (job.status === 'completed' && job.request?.budget && job.provider_earnings) {
                    return acc + (Number(job.request.budget) - Number(job.provider_earnings));
                }
                return acc;
            }, 0);

            setStats({
                users: usersRes.data.length,
                providers: providersRes.data.length,
                jobs: jobs.length,
                revenue: totalRevenue
            });

            setProviders(providersRes.data);
        } catch (error) {
            console.error('Error fetching admin data:', error);
            showError('Failed to load admin data');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (providerId, status) => {
        try {
            const isVerified = status === 'verified';
            await api.patch(`providers/${providerId}/`, {
                verification_status: status,
                verified: isVerified,
                verification_date: isVerified ? new Date().toISOString() : null
            });
            success(`Protocol updated: Provider ${status}`);
            fetchAdminData();
        } catch (error) {
            showError('Failed to update provider status');
        }
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
                <p className="text-slate-500 font-black uppercase tracking-widest animate-pulse">Accessing Core Databases...</p>
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
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Command Center</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Global infrastructure management and protocol oversight</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/dashboard/admin/settings')}
                        className="px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Server className="w-4 h-4 text-blue-500" />
                        System Config
                    </button>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Client Base', value: stats.users, icon: Users, color: 'blue' },
                    { label: 'Service Force', value: stats.providers, icon: Shield, color: 'emerald' },
                    { label: 'Active Jobs', value: stats.jobs, icon: Activity, color: 'purple' },
                    { label: 'Net Revenue', value: `${settings.currency_symbol}${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'amber' }
                ].map((s, i) => (
                    <motion.div
                        key={i}
                        variants={item}
                        className="glass-card p-6 rounded-[2rem] group relative overflow-hidden"
                    >
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-${s.color}-500/5 rounded-full blur-2xl group-hover:bg-${s.color}-500/10 transition-colors`} />
                        <div className="flex items-start justify-between relative z-10">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{s.value}</p>
                            </div>
                            <div className={`p-3 bg-${s.color}-50 dark:bg-${s.color}-900/10 rounded-xl`}>
                                <s.icon className={`w-6 h-6 text-${s.color}-600 dark:text-${s.color}-400`} />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Middle Section: Queue and Health */}
            <div className="grid lg:grid-cols-3 gap-8">
                {/* Verification Queue */}
                <motion.div variants={item} className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between pl-4">
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Verification Queue</h2>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                            {providers.filter(p => p.verification_status !== 'verified').length} PENDING BOTS
                        </span>
                    </div>

                    <div className="glass-card rounded-[2.5rem] overflow-hidden">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {providers.filter(p => p.verification_status !== 'verified').length === 0 ? (
                                <div className="p-20 text-center">
                                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800">
                                        <CheckCircle2 className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <p className="text-slate-500 font-bold">All entities successfully verified.</p>
                                </div>
                            ) : (
                                providers.filter(p => p.verification_status !== 'verified').map((provider) => (
                                    <div key={provider.id} className="p-6 flex items-center justify-between group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-900 dark:text-white font-black">
                                                ID
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900 dark:text-white">Provider Unit #{provider.id}</h3>
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Efficiency: {provider.rating}/5.0</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleUpdateStatus(provider.id, 'verified')}
                                                className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all"
                                            >
                                                Authorize
                                            </button>
                                            <button
                                                onClick={() => navigate('/dashboard/admin/providers')}
                                                className="px-6 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                                            >
                                                Audit
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <button
                            onClick={() => navigate('/dashboard/admin/providers')}
                            className="w-full p-4 text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all border-t border-slate-100 dark:border-slate-800"
                        >
                            View Entire Force Archive
                        </button>
                    </div>
                </motion.div>

                {/* System Health */}
                <motion.div variants={item} className="space-y-6">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] pl-4">System Health</h2>
                    <div className="glass-card p-8 rounded-[2.5rem] space-y-8">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <span className="flex items-center gap-3 text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                    <Globe className="w-5 h-5 text-blue-500" />
                                    Global API
                                </span>
                                <span className="text-[10px] font-black text-emerald-500 flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                    NOMINAL
                                </span>
                            </div>
                            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: '98%' }}
                                    className="h-full bg-blue-500 rounded-full"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <span className="flex items-center gap-3 text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                    <Cpu className="w-5 h-5 text-purple-500" />
                                    AI Diagnostics
                                </span>
                                <span className="text-[10px] font-black text-emerald-500 flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                    ACTIVE
                                </span>
                            </div>
                            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: '85%' }}
                                    className="h-full bg-purple-500 rounded-full"
                                />
                            </div>
                        </div>

                        <div className="pt-4 grid grid-cols-2 gap-4">
                            <button
                                onClick={() => navigate('/dashboard/admin/categories')}
                                className="p-6 bg-blue-600 text-white rounded-[2rem] text-center group hover:scale-105 transition-all shadow-xl shadow-blue-500/20"
                            >
                                <Plus className="w-6 h-6 mx-auto mb-2 group-hover:rotate-90 transition-transform" />
                                <span className="text-[10px] font-black uppercase tracking-widest">New Spec</span>
                            </button>
                            <button
                                onClick={() => navigate('/dashboard/admin/requests')}
                                className="p-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[2rem] text-center group hover:scale-105 transition-all shadow-xl"
                            >
                                <Activity className="w-6 h-6 mx-auto mb-2" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Live Flow</span>
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default AdminPanel;
