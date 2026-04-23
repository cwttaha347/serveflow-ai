import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Send, Sparkles, Loader2, CheckCircle2, MapPin, Gauge } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ZeroTouchRequest = () => {
    const [description, setDescription] = useState('');
    const [images, setImages] = useState([]);
    const [status, setStatus] = useState('IDLE'); // IDLE, UPLOADING, ANALYZING, MATCHING, COMPLETE
    const [progress, setProgress] = useState(0);
    const [location, setLocation] = useState(null);
    const navigate = useNavigate();

    const onDrop = useCallback(acceptedFiles => {
        setImages(prev => [...prev, ...acceptedFiles.map(file => Object.assign(file, {
            preview: URL.createObjectURL(file)
        }))]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
        onDrop, 
        accept: {'image/*': []},
        maxFiles: 5
    });

    const getUserLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
            });
        }
    };

    const handleSubmit = async () => {
        if (!description) return;
        setStatus('UPLOADING');
        setProgress(10);

        const formData = new FormData();
        formData.append('description', description);
        images.forEach(img => formData.append('images', img));
        if (location) {
            formData.append('latitude', location.lat);
            formData.append('longitude', location.lon);
        }

        try {
            // Call v2 Autonomous Endpoint
            const res = await axios.post('/api/requests/create-v2/', formData, {
                onUploadProgress: (p) => setProgress(10 + (p.loaded / p.total) * 20)
            });

            setStatus('ANALYZING');
            setProgress(40);
            
            // Artificial delay to show AI processing (in real app, use SSE/Polling)
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 95) {
                        clearInterval(interval);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 300);

            // Simulate the autonomous transition
            setTimeout(() => {
                setStatus('MATCHING');
                setProgress(80);
                setTimeout(() => {
                    setStatus('COMPLETE');
                    setProgress(100);
                    setTimeout(() => navigate('/dashboard'), 1500);
                }, 2000);
            }, 4000);

        } catch (err) {
            console.error('Submission failed', err);
            setStatus('IDLE');
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl relative">
                {/* Visual Flair */}
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 blur-[100px] rounded-full" />
                <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 blur-[100px] rounded-full" />

                <AnimatePresence mode="wait">
                    {status === 'IDLE' ? (
                        <motion.div 
                            key="input"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="space-y-8"
                        >
                            <div className="text-center space-y-2">
                                <h1 className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-400 to-slate-600 tracking-tighter">
                                    What can we solve today?
                                </h1>
                                <p className="text-slate-500 font-medium">Zero friction. Just describe and let ServeFlow AI handle the rest.</p>
                            </div>

                            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
                                <textarea 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="e.g. My kitchen sink is leaking and there's water everywhere. I need someone ASAP."
                                    className="w-full h-40 bg-transparent text-xl text-white placeholder-slate-700 outline-none resize-none font-medium"
                                />

                                {/* Image Strip */}
                                <div className="flex flex-wrap gap-3 mt-4">
                                    {images.map((file, i) => (
                                        <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden group border border-slate-700">
                                            <img src={file.preview} className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    
                                    <div {...getRootProps()} className={`w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all ${
                                        isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 hover:border-slate-700'
                                    }`}>
                                        <input {...getInputProps()} />
                                        <Upload className="text-slate-600" size={20} />
                                    </div>
                                </div>

                                <div className="mt-8 flex items-center justify-between border-t border-slate-800/50 pt-6">
                                    <button 
                                        onClick={getUserLocation}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                                            location ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                    >
                                        <MapPin size={14} />
                                        {location ? 'Location Secured' : 'Attach Location'}
                                    </button>

                                    <button 
                                        onClick={handleSubmit}
                                        disabled={!description}
                                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]"
                                    >
                                        Request Now
                                        <Send size={18} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="status"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center gap-12"
                        >
                            <div className="relative w-64 h-64 flex items-center justify-center">
                                {/* Outer Ring */}
                                <div className="absolute inset-0 border-4 border-slate-900 rounded-full" />
                                <motion.div 
                                    className="absolute inset-0 border-4 border-blue-500 rounded-full"
                                    style={{ clipPath: `inset(0 0 0 ${100 - progress}%)` }} // Simple progress visual
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                />
                                
                                {/* Inner Core */}
                                <div className="w-48 h-48 bg-slate-900 rounded-full flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
                                    <AnimatePresence mode="wait">
                                        <motion.div 
                                            key={status}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="flex flex-col items-center gap-2"
                                        >
                                            {status === 'ANALYZING' && <Sparkles className="text-blue-400 animate-pulse" size={40} />}
                                            {status === 'MATCHING' && <Gauge className="text-indigo-400 animate-bounce" size={40} />}
                                            {status === 'UPLOADING' && <Loader2 className="text-slate-400 animate-spin" size={40} />}
                                            {status === 'COMPLETE' && <CheckCircle2 className="text-green-400" size={40} />}
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{status}</span>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </div>

                            <div className="w-full max-w-sm space-y-4">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <h2 className="text-xl font-bold text-white">
                                            {status === 'UPLOADING' && 'Ingesting Assets...'}
                                            {status === 'ANALYZING' && 'AI Cognitive Analysis...'}
                                            {status === 'MATCHING' && 'Finding Optimal Providers...'}
                                            {status === 'COMPLETE' && 'Pipeline Successful.'}
                                        </h2>
                                        <p className="text-xs text-slate-500">Autonomous Orchestration v2.0</p>
                                    </div>
                                    <span className="text-blue-500 font-mono font-bold">{Math.round(progress)}%</span>
                                </div>
                                <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                                    <motion.div 
                                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-600"
                                        animate={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className={`w-2 h-2 rounded-full ${progress >= (i * 25) ? 'bg-blue-500' : 'bg-slate-800'}`} />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ZeroTouchRequest;
