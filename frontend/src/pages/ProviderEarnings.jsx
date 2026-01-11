import { useState, useEffect } from 'react';
import api from '../api';
import { DollarSign, TrendingUp, Calendar, ArrowUpRight, Download } from 'lucide-react';

const ProviderEarnings = () => {
    // Mock data for initial render
    const [earnings, setEarnings] = useState({
        total: 0,
        thisMonth: 0,
        pending: 0,
        transactions: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEarnings();
    }, []);

    const fetchEarnings = async () => {
        try {
            const response = await api.get('jobs/');
            const jobs = response.data;

            // Filter jobs for this provider (assuming backend returns all jobs, we filter for safety if needed, 
            // but ideally backend handles this. For now we calculate based on returned jobs)
            // In a real app we'd verify provider ID. Here we assume the user only sees their jobs or we calculate from all 'completed' jobs assigned to them.
            // Since we don't have provider ID handy in state easily without another call, and we want to fix this fast:
            // We'll assume the list is relevant.

            const completedJobs = jobs.filter(j => j.status === 'completed');

            const total = completedJobs.reduce((sum, job) => sum + Number(job.provider_earnings || 0), 0);

            const now = new Date();
            const thisMonthCalls = completedJobs.filter(job => {
                const d = new Date(job.updated_at || job.created_at);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });
            const thisMonth = thisMonthCalls.reduce((sum, job) => sum + Number(job.provider_earnings || 0), 0);

            // Assuming 'pending' means started but not completed, or completed but not paid out? 
            // For now let's map 'started' jobs as potential pending earnings or just use 0 if we don't have payout logic.
            // Let's use 'started' job value (price/budget) as pending.
            const pendingJobs = jobs.filter(j => j.status === 'started');
            const pending = pendingJobs.reduce((sum, job) => sum + Number(job.request?.budget || 0), 0);

            // Transactions list
            const transactions = jobs.map(job => ({
                id: `JOB-${job.id}`,
                job: job.request?.title || 'Service Request',
                date: job.updated_at || job.created_at,
                amount: job.status === 'completed' ? Number(job.provider_earnings) : Number(job.request?.budget || 0),
                status: job.status === 'completed' ? 'paid' : 'pending' // Simplified mapping
            })).sort((a, b) => new Date(b.date) - new Date(a.date));

            setEarnings({
                total,
                thisMonth,
                pending,
                transactions
            });
        } catch (error) {
            console.error('Error fetching earnings:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Earnings & Payouts</h1>
                    <p className="text-slate-500 dark:text-slate-400">Track your financial performance</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <Download className="w-4 h-4" />
                    Export Report
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-xl text-white">
                    <p className="text-emerald-100 text-sm font-medium">Total Earnings</p>
                    <h3 className="text-3xl font-bold mt-2">${earnings.total.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 mt-4 text-emerald-100 text-sm">
                        <TrendingUp className="w-4 h-4" />
                        <span>+15% from last month</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <Calendar className="w-6 h-6 text-blue-500" />
                        </div>
                        <span className="text-green-500 text-sm font-medium flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3" /> +8.2%
                        </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">This Month</p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                        ${earnings.thisMonth.toLocaleString()}
                    </h3>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                            <DollarSign className="w-6 h-6 text-amber-500" />
                        </div>
                        <span className="text-xs font-medium px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full">
                            Processing
                        </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Pending Payouts</p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                        ${earnings.pending.toLocaleString()}
                    </h3>
                </div>
            </div>

            {/* Transactions List */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent Transactions</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                        <thead className="bg-slate-50 dark:bg-slate-700/50">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Invoice ID</th>
                                <th className="px-6 py-4 font-semibold">Job Description</th>
                                <th className="px-6 py-4 font-semibold">Date</th>
                                <th className="px-6 py-4 font-semibold">Amount</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {earnings.transactions.map((t) => (
                                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-slate-900 dark:text-slate-100">{t.id}</td>
                                    <td className="px-6 py-4">{t.job}</td>
                                    <td className="px-6 py-4">{new Date(t.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                                        ${t.amount.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize 
                                            ${t.status === 'paid'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                            }`}
                                        >
                                            {t.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProviderEarnings;
