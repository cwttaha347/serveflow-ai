import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { Printer, Download, ArrowLeft, Loader2, CheckCircle2, AlertCircle, CreditCard } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';

const InvoiceDetail = () => {
    const { settings } = useSettings();
    const { id } = useParams();
    const navigate = useNavigate();
    const { success, error: showError } = useToast();
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);
    const userRole = localStorage.getItem('userRole');

    useEffect(() => {
        fetchInvoice();
    }, [id]);

    const fetchInvoice = async () => {
        try {
            const response = await api.get(`invoices/${id}/`);
            setInvoice(response.data);
        } catch (error) {
            console.error('Error fetching invoice:', error);
            showError('Failed to load invoice');
        } finally {
            setLoading(false);
        }
    };

    const handleStripePayment = async () => {
        setPaying(true);
        try {
            const response = await api.post('payments/stripe-checkout/', {
                invoice_id: id,
                success_url: `${window.location.origin}/invoices/${id}?payment=success`,
                cancel_url: `${window.location.origin}/invoices/${id}?payment=cancelled`
            });
            if (response.data.checkout_url) {
                window.location.href = response.data.checkout_url;
            }
        } catch (err) {
            console.error('Error initiating Stripe payment:', err);
            showError(err.response?.data?.error || 'Failed to initiate secure checkout');
        } finally {
            setPaying(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownload = () => {
        // In a real app, this would call a backend endpoint to generate a PDF
        // Or use a library like jspdf. For now, we'll use print as a robust alternative.
        window.print();
        success('Preparing invoice download...');
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-slate-500 animate-pulse">Generating invoice view...</p>
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="text-center p-12">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold">Invoice not found</h2>
                <button onClick={() => navigate(-1)} className="mt-4 text-primary hover:underline flex items-center gap-2 mx-auto">
                    <ArrowLeft className="w-4 h-4" /> Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 print:p-0">
            <div className="flex justify-between items-center print:hidden">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-slate-500 hover:text-slate-700 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </button>
                <div className="flex gap-3">
                    {!invoice.paid && userRole === 'user' && (
                        <button
                            onClick={handleStripePayment}
                            disabled={paying}
                            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 font-black"
                        >
                            {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                            Pay with Stripe
                        </button>
                    )}
                    {!invoice.paid && (userRole === 'admin' || userRole === 'provider') && (
                        <button
                            onClick={handleMarkPaid}
                            disabled={paying}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                            {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Mark as Paid
                        </button>
                    )}
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/10 font-bold"
                    >
                        <Download className="w-4 h-4" /> Download
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-bold shadow-sm"
                    >
                        <Printer className="w-4 h-4" /> Print
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Header */}
                <div className="p-8 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-black text-primary dark:text-blue-400 mb-2">INVOICE</h1>
                            <p className="text-slate-500 dark:text-slate-400">#{invoice.id.toString().padStart(6, '0')}</p>
                        </div>
                        <div className="text-right">
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${invoice.paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                {invoice.paid ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                {invoice.paid ? 'PAID' : 'PENDING'}
                            </div>
                            <p className="text-sm text-slate-500 mt-2">Date: {new Date(invoice.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 grid grid-cols-2 gap-12">
                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Billed To</h3>
                        <p className="font-bold text-slate-900 dark:text-white text-lg">{invoice.job?.request?.user?.username}</p>
                        <p className="text-slate-500 dark:text-slate-400">Customer ID: {invoice.job?.request?.user?.id}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Service Provider</h3>
                        <p className="font-bold text-slate-900 dark:text-white text-lg">{invoice.job?.provider?.user?.username}</p>
                        <p className="text-slate-500 dark:text-slate-400">Category: {invoice.job?.request?.category_name || 'General Service'}</p>
                    </div>
                </div>

                {/* Table */}
                <div className="px-8 pb-8">
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 text-xs font-bold uppercase">
                                <tr>
                                    <th className="px-6 py-4">Description</th>
                                    <th className="px-6 py-4 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                <tr>
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-slate-900 dark:text-white">{invoice.job?.request?.title}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{invoice.job?.request?.description}</p>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                                        {settings.currency_symbol}{Number(invoice.subtotal).toFixed(2)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Totals */}
                <div className="p-8 bg-slate-50 dark:bg-slate-700/20 border-t border-slate-200 dark:border-slate-700">
                    <div className="max-w-xs ml-auto space-y-3">
                        <div className="flex justify-between text-slate-500">
                            <span>Subtotal</span>
                            <span>{settings.currency_symbol}{Number(invoice.subtotal).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                            <span>Tax (0%)</span>
                            <span>{settings.currency_symbol}0.00</span>
                        </div>
                        <div className="flex justify-between text-xl font-black text-slate-900 dark:text-white pt-3 border-t border-slate-200 dark:border-slate-700">
                            <span>Total</span>
                            <span>{settings.currency_symbol}{Number(invoice.total).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800 print:hidden text-center">
                <p className="text-blue-700 dark:text-blue-300 font-medium">
                    Questions about this invoice? Contact <a href="#" className="underline font-bold">Support</a>
                </p>
            </div>
        </div>
    );
};

export default InvoiceDetail;
