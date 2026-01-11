import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { DollarSign, Clock, FileText, ArrowLeft } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const SubmitBid = () => {
    const { requestId } = useParams();
    const navigate = useNavigate();
    const { success, error } = useToast();
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        amount: '',
        proposal: '',
        estimated_duration: ''
    });

    useEffect(() => {
        fetchRequestDetails();
    }, [requestId]);

    const fetchRequestDetails = async () => {
        try {
            const response = await api.get(`requests/${requestId}/`);
            setRequest(response.data);
            // Pre-fill with budget if available
            if (response.data.budget) {
                setFormData(prev => ({ ...prev, amount: response.data.budget }));
            }
        } catch (err) {
            console.error('Error fetching request:', err);
            error('Failed to load request details');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.amount || !formData.proposal || !formData.estimated_duration) {
            error('Please fill in all fields');
            return;
        }

        setSubmitting(true);
        try {
            await api.post('bids/', {
                request: parseInt(requestId),
                amount: parseFloat(formData.amount),
                proposal: formData.proposal,
                estimated_duration: formData.estimated_duration
            });
            success('Bid submitted successfully!');
            navigate('/dashboard/provider/bids');
        } catch (err) {
            console.error('Error submitting bid:', err);
            if (err.response?.data) {
                error(err.response.data.detail || 'Failed to submit bid');
            } else {
                error('Failed to submit bid');
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="text-center py-12">Loading...</div>;
    }

    if (!request) {
        return <div className="text-center py-12">Request not found</div>;
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
                <ArrowLeft className="w-4 h-4" />
                Back
            </button>

            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Submit Your Bid</h1>
                <p className="text-slate-500 dark:text-slate-400">Provide your best offer for this service request</p>
            </div>

            {/* Request Details Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Request Details</h2>
                <div className="space-y-3">
                    <div>
                        <span className="text-sm text-slate-500 dark:text-slate-400">Title:</span>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{request.title}</p>
                    </div>
                    <div>
                        <span className="text-sm text-slate-500 dark:text-slate-400">Description:</span>
                        <p className="text-slate-700 dark:text-slate-300">{request.description}</p>
                    </div>
                    <div>
                        <span className="text-sm text-slate-500 dark:text-slate-400">Customer Budget:</span>
                        <p className="font-bold text-green-600 dark:text-green-400">
                            ${request.budget ? request.budget.toFixed(2) : 'Not specified'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Bid Form */}
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Your Bid</h2>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Bid Amount ($)
                        </div>
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter your bid amount"
                        required
                    />
                    <p className="mt-1 text-xs text-slate-500">Enter a competitive amount to increase your chances</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Estimated Duration
                        </div>
                    </label>
                    <input
                        type="text"
                        value={formData.estimated_duration}
                        onChange={(e) => setFormData({ ...formData, estimated_duration: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 2 hours, 1 day, 3-5 days"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Proposal
                        </div>
                    </label>
                    <textarea
                        value={formData.proposal}
                        onChange={(e) => setFormData({ ...formData, proposal: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[150px]"
                        placeholder="Explain why you're the best choice for this job. Include your experience, approach, and what makes you stand out..."
                        required
                    />
                    <p className="mt-1 text-xs text-slate-500">Be specific about your qualifications and approach</p>
                </div>

                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Submitting...' : 'Submit Bid'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SubmitBid;
