import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { DollarSign, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const MyBids = () => {
    const navigate = useNavigate();
    const { success, error } = useToast();
    const [bids, setBids] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchMyBids();
    }, []);

    const fetchMyBids = async () => {
        try {
            const response = await api.get('bids/');
            setBids(response.data);
        } catch (err) {
            console.error('Error fetching bids:', err);
            error('Failed to load bids');
        } finally {
            setLoading(false);
        }
    };

    const handleWithdraw = async (bidId) => {
        if (!confirm('Are you sure you want to withdraw this bid?')) return;

        try {
            await api.delete(`bids/${bidId}/withdraw/`);
            success('Bid withdrawn successfully');
            fetchMyBids();
        } catch (err) {
            console.error('Error withdrawing bid:', err);
            error('Failed to withdraw bid');
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
            accepted: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
            rejected: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
            withdrawn: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
        };
        return badges[status] || badges.pending;
    };

    const filteredBids = filter === 'all' ? bids : bids.filter(b => b.status === filter);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Bids</h1>
                <p className="text-slate-500 dark:text-slate-400">Track all your submitted bids</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
                {['all', 'pending', 'accepted', 'rejected'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-lg capitalize ${filter === f
                                ? 'bg-blue-600 text-white'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                    >
                        {f} ({f === 'all' ? bids.length : bids.filter(b => b.status === f).length})
                    </button>
                ))}
            </div>

            {/* Bids List */}
            {loading ? (
                <div className="text-center py-12">Loading bids...</div>
            ) : filteredBids.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-slate-500 mb-4">No bids found</p>
                    <button
                        onClick={() => navigate('/dashboard/browse-requests')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Browse Open Requests
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredBids.map(bid => (
                        <div key={bid.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                        {bid.request_title}
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Bid submitted {new Date(bid.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(bid.status)}`}>
                                    {bid.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Bid Amount</p>
                                    <div className="flex items-center gap-1">
                                        <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                                        <span className="font-bold text-slate-900 dark:text-slate-100">
                                            ${bid.amount}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Duration</p>
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">
                                            {bid.estimated_duration}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-4">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Proposal</p>
                                <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                                    {bid.proposal}
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigate(`/dashboard/requests/${bid.request}`)}
                                    className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
                                >
                                    View Request
                                </button>
                                {bid.status === 'pending' && (
                                    <button
                                        onClick={() => handleWithdraw(bid.id)}
                                        className="px-4 py-2 border border-red-200 text-red-600 dark:border-red-800 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm flex items-center gap-1"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Withdraw
                                    </button>
                                )}
                                {bid.status === 'accepted' && (
                                    <button
                                        onClick={() => navigate('/dashboard/provider/jobs')}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-1"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        View Job
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MyBids;
