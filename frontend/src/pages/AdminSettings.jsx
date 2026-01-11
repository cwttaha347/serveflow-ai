import { useState, useEffect } from 'react';
import api from '../api';
import {
    Save, Loader2, DollarSign, Mail, Shield, Server,
    Globe, CreditCard, Cpu, Activity, Info, AlertTriangle,
    ToggleLeft, ToggleRight, CheckCircle2, Building, Palette, Sun, Moon
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

const AdminSettings = () => {
    const [settings, setSettings] = useState({
        platform_name: 'ServeFlow AI',
        contact_email: '',
        currency_symbol: '$',
        commission_percentage: 10.00,
        tax_percentage: 0.00,
        min_payout_amount: 50.00,
        smtp_host: '',
        smtp_port: 587,
        smtp_user: '',
        smtp_password: '',
        smtp_use_tls: true,
        maintenance_mode: false,
        enable_ai_analysis: true,
        enable_bidding_system: true,
        require_provider_verification: true,
        gemini_api_key_1: '',
        gemini_api_key_2: '',
        gemini_api_key_3: '',
        gemini_api_key_4: ''
    });

    const [stats, setStats] = useState({
        totalCommission: 0,
        completedJobs: 0
    });
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('platform');
    const [showPassword, setShowPassword] = useState(false);
    const [showApiKeys, setShowApiKeys] = useState(false);
    const { success, error: showError } = useToast();
    const { theme, toggleTheme } = useTheme();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [settingsRes, jobsRes] = await Promise.all([
                api.get('settings/config/'),
                api.get('jobs/')
            ]);
            setSettings(settingsRes.data);

            const completedJobs = jobsRes.data.filter(j => j.status === 'completed');
            setJobs(completedJobs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));

            const totalComm = completedJobs.reduce((acc, job) => {
                const total = Number(job.request?.budget || 0);
                const earnings = Number(job.provider_earnings || 0);
                return acc + (total - earnings);
            }, 0);

            setStats({
                totalCommission: totalComm,
                completedJobs: completedJobs.length
            });
        } catch (error) {
            console.error('Error fetching settings:', error);
            showError('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('settings/config/', settings);
            success('Platform settings updated successfully');
        } catch (error) {
            console.error('Error updating settings:', error);
            showError('Failed to update settings');
        } finally {
            setSaving(false);
        }
    };

    const toggleFeature = (key) => {
        setSettings({ ...settings, [key]: !settings[key] });
    };

    const tabs = [
        { id: 'platform', label: 'Platform', icon: Globe },
        { id: 'payments', label: 'Payments', icon: CreditCard },
        { id: 'features', label: 'AI & Features', icon: Cpu },
        { id: 'mail', label: 'Mail Server', icon: Mail },
        { id: 'analytics', label: 'Revenue', icon: Activity },
        { id: 'appearance', label: 'Appearance', icon: Palette },
    ];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
                <p className="text-slate-500 animate-pulse font-medium">Synchronizing system configuration...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto pb-12">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <Server className="w-8 h-8 text-blue-600" />
                        System Settings
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium italic">Command center for platform-wide logic and aesthetics</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-bold uppercase animate-pulse">Live</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar Navigation */}
                <div className="lg:col-span-1 space-y-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-200 group ${activeTab === tab.id
                                ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 translate-x-1'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                }`}
                        >
                            <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'}`} />
                            <span className="font-bold">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-3">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
                        <form onSubmit={handleSubmit} className="flex-1 p-8 space-y-8">

                            {activeTab === 'platform' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <header className="flex items-center gap-4">
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl">
                                            <Building className="w-8 h-8 text-blue-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">General Platform</h2>
                                            <p className="text-sm text-slate-500">Manage public identity and basic info</p>
                                        </div>
                                    </header>

                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Platform Name</label>
                                            <input
                                                type="text"
                                                value={settings.platform_name}
                                                onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Support Email</label>
                                            <input
                                                type="email"
                                                value={settings.contact_email}
                                                onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2 font-bold uppercase text-xs text-slate-400">Currency & Display</div>
                                        <div className="md:col-span-2 grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500">Symbol</label>
                                                <input
                                                    type="text"
                                                    value={settings.currency_symbol}
                                                    onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-bold"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-4">
                                        <div className="p-2 bg-amber-500 rounded-lg text-white">
                                            <AlertTriangle className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-amber-900 dark:text-amber-100">Maintenance Mode</h4>
                                            <p className="text-sm text-amber-700 dark:text-amber-400 mb-4">When active, only administrators can access the platform.</p>
                                            <button
                                                type="button"
                                                onClick={() => toggleFeature('maintenance_mode')}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${settings.maintenance_mode ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700'}`}
                                            >
                                                {settings.maintenance_mode ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                                                {settings.maintenance_mode ? 'Platform is Offline' : 'Platform is Online'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'payments' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                                    <header className="flex items-center gap-4">
                                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl">
                                            <DollarSign className="w-8 h-8 text-emerald-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Business & Payments</h2>
                                            <p className="text-sm text-slate-500">Configure financial flows and commission rules</p>
                                        </div>
                                    </header>

                                    <div className="grid md:grid-cols-3 gap-6">
                                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-700 space-y-4">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Commission</label>
                                            <div className="flex items-end gap-2">
                                                <input
                                                    type="number"
                                                    value={settings.commission_percentage}
                                                    onChange={(e) => setSettings({ ...settings, commission_percentage: e.target.value })}
                                                    className="text-4xl font-black bg-transparent w-full text-blue-600 outline-none"
                                                />
                                                <span className="text-2xl font-bold text-slate-400 mb-1">%</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500">Platform take from every successful job.</p>
                                        </div>

                                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-700 space-y-4">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Tax Rate</label>
                                            <div className="flex items-end gap-2">
                                                <input
                                                    type="number"
                                                    value={settings.tax_percentage}
                                                    onChange={(e) => setSettings({ ...settings, tax_percentage: e.target.value })}
                                                    className="text-4xl font-black bg-transparent w-full text-emerald-600 outline-none"
                                                />
                                                <span className="text-2xl font-bold text-slate-400 mb-1">%</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500">Applied at checkout (Service Fee).</p>
                                        </div>

                                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-700 space-y-4">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Min. Payout</label>
                                            <div className="flex items-end gap-1">
                                                <span className="text-2xl font-bold text-slate-400 mb-1">{settings.currency_symbol}</span>
                                                <input
                                                    type="number"
                                                    value={settings.min_payout_amount}
                                                    onChange={(e) => setSettings({ ...settings, min_payout_amount: e.target.value })}
                                                    className="text-4xl font-black bg-transparent w-full text-purple-600 outline-none"
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-500">Threshold for provider withdrawals.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'features' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                                    <header className="flex items-center gap-4">
                                        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-2xl">
                                            <Cpu className="w-8 h-8 text-purple-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">AI & Feature Control</h2>
                                            <p className="text-sm text-slate-500">Enable or disable core system modules</p>
                                        </div>
                                    </header>

                                    <div className="space-y-4">
                                        {[
                                            { id: 'enable_ai_analysis', label: 'AI Smart Analysis', desc: 'Automatically analyze requests using Google Gemini', icon: Cpu, color: 'text-purple-500' },
                                            { id: 'enable_bidding_system', label: 'Live Bidding System', desc: 'Allow providers to place competitive bids on jobs', icon: Activity, color: 'text-blue-500' },
                                            { id: 'require_provider_verification', label: 'Strict Verification', desc: 'Providers must be verified by admin before working', icon: Shield, color: 'text-emerald-500' },
                                        ].map(item => (
                                            <div key={item.id} className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-700 flex items-center justify-between group">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm ${item.color}`}>
                                                        <item.icon className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900 dark:text-white">{item.label}</h4>
                                                        <p className="text-sm text-slate-500">{item.desc}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleFeature(item.id)}
                                                    className={`transition-all duration-300 ${settings[item.id] ? 'text-blue-600 scale-110' : 'text-slate-300 dark:text-slate-600 hover:text-slate-400'}`}
                                                >
                                                    {settings[item.id] ? <ToggleRight className="w-12 h-12" /> : <ToggleLeft className="w-12 h-12" />}
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-700 space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                    <Server className="w-5 h-5 text-purple-600" />
                                                    Gemini API Configuration (Multi-Key)
                                                </h4>
                                                <p className="text-sm text-slate-500">Add multiple keys for high availability (Rate Limit Rotation)</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowApiKeys(!showApiKeys)}
                                                className="text-blue-600 text-sm font-bold hover:underline"
                                            >
                                                {showApiKeys ? 'Hide Keys' : 'Show Keys'}
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {[1, 2, 3, 4].map(num => (
                                                <div key={num} className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase">API Key #{num}</label>
                                                    <input
                                                        type={showApiKeys ? 'text' : 'password'}
                                                        value={settings[`gemini_api_key_${num}`]}
                                                        onChange={(e) => setSettings({ ...settings, [`gemini_api_key_${num}`]: e.target.value })}
                                                        placeholder={`Gemini API Key ${num}`}
                                                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500/50 outline-none font-mono text-sm"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'mail' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                                    <header className="flex items-center gap-4">
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl">
                                            <Mail className="w-8 h-8 text-blue-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Mail Server (SMTP)</h2>
                                            <p className="text-sm text-slate-500">Secure configuration for system-led emails</p>
                                        </div>
                                    </header>

                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">SMTP Host</label>
                                            <input
                                                type="text"
                                                value={settings.smtp_host}
                                                onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                                                placeholder="smtp.gmail.com"
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Port</label>
                                            <input
                                                type="number"
                                                value={settings.smtp_port}
                                                onChange={(e) => setSettings({ ...settings, smtp_port: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">User / Email</label>
                                            <input
                                                type="text"
                                                value={settings.smtp_user}
                                                onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Password</label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={settings.smtp_password}
                                                    onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none pr-12"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500"
                                                >
                                                    {showPassword ? <Shield className="w-5 h-5" /> : <Info className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => toggleFeature('smtp_use_tls')}
                                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${settings.smtp_use_tls ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700'}`}
                                        >
                                            TLS: {settings.smtp_use_tls ? 'Enabled' : 'Disabled'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'analytics' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                                    <header className="flex items-center gap-4">
                                        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-2xl">
                                            <Activity className="w-8 h-8 text-amber-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Revenue Analytics</h2>
                                            <p className="text-sm text-slate-500">Live platform performance and job history</p>
                                        </div>
                                    </header>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="p-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2rem] text-white shadow-xl shadow-blue-500/20">
                                            <p className="text-xs font-black uppercase opacity-60 tracking-[0.2em]">Total Net Revenue</p>
                                            <p className="text-5xl font-black mt-4">{settings.currency_symbol || '$'}{stats.totalCommission.toLocaleString()}</p>
                                            <div className="mt-8 flex items-center gap-2 text-blue-200 font-bold">
                                                <CheckCircle2 className="w-5 h-5" />
                                                <span>{stats.completedJobs} Jobs Completed</span>
                                            </div>
                                        </div>

                                        <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] flex flex-col justify-center">
                                            <p className="text-xs font-black uppercase text-slate-400 tracking-[0.2em]">Average Yield</p>
                                            <p className="text-4xl font-black text-slate-900 dark:text-white mt-4">
                                                {settings.currency_symbol || '$'}{stats.completedJobs > 0 ? (stats.totalCommission / stats.completedJobs).toFixed(2) : '0.00'}
                                            </p>
                                            <p className="text-sm text-slate-500 mt-2 font-medium">Earned per job on average</p>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 font-bold text-slate-900 dark:text-white">Recent Transactions</div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-100/50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-400 tracking-widest">
                                                    <tr>
                                                        <th className="px-6 py-4">Job Reference</th>
                                                        <th className="px-6 py-4">Provider</th>
                                                        <th className="px-6 py-4">Revenue</th>
                                                        <th className="px-6 py-4">Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-sm">
                                                    {jobs.slice(0, 10).map(job => (
                                                        <tr key={job.id} className="hover:bg-white dark:hover:bg-slate-800 transition-colors group">
                                                            <td className="px-6 py-4 font-black text-blue-600">#{job.id}</td>
                                                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs">
                                                                        {job.provider?.user?.username?.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    {job.provider?.user?.username}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-emerald-600 font-black">
                                                                +{settings.currency_symbol || '$'}{(Number(job.request?.budget) - Number(job.provider_earnings)).toFixed(2)}
                                                            </td>
                                                            <td className="px-6 py-4 text-slate-500 text-xs">
                                                                {new Date(job.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'appearance' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <header className="flex items-center gap-4">
                                        <div className="p-3 bg-pink-50 dark:bg-pink-900/30 rounded-2xl">
                                            <Palette className="w-8 h-8 text-pink-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Appearance & Branding</h2>
                                            <p className="text-sm text-slate-500">Customize the visual identity of your platform</p>
                                        </div>
                                    </header>

                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Global Theme</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <button
                                                    type="button"
                                                    onClick={() => theme !== 'light' && toggleTheme()}
                                                    className={`p-6 rounded-3xl border-2 transition-all text-left ${theme === 'light' ? 'border-blue-600 bg-blue-50/50 shadow-lg' : 'border-slate-100 dark:border-slate-700'}`}
                                                >
                                                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                                                        <Sun className="w-6 h-6 text-amber-500" />
                                                    </div>
                                                    <p className="font-bold text-slate-900">Light Mode</p>
                                                    <p className="text-xs text-slate-500">Classic clean look</p>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => theme !== 'dark' && toggleTheme()}
                                                    className={`p-6 rounded-3xl border-2 transition-all text-left ${theme === 'dark' ? 'border-blue-600 bg-blue-900/20 shadow-lg' : 'border-slate-100 dark:border-slate-700'}`}
                                                >
                                                    <div className="w-12 h-12 bg-slate-900 rounded-2xl shadow-sm border border-slate-800 flex items-center justify-center mb-4">
                                                        <Moon className="w-6 h-6 text-blue-400" />
                                                    </div>
                                                    <p className="font-bold text-white">Dark Mode</p>
                                                    <p className="text-xs text-slate-400">Premium dark theme</p>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Platform Accent Color</h3>
                                            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-100 dark:border-slate-700">
                                                <div className="flex gap-4 mb-6">
                                                    {['#2563eb', '#7c3aed', '#db2777', '#059669', '#d97706'].map(color => (
                                                        <button
                                                            key={color}
                                                            type="button"
                                                            className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 shadow-sm"
                                                            style={{ backgroundColor: color }}
                                                        ></button>
                                                    ))}
                                                </div>
                                                <p className="text-xs text-slate-500 italic">Accent colors will be fully customisable in the next update.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[2rem] text-white">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="text-lg font-black italic">Visual Preview</h3>
                                                <p className="text-blue-100 text-sm">See how your changes affect the main components</p>
                                            </div>
                                            <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold">LIVE SYNC</div>
                                        </div>
                                        <div className="mt-6 grid grid-cols-2 gap-4">
                                            <div className="mt-6 grid grid-cols-2 gap-4">
                                                <div className="h-24 bg-white dark:bg-slate-800 rounded-2xl p-3 flex flex-col gap-2 shadow-lg">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700"></div>
                                                    <div className="h-2 w-16 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                                                    <div className="h-2 w-10 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                                                </div>
                                                <div className="h-24 bg-white/10 dark:bg-slate-900/50 rounded-2xl border border-white/20 p-3 flex flex-col gap-2 backdrop-blur-sm">
                                                    <div className="w-full h-8 bg-white/20 rounded-lg"></div>
                                                    <div className="w-2/3 h-2 bg-white/20 rounded-full mt-auto"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </form>

                        {/* Footer Action Bar */}
                        {activeTab !== 'analytics' && (
                            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                                <button
                                    onClick={handleSubmit}
                                    disabled={saving}
                                    className="flex items-center gap-3 px-10 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 font-black disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    Sync Configuration
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;
