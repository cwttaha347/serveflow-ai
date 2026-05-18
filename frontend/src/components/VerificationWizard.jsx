import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, CheckCircle2, ShieldCheck, CreditCard, User, FileBadge, AlertTriangle, Loader2 } from 'lucide-react';
import axios from 'axios';
import { prepareImageForUpload } from '../utils/imageUpload';
import { getImagePrepErrorMessage, getImageUploadErrorMessage } from '../utils/uploadErrors';

const VerificationWizard = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [idFront, setIdFront] = useState(null);
    const [selfie, setSelfie] = useState(null);
    const [cert, setCert] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [uploadError, setUploadError] = useState(null);

    const steps = [
        { id: 1, name: 'Identity ID', icon: CreditCard },
        { id: 2, name: 'Liveness', icon: User },
        { id: 3, name: 'Certifications', icon: FileBadge },
        { id: 4, name: 'AI Audit', icon: ShieldCheck },
    ];

    const handleFileUpload = async (type, rawFile) => {
        if (!rawFile) return;
        setUploadError(null);
        try {
            const { file } = await prepareImageForUpload(rawFile);
            if (type === 'id') setIdFront(file);
            if (type === 'selfie') setSelfie(file);
            if (type === 'cert') setCert(file);
            setStep(prev => prev + 1);
        } catch (err) {
            setUploadError(getImagePrepErrorMessage(err));
        }
    };

    const runAIAudit = async () => {
        setLoading(true);
        const formData = new FormData();
        formData.append('id_front', idFront);
        formData.append('selfie', selfie);
        if (cert) formData.append('certificate', cert);

        try {
            // This endpoint will be implemented in the next step in Django
            const res = await axios.post('/api/providers/verify-bundle/', formData);
            setResult(res.data);
            setStep(4);
        } catch (err) {
            console.error('Audit failed', err);
            setUploadError(getImageUploadErrorMessage(err, 'Verification upload failed.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header / Stepper */}
            <div className="bg-slate-900 px-6 py-4 flex justify-between border-b border-slate-800">
                {steps.map((s) => (
                    <div key={s.id} className="flex flex-col items-center gap-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            step >= s.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'
                        }`}>
                            <s.icon size={16} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-tighter ${
                            step >= s.id ? 'text-blue-400' : 'text-slate-600'
                        }`}>{s.name}</span>
                    </div>
                ))}
            </div>

            <motion.div className="p-10 min-h-[400px] flex flex-col items-center justify-center">
                {uploadError && (
                    <p className="mb-4 text-sm text-red-400 text-center px-4">{uploadError}</p>
                )}
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div 
                            key="step1"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="text-center"
                        >
                            <h3 className="text-2xl font-bold text-white mb-2">Upload Government ID</h3>
                            <p className="text-slate-400 mb-8">Front of Passport, Driver License, or National ID</p>
                            <label className="group cursor-pointer relative block">
                                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                                <div className="relative w-72 h-44 bg-slate-900 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center hover:border-blue-500 transition-all">
                                    <Upload className="text-slate-500 group-hover:text-blue-400 mb-2" size={32} />
                                    <span className="text-xs text-slate-500">Click to upload or drag & drop</span>
                                </div>
                                <input type="file" className="hidden" onChange={(e) => handleFileUpload('id', e.target.files[0])} />
                            </label>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div key="step2" className="text-center">
                            <h3 className="text-2xl font-bold text-white mb-2">Selfie Verification</h3>
                            <p className="text-slate-400 mb-8">Take a clear photo of yourself holding your ID</p>
                            <label className="group cursor-pointer">
                                <div className="w-56 h-56 bg-slate-900 border-2 border-dashed border-slate-700 rounded-full flex flex-col items-center justify-center hover:border-blue-500 transition-all overflow-hidden relative">
                                    <User className="text-slate-500" size={48} />
                                    <div className="absolute bottom-4 bg-blue-600 px-3 py-1 rounded-full text-[10px] font-bold text-white">UPLOAD PHOTO</div>
                                </div>
                                <input type="file" className="hidden" onChange={(e) => handleFileUpload('selfie', e.target.files[0])} />
                            </label>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div key="step3" className="text-center">
                            <h3 className="text-2xl font-bold text-white mb-2">Certifications</h3>
                            <p className="text-slate-400 mb-8">Optional: Professional licenses or trade certificates</p>
                            <div className="flex flex-col gap-4 items-center">
                                <label className="w-64 py-4 border border-slate-700 rounded-xl hover:bg-slate-900 cursor-pointer text-slate-300 font-medium">
                                    Select File
                                    <input type="file" className="hidden" onChange={(e) => setCert(e.target.files[0])} />
                                </label>
                                <button 
                                    onClick={runAIAudit}
                                    className="w-64 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 shadow-xl shadow-blue-600/20"
                                >
                                    {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Start AI Audit'}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 4 && result && (
                        <motion.div key="step4" className="w-full">
                            <div className="text-center mb-8">
                                <div className={`inline-flex p-3 rounded-full mb-4 ${
                                    result.status === 'APPROVED' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                                }`}>
                                    <ShieldCheck size={40} />
                                </div>
                                <h3 className="text-2xl font-bold text-white">Trust Audit Complete</h3>
                                <p className="text-slate-400">Gemini 1.5 Pro has analyzed your documentation</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Authenticity</p>
                                    <p className="text-lg font-bold text-white">{result.id_score}%</p>
                                </div>
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Liveness</p>
                                    <p className="text-lg font-bold text-white">{result.liveness_score}%</p>
                                </div>
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 col-span-2">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Overall TrustScore</p>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${result.trust_score}%` }}
                                                className="h-full bg-blue-500"
                                            />
                                        </div>
                                        <span className="font-bold text-white">{result.trust_score}</span>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={() => onComplete && onComplete(result)}
                                className="w-full mt-8 py-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700"
                            >
                                Continue to Dashboard
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default VerificationWizard;
