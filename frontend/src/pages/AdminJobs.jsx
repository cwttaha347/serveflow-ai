import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Briefcase, Eye, CheckCircle, Clock, XCircle, PlayCircle } from 'lucide-react';

const AdminJobs = () => {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        try {
            const response = await api.get('jobs/');
            setJobs(response.data);
        } catch (error) {
            console.error('Error fetching jobs:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
            accepted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
            started: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
            completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
            cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'pending': return <Clock className="w-4 h-4" />;
            case 'accepted': return <CheckCircle className="w-4 h-4" />;
            case 'started': return <PlayCircle className="w-4 h-4" />;
            case 'completed': return <CheckCircle className="w-4 h-4" />;
            case 'cancelled': return <XCircle className="w-4 h-4" />;
            default: return <Briefcase className="w-4 h-4" />;
        }
    };

    const filteredJobs = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Jobs Management</h1>
                    <p className="text-slate-500 dark:text-slate-400">Monitor and manage all jobs</p>
                </div>
                <div className="flex gap-2">
                    {['all', 'pending', 'accepted', 'started', 'completed', 'cancelled'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg capitalize ${filter === f
                                ? 'bg-blue-600 text-white'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {['pending', 'accepted', 'started', 'completed', 'cancelled'].map(status => {
                    const count = jobs.filter(j => j.status === status).length;
                    return (
                        <div key={status} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{status}</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{count}</p>
                                </div>
                                <div className={`p-2 rounded-lg ${getStatusColor(status)}`}>
                                    {getStatusIcon(status)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Jobs Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">Loading...</div>
                ) : filteredJobs.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">No jobs found</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-sm font-medium">
                                <tr>
                                    <th className="px-6 py-4">Job ID</th>
                                    <th className="px-6 py-4">Request</th>
                                    <th className="px-6 py-4">Customer</th>
                                    <th className="px-6 py-4">Provider</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Budget</th>
                                    <th className="px-6 py-4">Created</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {filteredJobs.map((job) => (
                                    <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                                            #{job.id}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="max-w-xs truncate text-slate-600 dark:text-slate-300">
                                                {job.request?.title || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            {job.request?.user?.username || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            {job.provider?.user?.username || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                                                {job.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                                            ${Number(job.request?.budget || 0).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            {new Date(job.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => navigate(`/dashboard/requests/${job.request.id}`)}
                                                className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center justify-end gap-1 ml-auto"
                                            >
                                                <Eye className="w-4 h-4" /> View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminJobs;
