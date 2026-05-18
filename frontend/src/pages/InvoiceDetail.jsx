import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { Printer, Download, ArrowLeft, Loader2, CheckCircle2, AlertCircle, CreditCard, MapPin, RefreshCw } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { useWebSocket } from '../context/WebSocketContext';
import { formatMoney } from '../utils/money';

const PAYMENT_CONFIRM_DELAYS_MS = [500, 1000, 1500, 2000, 3000, 4000, 5000];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const InvoiceDetail = () => {
    const { settings } = useSettings();
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { success, error: showError } = useToast();
    const { lastMessage } = useWebSocket();
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);
    const [confirmingPayment, setConfirmingPayment] = useState(false);
    const [paymentConfirmDelayed, setPaymentConfirmDelayed] = useState(false);
    const reconcileAttemptRef = useRef(0);
    const paymentReconciledRef = useRef(false);
    const userRole = localStorage.getItem('userRole');

    const fetchInvoice = useCallback(async () => {
        try {
            const response = await api.get(`invoices/${id}/`);
            setInvoice(response.data);
        } catch (error) {
            console.error('Error fetching invoice:', error);
            showError('Failed to load invoice');
        } finally {
            setLoading(false);
        }
    }, [id, showError]);

    useEffect(() => {
        setLoading(true);
        fetchInvoice();
    }, [fetchInvoice]);

    const clearPaymentQueryParams = useCallback(() => {
        navigate(`/dashboard/invoices/${id}`, { replace: true });
    }, [id, navigate]);

    const reconcilePayment = useCallback(async (sessionId) => {
        const attemptId = ++reconcileAttemptRef.current;
        setConfirmingPayment(true);
        setPaymentConfirmDelayed(false);

        const isStale = () => attemptId !== reconcileAttemptRef.current;

        const tryConfirm = async () => {
            const res = await api.post('payments/stripe-confirm/', {
                invoice_id: id,
                session_id: sessionId || null,
            });
            return res.data;
        };

        let lastError = null;
        const maxAttempts = PAYMENT_CONFIRM_DELAYS_MS.length + 1;

        try {
            for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
                if (isStale()) return;

                try {
                    const data = await tryConfirm();
                    if (data?.paid) {
                        success('Payment confirmed successfully.');
                        clearPaymentQueryParams();
                        await fetchInvoice();
                        return;
                    }
                    if (data?.pending === false && !data?.paid) {
                        lastError = new Error(data?.error || 'Payment could not be confirmed.');
                        break;
                    }
                } catch (error) {
                    const status = error.response?.status;
                    if (status === 400 || status === 403 || status === 404) {
                        throw error;
                    }
                    lastError = error;
                }

                if (attempt < PAYMENT_CONFIRM_DELAYS_MS.length) {
                    await sleep(PAYMENT_CONFIRM_DELAYS_MS[attempt]);
                }
            }

            if (isStale()) return;

            await fetchInvoice();
            const refreshed = await api.get(`invoices/${id}/`).then((r) => r.data).catch(() => null);
            if (refreshed?.paid) {
                success('Payment confirmed successfully.');
                clearPaymentQueryParams();
                setInvoice(refreshed);
                return;
            }

            setPaymentConfirmDelayed(true);
            if (lastError) {
                console.error('Payment confirmation timed out:', lastError);
            }
        } catch (error) {
            if (isStale()) return;
            console.error('Payment confirmation failed:', error);
            const message = error.response?.data?.error
                || (error.response?.status === 403
                    ? 'Verify your email before confirming payment.'
                    : 'Payment confirmation failed. Please try again.');
            showError(message);
            await fetchInvoice();
        } finally {
            if (!isStale()) {
                setConfirmingPayment(false);
            }
        }
    }, [id, success, showError, fetchInvoice, clearPaymentQueryParams]);

    useEffect(() => {
        const payment = searchParams.get('payment');
        const sessionId = searchParams.get('session_id');
        if (payment !== 'success' || paymentReconciledRef.current) return;
        paymentReconciledRef.current = true;
        reconcilePayment(sessionId);
    }, [searchParams, reconcilePayment]);

    useEffect(() => {
        if (!lastMessage || lastMessage.type !== 'invoice_paid') return;
        const payload = lastMessage.payload || {};
        if (String(payload.invoice_id) === String(id)) {
            fetchInvoice();
            setPaymentConfirmDelayed(false);
            setConfirmingPayment(false);
        }
    }, [lastMessage, id, fetchInvoice]);

    const handleMarkPaid = async () => {
        setPaying(true);
        try {
            await api.post(`invoices/${id}/mark_paid/`, { payment_method: 'manual' });
            success('Invoice marked as paid.');
            await fetchInvoice();
        } catch (err) {
            showError(err.response?.data?.error || 'Failed to mark invoice as paid');
        } finally {
            setPaying(false);
        }
    };

    const handleStripePayment = async () => {
        setPaying(true);
        try {
            const response = await api.post('payments/stripe-checkout/', {
                invoice_id: id,
                success_url: `${window.location.origin}/dashboard/invoices/${id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${window.location.origin}/dashboard/invoices/${id}?payment=cancelled`
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

    const handleDownload = async () => {
        try {
            success('Generating professional PDF...');
            const response = await api.get(`invoices/${id}/download_pdf/`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Invoice_${id.toString().padStart(6, '0')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            success('Invoice downloaded successfully!');
        } catch (err) {
            console.error('Error downloading invoice:', err);
            showError('Failed to generate PDF');
        }
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

    const taxAmount = Number(invoice.tax || 0);
    const taxLabel = taxAmount > 0 ? 'Tax' : 'Tax (0%)';
    const serviceAddress = invoice.service_address || invoice.job?.request?.address || '';
    const customerAddress = invoice.customer_address || '';
    const providerAddress = invoice.provider_address || '';

    return (
        <div className="max-w-4xl mx-auto space-y-6 px-4 sm:px-6 print:p-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 print:hidden">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-slate-500 hover:text-slate-700 transition-colors w-fit"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </button>
                <div className="flex flex-wrap gap-2 sm:gap-3 sm:justify-end">
                    {!invoice.paid && userRole === 'user' && (
                        <button
                            onClick={handleStripePayment}
                            disabled={paying}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 font-black text-sm"
                        >
                            {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                            Pay with Stripe
                        </button>
                    )}
                    {!invoice.paid && (userRole === 'admin' || userRole === 'provider') && (
                        <button
                            onClick={handleMarkPaid}
                            disabled={paying}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                        >
                            {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Mark as Paid
                        </button>
                    )}
                    <button
                        onClick={handleDownload}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/10 font-bold text-sm"
                    >
                        <Download className="w-4 h-4" /> Download
                    </button>
                    <button
                        onClick={handlePrint}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-bold shadow-sm text-sm"
                    >
                        <Printer className="w-4 h-4" /> Print
                    </button>
                </div>
            </div>

            {confirmingPayment && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Confirming payment status...
                </div>
            )}

            {paymentConfirmDelayed && !confirmingPayment && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p>
                        Payment confirmation is taking longer than usual. Your payment may already be processing.
                    </p>
                    <button
                        type="button"
                        onClick={() => reconcilePayment(searchParams.get('session_id'))}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 font-semibold shrink-0"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Retry
                    </button>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden print:shadow-none">
                <div className="p-6 sm:p-10 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-800/50 dark:to-blue-900/10">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400 mb-2">{settings.platform_name}</p>
                            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">INVOICE</h1>
                            <p className="text-slate-500 dark:text-slate-400 font-mono mt-1">#{invoice.id.toString().padStart(6, '0')}</p>
                        </div>
                        <div className="text-left sm:text-right">
                            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold ${invoice.paid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                                {invoice.paid ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                {invoice.paid ? 'PAID' : 'PENDING'}
                            </div>
                            <p className="text-sm text-slate-500 mt-2">Issued {new Date(invoice.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 sm:p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Billed To</h3>
                            <p className="font-bold text-lg text-slate-900 dark:text-white">{invoice.job?.request?.user?.username}</p>
                            {customerAddress && (
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 flex gap-2">
                                    <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                                    <span>{customerAddress}</span>
                                </p>
                            )}
                        </div>
                        <div>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Service Provider</h3>
                            <p className="font-bold text-lg text-slate-900 dark:text-white">{invoice.job?.provider?.user?.username}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{invoice.job?.request?.category_name || 'General Service'}</p>
                            {providerAddress && (
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 flex gap-2">
                                    <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                                    <span>{providerAddress}</span>
                                </p>
                            )}
                        </div>
                    </div>
                    {serviceAddress && (
                        <div className="md:col-span-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Service Location</h3>
                            <p className="text-sm text-slate-700 dark:text-slate-300 flex gap-2">
                                <MapPin className="w-4 h-4 shrink-0 text-blue-500" />
                                {serviceAddress}
                            </p>
                        </div>
                    )}
                </div>

                <div className="px-4 sm:px-10 pb-6 sm:pb-8">
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-x-auto">
                        <table className="w-full min-w-[520px] text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 sm:px-6 py-4">Description</th>
                                    <th className="px-4 sm:px-6 py-4 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-t border-slate-100 dark:border-slate-700">
                                    <td className="px-4 sm:px-6 py-5">
                                        <p className="font-bold text-slate-900 dark:text-white">{invoice.job?.request?.title}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 break-words mt-1 max-w-prose">{invoice.job?.request?.description}</p>
                                    </td>
                                    <td className="px-4 sm:px-6 py-5 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                        {formatMoney(invoice.subtotal, settings)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="px-6 sm:px-10 py-8 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700">
                    <div className="max-w-sm ml-auto space-y-2 text-sm">
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                            <span>Subtotal</span>
                            <span className="font-semibold text-slate-900 dark:text-white">{formatMoney(invoice.subtotal, settings)}</span>
                        </div>
                        {Number(invoice.discount || 0) > 0 && (
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>Discount</span>
                                <span>-{formatMoney(invoice.discount, settings)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                            <span>{taxLabel}</span>
                            <span className="font-semibold text-slate-900 dark:text-white">{formatMoney(taxAmount, settings)}</span>
                        </div>
                        <div className="flex justify-between text-xl font-black text-slate-900 dark:text-white pt-4 border-t border-slate-200 dark:border-slate-600">
                            <span>Total Due</span>
                            <span className="text-blue-600 dark:text-blue-400">{formatMoney(invoice.total, settings)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800 print:hidden text-center">
                <p className="text-blue-700 dark:text-blue-300 font-medium text-sm">
                    Questions? Contact {settings.contact_email || 'support'}
                </p>
            </div>
        </div>
    );
};

export default InvoiceDetail;
