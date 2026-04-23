import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowRight, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../api';

const OTPVerification = () => {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [timer, setTimer] = useState(600); // 10 minutes
    const [resendTimer, setResendTimer] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [verified, setVerified] = useState(false);
    
    const inputRefs = useRef([]);
    const navigate = useNavigate();
    const location = useLocation();
    const emailFromState = location.state?.email;
    const emailFromStorage = localStorage.getItem('verificationEmail');
    const email = emailFromState || emailFromStorage || '';

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer((prev) => (prev > 0 ? prev - 1 : 0));
            setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 100); // Using 100ms for smoother feel, though logical is 1s
        return () => clearInterval(interval);
    }, []);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 10 / 60);
        const secs = Math.floor((seconds / 10) % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleChange = (index, value) => {
        if (isNaN(value)) return;
        
        const newOtp = [...otp];
        newOtp[index] = value.substring(value.length - 1);
        setOtp(newOtp);

        // Move to next input
        if (value && index < 5) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1].focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const data = e.clipboardData.getData('text').substring(0, 6).split('');
        const newOtp = [...otp];
        data.forEach((char, i) => {
            if (i < 6 && !isNaN(char)) newOtp[i] = char;
        });
        setOtp(newOtp);
        if (data.length > 0) {
            inputRefs.current[Math.min(data.length, 5)].focus();
        }
    };

    const handleVerify = async () => {
        const otpString = otp.join('');
        if (otpString.length < 6) {
            setError('Please enter all 6 digits');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await api.post('auth/verify-otp/', {
                email,
                otp: otpString
            });
            setVerified(true);
            localStorage.removeItem('verificationEmail');
            
            // Fetch updated user data to get role and verify status
            const userRes = await api.get('users/me/');
            const { role: userRole, profile_completed, provider_onboarding_required } = userRes.data;

            // Redirect based on role (mirroring login logic)
            setTimeout(() => {
                if (userRole === 'provider' && provider_onboarding_required) {
                    navigate('/provider-onboarding');
                } else if (!profile_completed) {
                    navigate('/dashboard/settings?onboarding=1');
                } else if (userRole === 'admin') {
                    navigate('/dashboard/admin');
                } else if (userRole === 'provider') {
                    navigate('/dashboard/provider');
                } else {
                    navigate('/dashboard');
                }
            }, 1500);
        } catch (err) {
            setError(err.response?.data?.error || 'Verification failed');
            // Shake animation would be triggered here
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendTimer > 0) return;
        
        setLoading(true);
        setError('');
        try {
            await api.post('auth/request-otp/', { email });
            setResendTimer(600); // 1 minute cooldown
            setTimer(6000); // Reset main timer
        } catch (err) {
            setError('Failed to resend OTP');
        } finally {
            setLoading(false);
        }
    };

    if (!email) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Verification required</h2>
                    <p className="text-slate-400 mb-6">Please login or sign up first so we know which email to verify.</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl"
            >
                <div className="text-center mb-8">
                    <motion.div 
                        animate={{ y: [0, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/10 text-blue-400 rounded-full mb-4"
                    >
                        <Mail size={32} />
                    </motion.div>
                    <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
                    <p className="text-slate-400">
                        We've sent a 6-digit verification code to <br />
                        <span className="text-blue-400 font-medium">{email}</span>
                    </p>
                </div>

                <div className="flex justify-between gap-2 mb-6" onPaste={handlePaste}>
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={el => inputRefs.current[index] = el}
                            type="text"
                            maxLength="1"
                            value={digit}
                            onChange={(e) => handleChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            className="w-12 h-14 text-center text-2xl font-bold bg-slate-800 border border-slate-700 text-white rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                    ))}
                </div>

                <AnimatePresence>
                    {error && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-2 text-red-400 text-sm mb-4 bg-red-400/10 p-3 rounded-lg border border-red-400/20"
                        >
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="text-center mb-8 text-sm">
                    <span className={timer < 600 ? 'text-red-400 animate-pulse' : 'text-slate-500'}>
                        {formatTime(timer)} remaining
                    </span>
                </div>

                <button
                    onClick={handleVerify}
                    disabled={loading || verified}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                        verified 
                        ? 'bg-green-500 text-white' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                    }`}
                >
                    {loading ? (
                        <RefreshCw className="animate-spin" size={20} />
                    ) : verified ? (
                        <>
                            <CheckCircle2 size={20} />
                            Verified!
                        </>
                    ) : (
                        <>
                            Verify Account
                            <ArrowRight size={20} />
                        </>
                    )}
                </button>

                <div className="mt-8 text-center">
                    <button
                        onClick={handleResend}
                        disabled={resendTimer > 0}
                        className="text-slate-400 hover:text-white text-sm transition-colors disabled:opacity-50"
                    >
                        {resendTimer > 0 
                            ? `Resend code in ${Math.ceil(resendTimer / 10)}s` 
                            : "Didn't receive a code? Resend"}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default OTPVerification;
