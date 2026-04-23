import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';

const SkillAutocompleteInput = ({ value, onChange, placeholder, className }) => {
    const [inputValue, setInputValue] = useState(value || '');
    const [suggestion, setSuggestion] = useState('');
    const [loading, setLoading] = useState(false);
    const [fullData, setFullData] = useState(null);
    const debounceTimer = useRef(null);

    const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8001';

    useEffect(() => {
        if (inputValue !== value) {
            setInputValue(value || '');
        }
    }, [value]);

    const fetchSuggestion = async (text) => {
        if (text.length < 5) {
            setSuggestion('');
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post(`${AI_SERVICE_URL}/ai/skill-complete`, {
                user_input: text
            });
            
            if (res.data.inline_completion) {
                setSuggestion(res.data.inline_completion);
            }
            setFullData(res.data);
        } catch (err) {
            console.error('Autocomplete failed', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        onChange(newValue);

        // Reset suggestion if user types past it or deletes
        setSuggestion('');

        // Debounce AI call
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            fetchSuggestion(newValue);
        }, 400);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Tab' && suggestion) {
            e.preventDefault();
            const completedValue = inputValue + suggestion;
            setInputValue(completedValue);
            onChange(completedValue);
            setSuggestion('');
        }
    };

    return (
        <div className={`relative group ${className}`}>
            <div className="relative">
                {/* AI Pulse Effect when loading */}
                {loading && (
                    <motion.div 
                        layoutId="ai-pulse"
                        className="absolute -inset-1 bg-blue-500/20 blur-md rounded-lg animate-pulse"
                    />
                )}
                
                {/* Ghost Text Suggestion */}
                {suggestion && (
                    <div className="absolute inset-0 pointer-events-none px-4 py-3 flex text-lg">
                        <span className="opacity-0">{inputValue}</span>
                        <span className="text-slate-500 animate-in fade-in slide-in-from-left-2 duration-300">
                            {suggestion}
                        </span>
                        <span className="ml-2 text-[10px] bg-slate-800 text-slate-400 px-1 rounded flex items-center h-4 self-center border border-slate-700">
                            TAB
                        </span>
                    </div>
                )}

                <textarea
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full h-32 bg-slate-900 border border-slate-800 text-white rounded-xl p-4 text-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all relative z-10"
                />

                <div className="absolute top-2 right-2 z-20 flex gap-2">
                    {loading ? (
                        <Loader2 className="text-blue-500 animate-spin" size={18} />
                    ) : suggestion ? (
                        <Sparkles className="text-blue-400 animate-pulse" size={18} />
                    ) : null}
                </div>
            </div>

            {/* AI Insights Panel (Expansion) */}
            <AnimatePresence>
                {fullData && !loading && (
                    <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="mt-2 bg-slate-900/50 border border-slate-800 p-3 rounded-xl flex items-center gap-3"
                    >
                        <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">AI Recommendation</p>
                            <p className="text-xs text-slate-300 line-clamp-1">{fullData.suggested_title}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {fullData.suggested_tags?.slice(0, 2).map((tag, i) => (
                                <span key={i} className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SkillAutocompleteInput;
