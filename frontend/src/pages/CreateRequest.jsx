import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight, ArrowLeft, MapPin, Calendar, DollarSign, Upload,
    Wand2, Shield, Star, CheckCircle, AlertCircle, Camera,
    ScanLine, Lock, Eye, Check
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import api from '../api';

const CreateRequest = () => {
    const navigate = useNavigate();
    const { success, error: showError } = useToast();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        category: '',
        title: '',
        description: '',
        address: '',
        preferred_date: '',
        budget: '',
        images: []
    });

    const [recommendations, setRecommendations] = useState([]);
    const [fetchingRecs, setFetchingRecs] = useState(false);
    const [diagnosis, setDiagnosis] = useState(null);
    const [diagnosing, setDiagnosing] = useState(false);

    // Image AI States
    const [scanning, setScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const fileInputRef = useRef(null);

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Security Check 1: Client-side file validation
        if (file.size > 10 * 1024 * 1024) {
            showError("Security Alert: File exceeds safe size limit (10MB).");
            return;
        }

        setScanning(true);
        setScanProgress(0);

        // Simulate scanning progress
        const interval = setInterval(() => {
            setScanProgress(prev => {
                if (prev >= 90) return prev;
                return prev + 5;
            });
        }, 100);

        const formDataPayload = new FormData();
        formDataPayload.append('image', file);

        try {
            const res = await api.post('requests/ai-analyze/', formDataPayload, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            clearInterval(interval);
            setScanProgress(100);

            setTimeout(() => {
                setScanning(false);
                const analysis = res.data.analysis;

                // Auto-populate based on analysis
                setFormData(prev => ({
                    ...prev,
                    title: analysis.suggested_title,
                    description: analysis.suggested_description,
                    category: analysis.category_id,
                    budget: analysis.estimated_budget_range.replace(/[^0-9]/g, '').slice(0, 3) || '', // simplified
                    images: [analysis.image_url]
                }));

                setDiagnosis({ summary: analysis.summary });
                setStep(2); // Jump to verification
                success("Vision Analysis Complete: Protocol Secured.");
            }, 800);

        } catch (err) {
            clearInterval(interval);
            setScanning(false);
            console.error(err);
            if (err.response?.data?.code === 'SAFETY_BLOCK') {
                showError("Content Security Policy: Image rejected due to safety violations (Mock).");
            } else {
                showError("Visual Analysis Failed: Use manual entry.");
            }
        }
    };

    const handleDiagnose = async () => {
        if (!formData.description) {
            showError("Please describe your problem first.");
            return;
        }
        setDiagnosing(true);
        try {
            const res = await api.post('categories/diagnose/', { description: formData.description });
            setDiagnosis(res.data);
            if (res.data.category_id) {
                setFormData(prev => ({ ...prev, category: res.data.category_id }));
            }
            setStep(2);
        } catch (err) {
            console.error(err);
            showError("AI Diagnosis failed. Please select manually.");
            setStep(2);
        } finally {
            setDiagnosing(false);
        }
    };

    const [categories, setCategories] = useState([]);

    useEffect(() => {
        api.get('categories/').then(res => {
            setCategories(res.data.filter(c => c.is_active));
        }).catch(err => console.error('Failed to load categories', err));
    }, []);

    const fetchRecommendations = async () => {
        setFetchingRecs(true);
        try {
            const response = await api.post('providers/recommendations/', {
                title: formData.title,
                description: formData.description,
                category: formData.category, // sending ID
                address: formData.address,
                budget: formData.budget
            });
            setRecommendations(response.data);
        } catch (error) {
            console.error('Failed to fetch recommendations:', error);
        } finally {
            setFetchingRecs(false);
        }
    };

    // Trigger recommendations when entering Step 4
    const nextStep = () => {
        if (step < 4) {
            setStep(step + 1);
            if (step === 3) { // Moving to review step
                fetchRecommendations();
            }
        }
    };

    const prevStep = () => step > 1 && setStep(step - 1);

    const handleSubmit = async (providerId = null) => {
        setLoading(true);
        try {
            const response = await api.post('requests/', {
                category_id: formData.category,
                title: formData.title,
                description: formData.description,
                address: formData.address,
                preferred_date: formData.preferred_date,
                budget: formData.budget,
                selected_provider: providerId,
                images: formData.images
            });

            success('Protocol Initiated Successfully.');
            navigate('/dashboard');
        } catch (error) {
            console.error('Error creating request:', error);
            showError('Failed to initiate protocol.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0f1d] text-white relative overflow-x-hidden font-sans pb-20">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-blue-500/40 rounded-full blur-[120px] animate-blob"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-purple-500/40 rounded-full blur-[120px] animate-blob animation-delay-2000"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-blue-400/10 rounded-full blur-[140px] animate-pulse"></div>
            </div>

            {/* Scanning Overlay */}
            {scanning && (
                <div className="fixed inset-0 z-50 bg-[#0a0f1d]/90 backdrop-blur-xl flex flex-col items-center justify-center">
                    <div className="relative w-full max-w-[320px] aspect-square border-2 border-blue-500/50 rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(37,99,235,0.3)]">
                        <div className="absolute inset-0 bg-blue-500/10 animate-pulse"></div>
                        <ScanLine className="absolute top-0 left-0 w-full h-1 bg-blue-400 shadow-[0_0_20px_#60a5fa] animate-[scan_2s_linear_infinite]" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-4xl font-black text-white/20 tracking-widest uppercase">Analyzing</div>
                        </div>
                        {/* Corner markers */}
                        <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-xl"></div>
                        <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-xl"></div>
                        <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-xl"></div>
                        <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-xl"></div>
                    </div>

                    <div className="mt-8 w-full max-w-[320px] space-y-2">
                        <div className="flex justify-between text-xs font-bold text-blue-400 uppercase tracking-widest">
                            <span>Security Scan</span>
                            <span>{Math.min(scanProgress, 100)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6] transition-all duration-100 ease-out"
                                style={{ width: `${scanProgress}%` }}
                            ></div>
                        </div>
                        <p className="text-center text-slate-500 text-xs mt-4 animate-pulse">
                            Validating Metadata & Content Safety Protocols...
                        </p>
                    </div>
                </div>
            )}

            <div className="max-w-4xl mx-auto px-4 relative z-10 pt-12 md:pt-20">
                {/* Progress Bar */}
                {!scanning && (
                    <div className="mb-16 md:mb-20">
                        <div className="relative flex items-center justify-between px-2 md:px-10">
                            {/* Background Line */}
                            <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-800/50 -translate-y-1/2 z-0 rounded-full"></div>
                            <div
                                className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 -translate-y-1/2 z-0 transition-all duration-700 ease-out rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                                style={{ width: `${((step - 1) / 3) * 100}%` }}
                            ></div>

                            {['Description', 'Diagnosis', 'Schedule', 'The Match'].map((label, index) => {
                                const i = index + 1;
                                const isActive = i <= step;
                                const isCurrent = i === step;
                                return (
                                    <div key={i} className="relative z-10 flex flex-col items-center">
                                        <div
                                            className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center font-black transition-all duration-500 border-2 ${isActive
                                                ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_25px_rgba(37,99,235,0.6)]'
                                                : 'bg-slate-900 border-slate-800 text-slate-600'
                                                } ${isCurrent ? 'scale-125 ring-8 ring-blue-500/10' : ''}`}
                                        >
                                            {isActive && i < step ? <CheckCircle className="w-6 h-6 md:w-8 md:h-8" /> : i}
                                        </div>
                                        <span className={`absolute -bottom-8 md:-bottom-10 whitespace-nowrap text-[10px] md:text-xs font-black uppercase tracking-widest transition-all duration-300 ${isActive ? 'text-blue-400 opacity-100' : 'text-slate-700 opacity-50'
                                            }`}>
                                            {label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="glass-dark border-slate-800 p-6 md:p-12 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-10">
                    {/* Step 1: The Prompt (Enhanced with Vision) */}
                    {step === 1 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-700">
                            <div className="text-center">
                                <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-4">
                                    Report an Incident
                                </h1>
                                <p className="text-slate-400 text-lg">Use our advanced vision system or describe the issue manually.</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Option A: Vision Scan */}
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="group relative p-8 rounded-3xl bg-blue-600 cursor-pointer overflow-hidden transition-all hover:scale-[1.02] shadow-[0_0_40px_rgba(37,99,235,0.3)] hover:shadow-[0_0_60px_rgba(37,99,235,0.5)]"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-100"></div>
                                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                                    <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                                        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform duration-500">
                                            <Camera className="w-10 h-10 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-white mb-2">Visual Auto-Scan</h3>
                                            <p className="text-blue-100 text-sm font-medium">Upload photo. AI detects issue & fills details instantly.</p>
                                        </div>
                                        <div className="flex items-center gap-2 px-4 py-2 bg-black/20 rounded-lg text-xs font-bold text-white uppercase tracking-widest mt-4">
                                            <Lock className="w-3 h-3" /> Secure Analysis
                                        </div>
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImageUpload}
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                    />
                                </div>

                                {/* Option B: Manual Text */}
                                <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-700 flex flex-col justify-between hover:bg-slate-800/50 transition-colors">
                                    <div className="space-y-4">
                                        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center">
                                            <Wand2 className="w-8 h-8 text-purple-400" />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-200">Manual Description</h3>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            rows={3}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm focus:border-purple-500 outline-none transition-colors resize-none"
                                            placeholder="Describe the problem here..."
                                        />
                                    </div>
                                    <button
                                        onClick={handleDiagnose}
                                        disabled={diagnosing || !formData.description}
                                        className="mt-6 w-full py-4 rounded-xl bg-slate-800 text-white font-bold hover:bg-purple-600 transition-all disabled:opacity-50 disabled:hover:bg-slate-800"
                                    >
                                        {diagnosing ? 'Analyzing...' : 'Analyze Text'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: AI Diagnosis Result */}
                    {step === 2 && (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-black text-white mb-2">Protocol Verified</h2>
                                <p className="text-slate-400">Please review the AI-generated assessment.</p>
                            </div>

                            <div className="p-6 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-4 backdrop-blur-sm">
                                <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                                    <ScanLine className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-blue-400 mb-1">System Diagnosis</h3>
                                    <p className="text-slate-300 italic">"{diagnosis?.summary || "We've analyzed your situation."}"</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Incident Title</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:border-blue-500 outline-none font-bold text-lg"
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest">Detected Category</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {categories.map((cat) => (
                                            <button
                                                key={cat.id}
                                                onClick={() => setFormData({ ...formData, category: cat.id })}
                                                className={`p-4 rounded-xl border-2 transition-all text-left group ${formData.category === cat.id
                                                    ? 'border-blue-500 bg-blue-500/20 shadow-[0_0_20px_rgba(37,99,235,0.2)]'
                                                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                                                    }`}
                                            >
                                                <div className="font-bold group-hover:text-blue-400 transition-colors">{cat.name}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Logistics */}
                    {step === 3 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
                            <div className="text-center mb-8">
                                <h1 className="text-3xl font-bold text-white">Execution Parameters</h1>
                                <p className="text-slate-400">Define location and budgetary constraints.</p>
                            </div>

                            <div className="space-y-6">
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input
                                        type="text"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className="w-full pl-12 pr-6 py-4 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:border-blue-500 outline-none"
                                        placeholder="Full Address"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                        <input
                                            type="datetime-local"
                                            value={formData.preferred_date}
                                            onChange={(e) => setFormData({ ...formData, preferred_date: e.target.value })}
                                            className="w-full pl-12 pr-6 py-4 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                        <input
                                            type="number"
                                            value={formData.budget}
                                            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                                            className="w-full pl-12 pr-6 py-4 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:border-blue-500 outline-none"
                                            placeholder="Estimated Budget"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Recommendations & Submit */}
                    {step === 4 && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                            <div>
                                <h1 className="text-3xl font-bold text-white mb-2">
                                    AI Identified Agents
                                </h1>
                                <p className="text-slate-400">Optimized provider matches based on protocol analysis.</p>
                            </div>

                            {fetchingRecs ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-blue-400 font-bold animate-pulse">Querying Provider Database...</p>
                                </div>
                            ) : recommendations.length > 0 ? (
                                <div className="grid gap-6">
                                    {recommendations.map((prov, index) => (
                                        <div key={prov.id} className="group relative">
                                            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-100 transition duration-500"></div>
                                            <div className="relative p-6 bg-slate-900 border border-slate-700/50 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6 overflow-hidden">
                                                {index === 0 && (
                                                    <div className="absolute top-0 right-0 px-4 py-1 bg-gradient-to-l from-blue-600 to-purple-600 text-[10px] font-bold text-white uppercase tracking-tighter rounded-bl-xl shadow-lg">
                                                        Optimal Match
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-4">
                                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black shrink-0">
                                                        {prov.user?.first_name?.[0] || 'P'}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className="text-xl font-bold">{prov.user?.first_name} {prov.user?.last_name}</h3>
                                                            {prov.verification_status === 'verified' && <CheckCircle className="w-4 h-4 text-blue-400" />}
                                                        </div>
                                                        <div className="flex items-center gap-4 text-sm">
                                                            <span className="flex items-center gap-1 text-yellow-400">
                                                                <Star className="w-4 h-4 fill-current" /> {prov.rating || '5.0'}
                                                            </span>
                                                            <span className="text-slate-500">•</span>
                                                            <span className="text-slate-400">{prov.experience_years || 0} Years Exp.</span>
                                                        </div>
                                                        <div className="mt-2 flex gap-2">
                                                            <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase rounded-md tracking-wider border border-blue-500/20">
                                                                {prov.match_score}% AI Match
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleSubmit(prov.id)}
                                                    className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95"
                                                >
                                                    Select & Request
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-dashed border-slate-700">
                                    <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                                    <p className="text-slate-400">No specific matches found. Broadcasting to open network.</p>
                                </div>
                            )}

                            <div className="pt-6">
                                <button
                                    onClick={() => handleSubmit(null)}
                                    className="w-full py-4 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-colors border border-slate-700"
                                >
                                    Broadcast to Global Network
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between mt-12 pt-8 border-t border-slate-700/50">
                        <button
                            onClick={() => step === 1 ? navigate('/') : prevStep()}
                            className="flex items-center gap-2 px-6 py-3 font-bold transition-colors text-slate-400 hover:text-white"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            {step === 1 ? 'Cancel' : 'Back'}
                        </button>
                        {step > 1 && step < 4 && (
                            <button
                                onClick={nextStep}
                                disabled={!formData.category && step === 2}
                                className="group flex items-center gap-2 px-10 py-3 bg-white text-slate-900 rounded-full font-bold hover:bg-blue-50 transition-all hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                            >
                                Continue
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateRequest;
