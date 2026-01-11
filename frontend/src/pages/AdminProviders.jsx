import { useState, useEffect } from 'react';
import api from '../api';
import { Search, Filter, CheckCircle2, XCircle, Star, MoreVertical } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const AdminProviders = () => {
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState('manage'); // 'manage' or 'profile'
    const { success, error: showError } = useToast();

    useEffect(() => {
        fetchProviders();
    }, []);

    const fetchProviders = async () => {
        try {
            const response = await api.get('providers/');
            setProviders(response.data);
        } catch (error) {
            console.error('Error fetching providers:', error);
            showError('Failed to load providers');
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
            success(`Status updated to ${status}`);
            setModalOpen(false);
            fetchProviders();
        } catch (error) {
            showError('Failed to update provider status');
        }
    };

    const handleRejectProvider = async (providerId) => {
        if (!window.confirm('Are you sure you want to reject/remove this provider?')) return;
        try {
            await api.delete(`providers/${providerId}/`);
            success('Provider rejected');
            fetchProviders();
        } catch (error) {
            showError('Failed to reject provider');
        }
    };

    const filteredProviders = providers.filter(p => {
        const matchesFilter = filter === 'all' ||
            (filter === 'verified' && p.verification_status === 'verified') ||
            (filter === 'pending' && p.verification_status === 'pending');
        const matchesSearch = p.user?.username?.toLowerCase().includes(search.toLowerCase()) ||
            p.user?.email?.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Provider Management</h1>
                <p className="text-slate-500 dark:text-slate-400">Verify and manage service providers</p>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search providers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="text-slate-400 w-5 h-5" />
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="px-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Providers</option>
                        <option value="verified">Verified</option>
                        <option value="pending">Pending Verification</option>
                    </select>
                </div>
            </div>

            {/* Providers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-8 text-center text-slate-500">Loading providers...</div>
                ) : filteredProviders.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-slate-500">No providers found</div>
                ) : (
                    filteredProviders.map((provider) => (
                        <div key={provider.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-lg font-bold text-slate-600 dark:text-slate-300">
                                        {provider.user?.first_name?.[0] || 'P'}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{provider.user?.first_name} {provider.user?.last_name}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">@{provider.user?.username}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase ${provider.verification_status === 'verified' ? 'bg-green-100 text-green-700' :
                                        provider.verification_status === 'rejected' ? 'bg-red-100 text-red-700' :
                                            provider.verification_status === 'under_review' ? 'bg-blue-100 text-blue-700' :
                                                'bg-amber-100 text-amber-700'
                                        }`}>
                                        {provider.verification_status}
                                    </span>
                                </div>
                            </div>

                            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
                                {provider.bio || 'No bio provided.'}
                            </p>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">Rating</span>
                                    <span className="flex items-center gap-1 font-medium text-amber-500">
                                        {provider.rating} <Star className="w-3 h-3 fill-current" />
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">Completed Jobs</span>
                                    <span className="font-medium text-slate-900 dark:text-slate-100">{provider.completed_jobs}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">Total Earnings</span>
                                    <span className="font-medium text-slate-900 dark:text-slate-100">${provider.total_earnings}</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setSelectedProvider(provider);
                                        setViewMode('manage');
                                        setModalOpen(true);
                                    }}
                                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                                >
                                    Manage
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedProvider(provider);
                                        setViewMode('profile');
                                        setModalOpen(true);
                                    }}
                                    className="flex-1 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                                >
                                    View Profile
                                </button>
                                <button
                                    onClick={() => handleRejectProvider(provider.id)}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    <XCircle className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Status Modal */}
            {modalOpen && selectedProvider && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-8 shadow-2xl scale-in">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {viewMode === 'manage' ? 'Verify Provider' : 'Provider Profile'}
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400">@{selectedProvider.user?.username}</p>
                            </div>
                            <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        {viewMode === 'manage' ? (
                            <div className="space-y-6">
                                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Provider Details</h4>
                                    <div className="space-y-1">
                                        <p className="text-slate-900 dark:text-white font-medium">Bio: {selectedProvider.bio || 'N/A'}</p>
                                        <p className="text-slate-600 dark:text-slate-300">Experience: {selectedProvider.experience_years} years</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Update Verification Status</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => handleUpdateStatus(selectedProvider.id, 'under_review')}
                                            className="py-3 px-4 border-2 border-blue-500 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors font-bold text-sm"
                                        >
                                            Mark Under Review
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStatus(selectedProvider.id, 'verified')}
                                            className="py-3 px-4 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20 font-bold text-sm"
                                        >
                                            Verify Provider
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStatus(selectedProvider.id, 'rejected')}
                                            className="py-3 px-4 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors font-bold text-sm"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStatus(selectedProvider.id, 'pending')}
                                            className="py-3 px-4 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition-colors font-bold text-sm"
                                        >
                                            Reset to Pending
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-700">
                                    <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-blue-500/20">
                                        {selectedProvider.user?.first_name?.[0] || 'P'}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                            {selectedProvider.user?.first_name} {selectedProvider.user?.last_name}
                                        </h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="flex items-center gap-1 text-amber-500 font-bold">
                                                <Star className="w-4 h-4 fill-current" /> {selectedProvider.rating}
                                            </span>
                                            <span className="text-slate-300">•</span>
                                            <span className="text-slate-500 dark:text-slate-400 text-sm">{selectedProvider.experience_years} Years Experience</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Professional Bio</h4>
                                        <div className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 italic">
                                            "{selectedProvider.bio || 'No professional biography provided yet.'}"
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Earnings</p>
                                            <p className="text-lg font-black text-slate-900 dark:text-white">${selectedProvider.total_earnings}</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Jobs Completed</p>
                                            <p className="text-lg font-black text-slate-900 dark:text-white">{selectedProvider.completed_jobs}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Contact Information</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Email Address</span>
                                                <span className="text-slate-900 dark:text-white font-medium">{selectedProvider.user?.email}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Phone Number</span>
                                                <span className="text-slate-900 dark:text-white font-medium">{selectedProvider.user?.phone || 'Not provided'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-6 py-2 text-slate-600 font-bold hover:underline"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminProviders;
