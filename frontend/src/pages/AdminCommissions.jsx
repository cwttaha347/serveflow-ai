import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { DollarSign, TrendingDown, TrendingUp, Eye } from 'lucide-react';

const AdminCommissions = () => {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalCommission: 0,
        totalProviderEarnings: 0,
        completedJobs: 0
    });

    useEffect(() => {
        fetchCommissionData();
    }, []);

    const fetchCommissionData = async () => {
        try {
            const response = await api.get('jobs/');
            const completedJobs = response.data.filter(j => j.status === 'completed');

            let totalRevenue = 0;
            let totalCommission = 0;
            let totalProviderEarnings = 0;

            completedJobs.forEach(job => {
                const budget = Number(job.request?.budget || 0);
                const earnings = Number(job.provider_earnings || 0);
                const commission = budget - earnings;

                totalRevenue += budget;
                totalCommission += commission;
                totalProviderEarnings += earnings;
            });

            setStats({
                totalRevenue,
                totalCommission,
                totalProviderEarnings,
                completedJobs: completedJobs.length
            });

            setJobs(completedJobs);
        } catch (error) {
            console.error('Error fetching commission data:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Commission Dashboard</h1>
                <p className="text-slate-500 dark:text-slate-400">Track platform earnings and provider payouts</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl text-white">
                    <DollarSign className="w-8 h-8 mb-3 opacity-80" />
                    <p className="text-sm opacity-80">Total Revenue</p>
                    <p className="text-3xl font-bold mt-1">${stats.totalRevenue.toFixed(2)}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl text-white">
                    <TrendingUp className="w-8 h-8 mb-3 opacity-80" />
                    <p className="text-sm opacity-80">Platform Commission</p>
                    <p className="text-3xl font-bold mt-1">${stats.totalCommission.toFixed(2)}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl text-white">
                    <TrendingDown className="w-8 h-8 mb-3 opacity-80" />
                    <p className="text-sm opacity-80">Provider Earnings</p>
                    <p className="text-3xl font-bold mt-1">${stats.totalProviderEarnings.toFixed(2)}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 rounded-xl text-white">
                    <DollarSign className="w-8 h-8 mb-3 opacity-80" />
                    <p className="text-sm opacity-80">Completed Jobs</p>
                    <p className="text-3xl font-bold mt-1">{stats.completedJobs}</p>
                </div>
            </div>

            {/* Commission Breakdown Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Commission Breakdown</h2>
                </div>

                {loading ? (
                    <div className="p-8 text-center">Loading...</div>
                ) : jobs.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">No completed jobs yet</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-sm font-medium">
                                <tr>
                                    <th className="px-6 py-4">Job ID</th>
                                    <th className="px-6 py-4">Customer</th>
                                    <th className="px-6 py-4">Provider</th>
                                    <th className="px-6 py-4">Total Amount</th>
                                    <th className="px-6 py-4">Provider Earnings</th>
                                    <th className="px-6 py-4">Commission</th>
                                    <th className="px-6 py-4">Rate</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {jobs.map((job) => {
                                    const total = Number(job.request?.budget || 0);
                                    const earnings = Number(job.provider_earnings || 0);
                                    const commission = total - earnings;
                                    const commissionRate = total > 0 ? ((commission / total) * 100).toFixed(1) : 0;

                                    return (
                                        <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                                                #{job.id}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {job.request?.user?.username || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {job.provider?.user?.username || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                                                ${total.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-green-600 dark:text-green-400 font-medium">
                                                ${earnings.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-blue-600 dark:text-blue-400 font-bold">
                                                ${commission.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {commissionRate}%
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => navigate(`/dashboard/requests/${job.request.id}`)}
                                                    className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center justify-end gap-1 ml-auto"
                                                >
                                                    <Eye className="w-4 h-4" /> View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminCommissions;
