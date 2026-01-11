import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const navigate = useNavigate();
    const { success, error: showError } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('users/forgot_password/', { email });
            setSubmitted(true);
            success('Reset link sent to your email');
        } catch (err) {
            console.error('Error sending reset link:', err);
            showError('Failed to send reset link. Please try again.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
                <button
                    onClick={() => navigate('/login')}
                    className="flex items-center text-slate-500 hover:text-primary mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Login
                </button>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Reset Password</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Enter your email to receive reset instructions</p>
                </div>

                {submitted ? (
                    <div className="bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 p-6 rounded-xl text-center">
                        <Mail className="w-12 h-12 mx-auto mb-4 text-green-500" />
                        <h3 className="font-bold text-lg mb-2">Check your email</h3>
                        <p>We have sent a password reset link to <span className="font-semibold">{email}</span></p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder="you@example.com"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-primary text-white py-2 rounded-lg font-semibold hover:bg-slate-800 transition-colors"
                        >
                            Send Reset Link
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;
