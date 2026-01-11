import { useState, useEffect } from 'react';
import api from '../api';
import { Search, Filter, Download, AlertCircle, User, FileText } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const AdminAuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        action: '',
        model: '',
        user_id: '',
        from_date: '',
        to_date: '',
        user_role: ''
    });

    const { error: showError } = useToast();

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) params.append(key, value);
            });

            const res = await api.get(`audit-logs/?${params.toString()}`);
            setLogs(res.data || []);
        } catch (err) {
            showError('Failed to load audit logs');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const applyFilters = () => {
        fetchLogs();
    };

    const clearFilters = () => {
        setFilters({
            action: '',
            model: '',
            user_id: '',
            from_date: '',
            to_date: '',
            user_role: ''
        });
        setTimeout(fetchLogs, 100);
    };

    const exportLogs = () => {
        // Convert to CSV
        const headers = ['Timestamp', 'User', 'Role', 'Action', 'Model', 'Object', 'IP Address'];
        const rows = logs.map(log => [
            new Date(log.timestamp).toLocaleString(),
            log.username,
            log.user_role,
            log.action,
            log.model_name,
            log.object_repr,
            log.ip_address || 'N/A'
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const getActionBadge = (action) => {
        const colors = {
            create: 'bg-green-100 text-green-800',
            update: 'bg-blue-100 text-blue-800',
            delete: 'bg-red-100 text-red-800',
            status_change: 'bg-purple-100 text-purple-800',
            bid_action: 'bg-yellow-100 text-yellow-800',
            payment: 'bg-emerald-100 text-emerald-800',
            login: 'bg-slate-100 text-slate-800',
            logout: 'bg-slate-100 text-slate-800'
        };

        return (
            <span className={`px-2 py-1 rounded text-xs font-medium ${colors[action] || 'bg-gray-100 text-gray-800'}`}>
                {action}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Audit Logs</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Track all system changes and user activities
                    </p>
                </div>

                <button
                    onClick={exportLogs}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    disabled={logs.length === 0}
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-5 h-5 text-slate-600" />
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Filters</h3>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Action
                        </label>
                        <select
                            value={filters.action}
                            onChange={(e) => handleFilterChange('action', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        >
                            <option value="">All Actions</option>
                            <option value="create">Create</option>
                            <option value="update">Update</option>
                            <option value="delete">Delete</option>
                            <option value="status_change">Status Change</option>
                            <option value="bid_action">Bid Action</option>
                            <option value="payment">Payment</option>
                            <option value="login">Login</option>
                            <option value="logout">Logout</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Model
                        </label>
                        <input
                            type="text"
                            value={filters.model}
                            onChange={(e) => handleFilterChange('model', e.target.value)}
                            placeholder="e.g., Request, Job, Bid"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            User ID
                        </label>
                        <input
                            type="text"
                            value={filters.user_id}
                            onChange={(e) => handleFilterChange('user_id', e.target.value)}
                            placeholder="Filter by user"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:text-slate-100 dark:bg-slate-700 text-slate-900"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            From Date
                        </label>
                        <input
                            type="date"
                            value={filters.from_date}
                            onChange={(e) => handleFilterChange('from_date', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            To Date
                        </label>
                        <input
                            type="date"
                            value={filters.to_date}
                            onChange={(e) => handleFilterChange('to_date', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            User Role
                        </label>
                        <select
                            value={filters.user_role}
                            onChange={(e) => handleFilterChange('user_role', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        >
                            <option value="">All Roles</option>
                            <option value="user">Customer</option>
                            <option value="provider">Provider</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-2 mt-4">
                    <button
                        onClick={applyFilters}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Apply Filters
                    </button>
                    <button
                        onClick={clearFilters}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Loading...</div>
                ) : logs.length === 0 ? (
                    <div className="p-8 text-center">
                        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <p className="text-slate-500">No audit logs found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-900">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Timestamp</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">User</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Action</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Model</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Object</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">IP Address</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-slate-400" />
                                                <div>
                                                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                        {log.username}
                                                    </div>
                                                    <div className="text-xs text-slate-500">{log.user_role}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {getActionBadge(log.action)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                            {log.model_name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                            {log.object_repr || `#${log.object_id}`}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                            {log.ip_address || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {log.description && (
                                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                                    <FileText className="w-3 h-3" />
                                                    {log.description.substring(0, 30)}...
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="text-sm text-slate-500 text-center">
                Showing {logs.length} log{logs.length !== 1 ? 's' : ''}
            </div>
        </div>
    );
};

export default AdminAuditLogs;
