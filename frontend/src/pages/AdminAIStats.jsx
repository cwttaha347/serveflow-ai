import { useState, useEffect } from 'react';
import { Sparkles, Brain, Zap, Activity } from 'lucide-react';
import { useToast } from '../context/ToastContext';
// Optionally import chart library if available, for now using simple mock visualizations

const AdminAIStats = () => {
    // Mock data for AI performance
    const [stats, setStats] = useState({
        requestsProcessed: 1250,
        avgMatchTime: '1.2s',
        accuracy: '94.5%',
        activeModels: 3
    });

    const [logs, setLogs] = useState([
        { id: 1, action: 'Match', input: 'Plumbing leak in kitchen...', result: 'Category: Plumbing, Confidence: 98%', time: '2 mins ago', status: 'success' },
        { id: 2, action: 'Analyze', input: 'Fix drywall hole', result: 'Category: Repair, Confidence: 92%', time: '5 mins ago', status: 'success' },
        { id: 3, action: 'Match', input: 'Complex electrical wiring...', result: 'Category: Electrical, Confidence: 89%', time: '12 mins ago', status: 'success' },
        { id: 4, action: 'Match', input: 'Unknown service request', result: 'Category: General, Confidence: 45%', time: '15 mins ago', status: 'warning' },
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Sparkles className="text-purple-500" />
                    AI Insights & Logs
                </h1>
                <p className="text-slate-500 dark:text-slate-400">Monitor AI matching engine performance</p>
            </div>

            {/* AI Health Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Brain className="w-24 h-24" />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Requests Processed</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.requestsProcessed}</p>
                    <span className="text-xs text-green-500 flex items-center gap-1 mt-2">
                        <Activity className="w-3 h-3" /> +12% this week
                    </span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Avg Match Time</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.avgMatchTime}</p>
                    <span className="text-xs text-green-500 mt-2 block">Optimal</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Match Accuracy</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.accuracy}</p>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-3">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '94.5%' }}></div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Active Models</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.activeModels}</p>
                    <span className="text-xs text-blue-500 mt-2 block">BERT-v3, GPT-4o, Custom-CNN</span>
                </div>
            </div>

            {/* Recent Logs */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500" />
                        Live Processing Logs
                    </h2>
                    <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All Logs</button>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {logs.map((log) => (
                        <div key={log.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-sm">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${log.status === 'success'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                            }`}>
                                            {log.action}
                                        </span>
                                        <span className="text-slate-400 text-xs">{log.time}</span>
                                    </div>
                                    <p className="text-slate-900 dark:text-slate-100 font-medium truncate max-w-md">
                                        Input: "{log.input}"
                                    </p>
                                    <p className="text-slate-600 dark:text-slate-400">
                                        Result: <span className="font-mono text-xs bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded">{log.result}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminAIStats;
