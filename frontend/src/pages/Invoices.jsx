import { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import {
    DollarSign, Download, FileText, Search,
    Filter, ArrowUpRight, CheckCircle2, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Invoices = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const { error: showError } = useToast();

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            const response = await api.get('invoices/');
            setInvoices(response.data);
        } catch (error) {
            console.error(error);
            showError('Failed to load financial documents');
        } finally {
            setLoading(false);
        }
    };

    const filteredInvoices = invoices.filter(invoice => {
        const matchesId = `INV-${invoice.id.toString().padStart(6, '0')}`.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'paid' && invoice.paid) ||
            (statusFilter === 'pending' && !invoice.paid);
        return matchesId && matchesStatus;
    });

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const item = {
        hidden: { y: 10, opacity: 0 },
        show: { y: 0, opacity: 1 }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 font-black uppercase tracking-widest animate-pulse">Scanning Financial Ledger...</p>
            </div>
        );
    }

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-10"
        >
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Ledger Archives</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Monitoring transaction protocols and settlement status</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <div className="relative group lg:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search Protocol ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-sm"
                        />
                    </div>
                    <div className="relative group">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="pl-12 pr-10 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none font-black text-[10px] uppercase tracking-widest"
                        >
                            <option value="all">ALL PROTOCOLS</option>
                            <option value="paid">SETTLED</option>
                            <option value="pending">PENDING</option>
                        </select>
                    </div>
                </div>
            </header>

            {invoices.length === 0 ? (
                <div className="glass-card p-20 text-center rounded-[3rem]">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileText className="w-10 h-10 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-bold">No transaction records found in active node.</p>
                </div>
            ) : (
                <motion.div variants={item} className="glass-card rounded-[2.5rem] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Protocol Entry</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Initialization</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Net Value</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                    <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Operation</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                <AnimatePresence>
                                    {filteredInvoices.map((invoice) => (
                                        <motion.tr
                                            key={invoice.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all font-medium"
                                        >
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                                        <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-white" />
                                                    </div>
                                                    <span className="font-black text-slate-900 dark:text-white tracking-tight">
                                                        #INV-{invoice.id.toString().padStart(6, '0')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                                    {new Date(invoice.created_at).toLocaleDateString()}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="text-lg font-black text-slate-900 dark:text-white">
                                                    ${invoice.total}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 w-fit border ${invoice.paid
                                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                    : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                                    }`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${invoice.paid ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                                                    {invoice.paid ? 'SETTLED' : 'PENDING'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <button
                                                    onClick={() => window.location.href = `/dashboard/invoices/${invoice.id}`}
                                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] hover:scale-105 active:scale-95 transition-all shadow-sm"
                                                >
                                                    Audit <ArrowUpRight className="w-3 h-3" />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
};

export default Invoices;
