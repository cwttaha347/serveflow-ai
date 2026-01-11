import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { MapPin, DollarSign, Calendar, Search, Filter } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const BrowseRequests = () => {
    const navigate = useNavigate();
    const { success, error } = useToast();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [categories, setCategories] = useState([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchOpenRequests();
        fetchCategories();
    }, []);

    const fetchOpenRequests = async () => {
        try {
            const response = await api.get('requests/?status=open_for_bids');
            setRequests(response.data);
        } catch (err) {
            console.error('Error fetching requests:', err);
            error('Failed to load requests');
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await api.get('categories/');
            setCategories(response.data);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };

    const filteredRequests = requests.filter(req => {
        const matchesCategory = categoryFilter === 'all' || req.category?.id === parseInt(categoryFilter);
        const matchesSearch = req.title?.toLowerCase().includes(search.toLowerCase()) ||
            req.description?.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Browse Open Requests</h1>
                <p className="text-slate-500 dark:text-slate-400">Submit bids on customer requests</p>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search requests..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="text-slate-400 w-5 h-5" />
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Categories</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Requests Grid */}
            {loading ? (
                <div className="text-center py-12">Loading requests...</div>
            ) : filteredRequests.length === 0 ? (
                <div className="text-center py-12 text-slate-500">No open requests found</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRequests.map(request => (
                        <div key={request.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="p-6 space-y-4">
                                <div className="flex items-start justify-between">
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                        {request.title}
                                    </h3>
                                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 text-xs font-medium rounded-full">
                                        {request.category?.name || 'Other'}
                                    </span>
                                </div>

                                <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-2">
                                    {request.description}
                                </p>

                                <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                                    <div className="flex items-center gap-1">
                                        <MapPin className="w-4 h-4" />
                                        <span className="line-clamp-1">{request.address}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                                        <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                            ${request.budget ? request.budget.toFixed(2) : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                        <Calendar className="w-4 h-4" />
                                        {new Date(request.created_at).toLocaleDateString()}
                                    </div>
                                </div>

                                <button
                                    onClick={() => navigate(`/dashboard/bids/submit/${request.id}`)}
                                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                >
                                    Submit Bid
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BrowseRequests;
