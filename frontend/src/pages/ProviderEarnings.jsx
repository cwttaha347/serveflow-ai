import { useEffect, useState } from 'react';
import api from '../api';
import { useSettings } from '../context/SettingsContext';
import { DollarSign, TrendingUp, Calendar, ArrowUpRight, Download } from 'lucide-react';
import { formatMoney } from '../utils/money';

const ProviderEarnings = () => {
    const { settings } = useSettings();
    const [wallet, setWallet] = useState({
        earned_total: 0,
        paid_out_total: 0,
        available_balance: 0,
        total_jobs: 0,
        completed_jobs: 0,
    });
    const [ledger, setLedger] = useState([]);
    const [payouts, setPayouts] = useState([]);
    const [connectStatus, setConnectStatus] = useState({ onboarding_complete: false, stripe_connect_account_id: '' });
    const [loading, setLoading] = useState(true);
    const [withdrawing, setWithdrawing] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        fetchWallet();
    }, []);

    const fetchWallet = async () => {
        try {
            setErrorMsg('');
            const [analyticsRes, ledgerRes, payoutsRes, connectRes] = await Promise.all([
                api.get('providers/analytics/'),
                api.get('provider-ledger/').catch(() => ({ data: [] })),
                api.get('provider-payouts/').catch(() => ({ data: [] })),
                api.get('providers/stripe-connect/status/').catch(() => ({ data: { onboarding_complete: false, stripe_connect_account_id: '' } })),
            ]);
            setWallet({
                earned_total: Number(analyticsRes.data?.earned_total || 0),
                paid_out_total: Number(analyticsRes.data?.paid_out_total || 0),
                available_balance: Number(analyticsRes.data?.available_balance || 0),
                total_jobs: Number(analyticsRes.data?.total_jobs || 0),
                completed_jobs: Number(analyticsRes.data?.completed_jobs || 0),
            });
            setLedger(Array.isArray(ledgerRes.data) ? ledgerRes.data : (ledgerRes.data?.results || []));
            setPayouts(Array.isArray(payoutsRes.data) ? payoutsRes.data : (payoutsRes.data?.results || []));
            setConnectStatus(connectRes.data || { onboarding_complete: false, stripe_connect_account_id: '' });
        } catch (error) {
            console.error('Error fetching earnings:', error);
            setErrorMsg(error.response?.data?.error || 'Failed to load wallet data.');
        } finally {
            setLoading(false);
        }
    };

    const startConnect = async () => {
        setErrorMsg('');
        try {
            const { data } = await api.post('providers/stripe-connect/onboarding/', {});
            if (data?.url) window.location.assign(data.url);
        } catch (e) {
            console.error(e);
            const d = e.response?.data || {};
            if (d.code === 'CONNECT_NOT_ENABLED' && d.action_url) {
                setErrorMsg(`${d.error} (${d.action_url})`);
            } else {
                setErrorMsg(d.error || 'Could not start bank connection. Is Stripe configured?');
            }
        }
    };

    const requestWithdraw = async () => {
        const raw = String(withdrawAmount || '').trim();
        const amt = Number(raw);
        if (!Number.isFinite(amt) || amt <= 0) {
            setErrorMsg('Enter a valid payout amount.');
            return;
        }
        if (amt > Number(wallet.available_balance || 0)) {
            setErrorMsg(`Insufficient balance. Available: ${formatMoney(wallet.available_balance, settings)}.`);
            return;
        }
        setWithdrawing(true);
        setErrorMsg('');
        try {
            await api.post('provider-payouts/', { amount: amt });
            setWithdrawAmount('');
            await fetchWallet();
        } catch (e) {
            console.error(e);
            setErrorMsg(e.response?.data?.detail || e.response?.data?.error || 'Payout request failed.');
        } finally {
            setWithdrawing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Earnings & Payouts</h1>
                    <p className="text-slate-500 dark:text-slate-400">Track your financial performance</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={startConnect}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                    >
                        {connectStatus?.onboarding_complete ? 'Bank connected' : 'Connect bank (Stripe)'}
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <Download className="w-4 h-4" />
                        Export Report
                    </button>
                </div>
            </div>

            {errorMsg && (
                <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                    {errorMsg}
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-xl text-white">
                    <p className="text-emerald-100 text-sm font-medium">Available balance</p>
                    <h3 className="text-3xl font-bold mt-2">{formatMoney(wallet.available_balance, settings)}</h3>
                    <div className="flex items-center gap-1 mt-4 text-emerald-100 text-sm">
                        <TrendingUp className="w-4 h-4" />
                        <span>{wallet.completed_jobs}/{wallet.total_jobs} jobs completed</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <Calendar className="w-6 h-6 text-blue-500" />
                        </div>
                        <span className="text-green-500 text-sm font-medium flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3" /> +8.2%
                        </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Total earned</p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {formatMoney(wallet.earned_total, settings)}
                    </h3>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                            <DollarSign className="w-6 h-6 text-amber-500" />
                        </div>
                        <span className="text-xs font-medium px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full">
                            Processing
                        </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Paid out</p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {formatMoney(wallet.paid_out_total, settings)}
                    </h3>
                </div>
            </div>

            {/* Withdraw */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Withdraw to bank</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Withdrawals are available after job completion and payment confirmation.
                </p>
                {!connectStatus?.onboarding_complete && (
                    <div className="mb-4 p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200">
                        Your bank is not connected yet. You can still create a payout request, but it may require manual processing until you complete Stripe onboarding.
                    </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Amount</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={`Max ${formatMoney(wallet.available_balance, settings)}`}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={requestWithdraw}
                        disabled={withdrawing}
                        className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold disabled:opacity-60"
                    >
                        {withdrawing ? 'Submitting…' : 'Withdraw'}
                    </button>
                </div>
            </div>

            {/* Payouts */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Payout history</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                        <thead className="bg-slate-50 dark:bg-slate-700/50">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Payout</th>
                                <th className="px-6 py-4 font-semibold">Date</th>
                                <th className="px-6 py-4 font-semibold">Amount</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {payouts.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                        No payouts yet.
                                    </td>
                                </tr>
                            ) : (
                                payouts.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-slate-900 dark:text-slate-100">#{p.id}</td>
                                        <td className="px-6 py-4">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'}</td>
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                                            {formatMoney(p.amount, settings)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize 
                                                ${p.status === 'paid'
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                                    : p.status === 'failed'
                                                        ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                                                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                                }`}
                                            >
                                                {p.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProviderEarnings;
