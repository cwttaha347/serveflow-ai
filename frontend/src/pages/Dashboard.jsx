import { useState, useEffect } from 'react';
import api from '../api';
import {
    Users, Briefcase, DollarSign, TrendingUp, Clock,
    CheckCircle, ArrowRight, Zap, Target
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const Dashboard = () => {
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState('user');
    const navigate = useNavigate();

    useEffect(() => {
        verifyRoleAndRedirect();
    }, [navigate]);

    const verifyRoleAndRedirect = async () => {
        try {
            const response = await api.get('users/me/');
            const role = response.data.role;
            localStorage.setItem('userRole', role);
            setUserRole(role);

            if (role === 'admin') {
                navigate('/dashboard/admin', { replace: true });
                return;
            }
            if (role === 'provider') {
                navigate('/dashboard/provider', { replace: true });
                return;
            }
            fetchDashboardData();
        } catch (error) {
            console.error('Role verification failed:', error);
        }
    };

    const fetchDashboardData = async () => {
        try {
            const [requestsRes] = await Promise.all([
                api.get('requests/my_requests/')
            ]);

            setStats({
                total_requests: requestsRes.data.length,
                pending: requestsRes.data.filter(r => r.status === 'pending').length,
                completed: requestsRes.data.filter(r => r.status === 'completed').length,
            });
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 font-black uppercase tracking-widest animate-pulse">Syncing Data...</p>
            </div>
        );
    }

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

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-10"
        >
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">System Status</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Monitoring your service ecosystem in real-time</p>
                </div>
                <button
                    onClick={() => navigate('/create-request')}
                    className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-[2rem] font-bold shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
                >
                    <Zap className="w-5 h-5 fill-white" />
                    New Request
                </button>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Total Deployments', value: stats.total_requests, icon: Target, color: 'blue' },
                    { label: 'Active Protocols', value: stats.pending, icon: Clock, color: 'amber' },
                    { label: 'Validated Results', value: stats.completed, icon: CheckCircle, color: 'emerald' }
                ].map((s, i) => (
                    <motion.div
                        key={i}
                        variants={item}
                        className="glass-card p-8 rounded-[2.5rem] group relative overflow-hidden"
                    >
                        <div className={`absolute top-0 right-0 w-32 h-32 bg-${s.color}-500/10 rounded-full blur-3xl group-hover:bg-${s.color}-500/20 transition-colors`} />
                        <div className="flex items-start justify-between relative z-10">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2">{s.label}</p>
                                <p className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">{s.value || 0}</p>
                            </div>
                            <div className={`p-4 bg-${s.color}-50 dark:bg-${s.color}-900/20 rounded-2xl`}>
                                <s.icon className={`w-8 h-8 text-${s.color}-600 dark:text-${s.color}-400`} />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Main Layout Grid */}
            <div className="grid lg:grid-cols-2 gap-8">
                {/* Visual Analysis / Quick Actions */}
                <motion.div variants={item} className="space-y-6">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] pl-4">Operation Center</h2>
                    <div className="grid gap-4">
                        <button
                            onClick={() => navigate('/create-request')}
                            className="p-8 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-blue-700 text-white text-left shadow-2xl shadow-blue-500/20 group relative overflow-hidden active:scale-[0.98] transition-all"
                        >
                            <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                                    <Zap className="w-8 h-8 fill-white" />
                                </div>
                                <ArrowRight className="w-8 h-8 text-white/50 group-hover:translate-x-2 transition-transform" />
                            </div>
                            <h3 className="text-2xl font-black mb-1 relative z-10">Initialize New Request</h3>
                            <p className="text-blue-100 font-medium relative z-10">Launch AI-powered service diagnostics</p>
                        </button>

                        <button
                            onClick={() => navigate('/dashboard/my-requests')}
                            className="p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left group hover:shadow-2xl transition-all"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl">
                                    <Briefcase className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                                </div>
                                <ArrowRight className="w-8 h-8 text-slate-200 dark:text-slate-700 group-hover:translate-x-2 transition-transform" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Deployment History</h3>
                            <p className="text-slate-500 font-medium">Monitor active protocols and logs</p>
                        </button>
                    </div>
                </motion.div>

                {/* System Activity Visualizer (Mock) */}
                <motion.div variants={item} className="glass-card p-10 rounded-[3rem] flex flex-col justify-center text-center">
                    <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <TrendingUp className="w-12 h-12 text-blue-600 animate-pulse" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Live Efficiency Metrics</h3>
                    <p className="text-slate-500 font-medium mb-8">System performance is currently optimal with 99.9% uptime across all active nodes.</p>
                    <div className="flex gap-2 justify-center">
                        {[40, 70, 45, 90, 65, 80].map((h, i) => (
                            <div key={i} className="w-3 bg-blue-600/20 dark:bg-blue-600/40 rounded-full h-20 relative overflow-hidden">
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${h}%` }}
                                    transition={{ delay: 0.5 + i * 0.1, duration: 1 }}
                                    className="absolute bottom-0 left-0 right-0 bg-blue-600 rounded-full"
                                />
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default Dashboard;
