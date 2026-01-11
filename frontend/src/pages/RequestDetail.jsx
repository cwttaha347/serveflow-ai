import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import {
    MapPin,
    Calendar,
    Clock,
    DollarSign,
    User,
    AlertCircle,
    Star,
    FileText,
    CheckCircle,
    PlayCircle,
    Package
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

const RequestDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { error: showError, success: showSuccess } = useToast();

    const [request, setRequest] = useState(null);
    const [job, setJob] = useState(null);
    const [hasReview, setHasReview] = useState(false);
    const [loading, setLoading] = useState(true);

    // ---------------- FETCH DATA ----------------
    const fetchRequestDetails = async () => {
        try {
            const res = await api.get(`/requests/${id}`);
            setRequest(res.data.request || null);
            setJob(res.data.job || null);
            setHasReview(res.data.hasReview || false);
        } catch (err) {
            showError("Failed to load request details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequestDetails();
    }, [id]);

    // ---------------- LOADING / MISSING ----------------
    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (!request) return <div className="p-8 text-center">Request not found</div>;

    // ---------------- HELPERS ----------------
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
            case 'pending': return <Clock className="w-5 h-5" />;
            case 'accepted': return <CheckCircle className="w-5 h-5" />;
            case 'started': return <PlayCircle className="w-5 h-5" />;
            case 'completed': return <Package className="w-5 h-5" />;
            default: return <Clock className="w-5 h-5" />;
        }
    };

    // ---------------- UI ----------------
    return (
        <div className="space-y-6">
            <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline mb-4">
                &larr; Back to Requests
            </button>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">

                {/* HEADER */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{request.title}</h1>
                        <p className="text-slate-500 mt-1">Request ID: #{request.id}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {job && ['accepted', 'started'].includes(job.status) && (
                            <button
                                onClick={() => navigate(`/dashboard/tracking/${job.id}`)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                <MapPin className="w-4 h-4" /> Track Live
                            </button>
                        )}
                    </div>
                </div>

                {/* JOB STATUS TIMELINE */}
                {job && (
                    <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Job Status</h3>

                        <div className="space-y-4 relative">
                            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-700"></div>

                            {[
                                { status: 'pending', label: 'Job Assigned', time: job.created_at },
                                { status: 'accepted', label: 'Provider Accepted', time: job.created_at },
                                { status: 'started', label: 'Work Started', time: job.start_time },
                                { status: 'completed', label: 'Job Completed', time: job.end_time }
                            ].map((step, idx) => {
                                const isCompleted =
                                    ['pending', 'accepted', 'started', 'completed'].indexOf(job.status) >= idx;
                                const isActive = step.status === job.status;

                                return (
                                    <div key={step.status} className={`relative flex items-start gap-4 ${isCompleted ? 'opacity-100' : 'opacity-40'}`}>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 bg-white dark:bg-slate-800 
                                            ${isActive ? 'border-blue-500 text-blue-500 animate-pulse' :
                                                isCompleted ? 'border-green-500 text-green-500' :
                                                    'border-slate-300 text-slate-300'}`}>
                                            {isCompleted
                                                ? <CheckCircle className="w-3 h-3" />
                                                : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                                        </div>

                                        <div className="flex-1">
                                            <p className={`font-medium ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                {step.label}
                                            </p>
                                            {step.time && isCompleted && (
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {new Date(step.time).toLocaleString()}
                                                </p>
                                            )}
                                        </div>

                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                                            {isActive && job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* PROVIDER INFO */}
                        {job.provider && (
                            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Assigned Provider</h4>

                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center font-bold text-blue-600">
                                        {job.provider.user?.first_name?.[0] || 'P'}
                                    </div>

                                    <div>
                                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                                            {job.provider.user?.first_name} {job.provider.user?.last_name}
                                        </p>

                                        <div className="flex items-center gap-1 text-yellow-500">
                                            <Star className="w-4 h-4 fill-current" />
                                            <span className="text-sm font-medium">{job.provider.rating || '5.0'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ACTION BUTTONS WHEN COMPLETED */}
                        {job.status === 'completed' && (
                            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex gap-3">

                                    <button
                                        onClick={() => navigate(request.invoice_id ? `/dashboard/invoices/${request.invoice_id}` : '/dashboard/invoices')}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        <FileText className="w-4 h-4" /> View Invoice
                                    </button>

                                    {!hasReview ? (
                                        <button
                                            onClick={() => navigate(`/dashboard/reviews/create/${job.id}`)}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                        >
                                            <Star className="w-4 h-4" /> Leave Review
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg">
                                            <Star className="w-4 h-4 fill-current" /> Review Submitted
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TWO-COLUMN DETAILS */}
                <div className="grid md:grid-cols-2 gap-8">

                    <div className="space-y-4">
                        <section>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Description</h3>
                            <p className="text-slate-600 dark:text-slate-300">{request.description}</p>
                        </section>

                        <section>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Location</h3>
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <MapPin className="w-5 h-5" />
                                {request.address}
                            </div>
                        </section>

                        <section>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Timing</h3>
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <Calendar className="w-5 h-5" />
                                {new Date(request.preferred_date).toLocaleString()}
                            </div>
                        </section>
                    </div>

                    <div className="space-y-4">

                        {request.budget && (
                            <section>
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Budget</h3>
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                    <DollarSign className="w-5 h-5" />
                                    ${request.budget}
                                </div>
                            </section>
                        )}

                        {job && job.provider_earnings > 0 && (
                            <section>
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Job Cost</h3>
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                        ${Number(job.provider_earnings).toFixed(2)}
                                    </p>
                                    <p className="text-sm text-green-600 dark:text-green-500 mt-1">Final cost</p>
                                </div>
                            </section>
                        )}

                        {request.ai_summary && (
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> AI Analysis
                                </h3>
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    {typeof request.ai_summary === 'string'
                                        ? request.ai_summary
                                        : JSON.stringify(request.ai_summary)}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default RequestDetail;
