import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { MapPin, Calendar, Clock, Phone, MessageSquare, CheckCircle, Play, AlertCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const ProviderJobDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const { success, error: showError } = useToast();

    useEffect(() => {
        fetchJobDetails();
    }, [id]);

    const fetchJobDetails = async () => {
        try {
            const response = await api.get(`jobs/${id}/`);
            setJob(response.data);
        } catch (error) {
            console.error('Error fetching job details:', error);
            showError('Failed to load job details');
            // Mock data fallback
            setJob({
                id: id,
                title: 'Emergency Plumbing Fix',
                status: 'accepted',
                customer: {
                    name: 'Alice Johnson',
                    address: '45 Park Avenue, NY',
                    phone: '+1 (555) 123-4567'
                },
                schedule: '2023-10-28T14:00:00',
                description: 'Leaking pipe under the kitchen sink. Urgent assistance needed.',
                price: 150.00
            });
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (action) => {
        try {
            await api.post(`jobs/${id}/${action}/`);
            fetchJobDetails(); // Refresh to get updated status and fields
            success(`Job ${action}ed successfully`);
        } catch (error) {
            console.error(error);
            showError(`Failed to ${action} job`);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading job details...</div>;
    if (!job) return <div className="p-8 text-center">Job not found</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <button
                onClick={() => navigate(-1)}
                className="text-slate-500 hover:text-blue-500 mb-2 flex items-center gap-1 text-sm font-medium"
            >
                ← Back to Dashboard
            </button>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Job #{job.id}</h1>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium uppercase tracking-wide
                                ${job.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    job.status === 'started' ? 'bg-purple-100 text-purple-800' :
                                        job.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                            'bg-blue-100 text-blue-800'}`}>
                                {job.status}
                            </span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400">Created on {new Date(job.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Estimated Value</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">${job.request?.budget || job.price || '0.00'}</p>
                    </div>
                </div>

                <div className="p-6 grid md:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="md:col-span-2 space-y-8">
                        <section>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">Description</h2>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                {job.description || job.request?.description}
                            </p>
                        </section>

                        <section className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-4 space-y-3">
                            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">Customer Details</h2>
                            <div className="flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                                <div>
                                    <p className="text-slate-900 dark:text-slate-100 font-medium">Service Location</p>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">{job.request?.address || 'Address not available'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Phone className="w-5 h-5 text-slate-400" />
                                <span className="text-blue-600 cursor-pointer hover:underline">{job.request?.user?.phone || 'Phone not available'}</span>
                            </div>
                        </section>
                    </div>

                    {/* Actions Sidebar */}
                    <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                            <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-4">Job Actions</h3>

                            {job.status === 'pending' && (
                                <div className="space-y-3">
                                    <button
                                        onClick={() => updateStatus('accept')}
                                        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
                                    >
                                        <CheckCircle className="w-4 h-4" /> Accept Job
                                    </button>
                                    <button
                                        onClick={() => updateStatus('cancel')}
                                        className="w-full py-3 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2 font-medium"
                                    >
                                        <AlertCircle className="w-4 h-4" /> Decline
                                    </button>
                                </div>
                            )}

                            {job.status === 'accepted' && (
                                <button
                                    onClick={() => updateStatus('start')}
                                    className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 font-medium"
                                >
                                    <Play className="w-4 h-4" /> Start Job
                                </button>
                            )}

                            {job.status === 'started' && (
                                <button
                                    onClick={() => updateStatus('complete')}
                                    className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium"
                                >
                                    <CheckCircle className="w-4 h-4" /> Complete Job
                                </button>
                            )}

                            {job.status === 'completed' && (
                                <div className="text-center p-3 text-green-600 font-medium flex flex-col items-center gap-2">
                                    <CheckCircle className="w-8 h-8" />
                                    Job Completed
                                </div>
                            )}

                            {job.status === 'cancelled' && (
                                <div className="text-center p-3 text-red-600 font-medium flex flex-col items-center gap-2">
                                    <AlertCircle className="w-8 h-8" />
                                    Job Cancelled
                                </div>
                            )}

                            <button className="w-full mt-3 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 font-medium">
                                <MessageSquare className="w-4 h-4" /> Message Customer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProviderJobDetails;
