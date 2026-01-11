import { useState, useEffect } from 'react';
import api from '../api';
import { Briefcase, Calendar, MapPin, DollarSign, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ProviderJobs = () => {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
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
        fetchJobs();
    }, []);

    const filteredJobs = filter === 'all'
        ? jobs
        : jobs.filter(job => job.status === filter);

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'pending': return <Clock className="w-5 h-5 text-yellow-500" />;
            case 'cancelled': return <XCircle className="w-5 h-5 text-red-500" />;
            default: return <Briefcase className="w-5 h-5 text-blue-500" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Jobs</h1>
                <div className="flex gap-2">
                    {['all', 'pending', 'started', 'completed'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg capitalize ${filter === f
                                    ? 'bg-primary text-white'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">Loading jobs...</div>
            ) : filteredJobs.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <p className="text-slate-500">No jobs found.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredJobs.map(job => (
                        <div
                            key={job.id}
                            onClick={() => navigate(`/dashboard/provider/jobs/${job.id}`)}
                            className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer flex justify-between items-center"
                        >
                            <div className="flex gap-4 items-start">
                                <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
                                    {getStatusIcon(job.status)}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                                        {job.request?.title || 'Untitled Job'}
                                    </h3>
                                    <div className="flex gap-4 text-slate-500 text-sm mt-1">
                                        <span className="flex items-center gap-1">
                                            <MapPin className="w-4 h-4" />
                                            {job.request?.address}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-4 h-4" />
                                            {new Date(job.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium capitalize mb-2 bg-slate-100 text-slate-700`}>
                                    {job.status}
                                </span>
                                <div className="flex items-center justify-end gap-1 font-semibold text-slate-900 dark:text-slate-100">
                                    <DollarSign className="w-4 h-4" />
                                    {job.provider_earnings || 0}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProviderJobs;
