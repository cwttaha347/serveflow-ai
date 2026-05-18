import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Moon, Sun, User, Shield, Briefcase,
    Camera, Mail, MapPin, Phone, Lock, Save, Loader2, Palette, CheckCircle2, ChevronRight
} from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { prepareImageForUpload } from '../utils/imageUpload';
import {
    getImagePrepErrorMessage,
    getImageUploadErrorMessage,
    IMAGE_RESIZED_TOAST,
} from '../utils/uploadErrors';
import { resolveMediaUrl } from '../utils/mediaUrl';

const Settings = () => {
    const { theme, setTheme } = useTheme();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { success, error: showError, warning: showWarning } = useToast();
    const { user: authUser, applyMeData, refreshUser } = useAuth();
    const { refreshSettings } = useSettings();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('profile');

    const [userData, setUserData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        profile: {
            bio: '',
            address: '',
            photo: null
        }
    });
    const [previewImage, setPreviewImage] = useState(null);

    const [passwords, setPasswords] = useState({
        current: '',
        new: '',
        confirm: ''
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const response = await api.get('users/me/');
            setUserData(response.data);
            applyMeData(response.data);
        } catch (error) {
            console.error(error);
            showError('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = async (e) => {
        const rawFile = e.target.files[0];
        if (!rawFile) return;
        e.target.value = '';
        try {
            const { file, compressed } = await prepareImageForUpload(rawFile);
            setUserData(prev => ({
                ...prev,
                profile: { ...prev.profile, photo: file }
            }));
            const reader = new FileReader();
            reader.onloadend = () => setPreviewImage(reader.result);
            reader.readAsDataURL(file);
            if (compressed) {
                showWarning(IMAGE_RESIZED_TOAST);
            }
        } catch (err) {
            showError(getImagePrepErrorMessage(err));
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);

            await api.patch('users/me/', {
                first_name: userData.first_name,
                last_name: userData.last_name,
                phone: userData.phone
            });

            const formData = new FormData();
            formData.append('bio', userData.profile?.bio || '');
            formData.append('address', userData.profile?.address || '');
            if (userData.profile?.photo instanceof File) {
                formData.append('photo', userData.profile?.photo);
            }

            await api.patch('profiles/me/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const profileRes = await api.get('users/me/');
            setUserData(profileRes.data);
            setPreviewImage(null);
            const updatedUser = applyMeData(profileRes.data);
            await refreshUser();
            window.dispatchEvent(new CustomEvent('serveflow:profile-updated'));
            refreshSettings();

            if (updatedUser?.profile_completed) {
                if (searchParams.get('onboarding') === '1') {
                    const nextParams = new URLSearchParams(searchParams);
                    nextParams.delete('onboarding');
                    setSearchParams(nextParams, { replace: true });
                }
                const welcomeKey = 'profileWelcomeShown';
                if (!localStorage.getItem(welcomeKey)) {
                    localStorage.setItem(welcomeKey, '1');
                    success('Welcome! Your profile is complete.');
                } else {
                    success('Profile updated successfully');
                }
            } else {
                success('Profile updated successfully');
            }
        } catch (error) {
            console.error(error);
            const fieldErrors = error?.response?.data?.field_errors || {};
            const firstField = Object.keys(fieldErrors)[0];
            const firstMsg = firstField ? String(fieldErrors[firstField]?.[0] || fieldErrors[firstField]) : '';
            showError(
                firstMsg ||
                    getImageUploadErrorMessage(error, error?.response?.data?.error || 'Failed to update profile')
            );
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            showError('New passwords do not match');
            return;
        }
        try {
            setSaving(true);
            await api.post('auth/change-password/', {
                old_password: passwords.current,
                new_password: passwords.new
            });
            success('Password changed successfully');
            setPasswords({ current: '', new: '', confirm: '' });
        } catch (error) {
            console.error(error);
            showError('Failed to change password');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 font-bold animate-pulse">Syncing your preferences...</p>
            </div>
        );
    }

    const tabs = [
        { id: 'profile', label: 'Personal Info', icon: User },
        { id: 'security', label: 'Security', icon: Lock },
        ...((authUser?.role || userData?.role) === 'provider' ? [{ id: 'provider', label: 'Professional Profile', icon: Briefcase }] : []),
        { id: 'appearance', label: 'Look & Feel', icon: Palette },
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12 px-4 sm:px-6 lg:px-8">
            {authUser && authUser.profile_completed === false && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-5 py-4"
                >
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                        Complete phone number and address to unlock the platform.
                    </p>
                </motion.div>
            )}
            <header>
                <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Settings</h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Manage your account and app preferences</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* Navigation Sidebar */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="glass-card p-4 rounded-3xl sm:rounded-[2.5rem] bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/5 shadow-xl">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-4 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl sm:rounded-[1.5rem] font-bold transition-all ${activeTab === tab.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}
                            >
                                <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'scale-110' : ''}`} />
                                <span className="flex-1 text-left">{tab.label}</span>
                                {activeTab === tab.id && <ChevronRight className="w-4 h-4" />}
                            </button>
                        ))}
                    </div>

                    {/* Quick Stats/Profile Preview */}
                    <div className="glass-card p-6 sm:p-8 rounded-3xl sm:rounded-[2.5rem] text-center border border-slate-200 dark:border-white/5 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl">
                        <div className="relative inline-block mx-auto mb-6">
                            <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-2xl overflow-hidden ring-4 ring-white dark:ring-slate-800">
                                {previewImage || userData.profile?.photo ? (
                                    <img
                                        src={previewImage || resolveMediaUrl(userData.profile?.photo, { cacheBust: userData.id })}
                                        alt="Profile"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    userData.first_name?.[0] || 'U'
                                )}
                            </div>
                            <label className="absolute -bottom-2 -right-2 p-2.5 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-white/10 hover:scale-110 transition-transform cursor-pointer">
                                <Camera className="w-4 h-4 text-blue-600" />
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                            </label>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white truncate">
                            {userData.first_name} {userData.last_name}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">@{userData.username}</p>
                    </div>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-9">
                    <AnimatePresence mode="wait">
                        {activeTab === 'profile' && (
                            <motion.div
                                key="profile"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="glass-card p-6 sm:p-10 rounded-3xl sm:rounded-[3rem] border border-slate-200 dark:border-white/5 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-2xl">
                                    <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-100 dark:border-white/5">
                                        <div className="p-3 bg-blue-600/10 rounded-2xl">
                                            <User className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Personal Information</h2>
                                            <p className="text-sm text-slate-500 font-medium">Update your public profile details</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleUpdateProfile} className="space-y-8">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-4">First Name</label>
                                                <input
                                                    type="text"
                                                    value={userData.first_name}
                                                    onChange={(e) => setUserData({ ...userData, first_name: e.target.value })}
                                                    className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-transparent focus:border-blue-500 outline-none transition-all dark:text-white font-bold"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-4">Last Name</label>
                                                <input
                                                    type="text"
                                                    value={userData.last_name}
                                                    onChange={(e) => setUserData({ ...userData, last_name: e.target.value })}
                                                    className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-transparent focus:border-blue-500 outline-none transition-all dark:text-white font-bold"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-4">Email Address</label>
                                            <div className="relative group">
                                                <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <input
                                                    type="email"
                                                    readOnly
                                                    value={userData.email}
                                                    className="w-full pl-12 sm:pl-14 pr-4 sm:pr-6 py-3.5 sm:py-4 bg-slate-100/50 dark:bg-slate-800/30 rounded-2xl border border-transparent text-slate-400 font-bold cursor-not-allowed"
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-400 ml-4 italic font-medium">Email is permanent for security reasons.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-4">Phone Number</label>
                                                <div className="relative group">
                                                    <Phone className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                    <input
                                                        type="tel"
                                                        value={userData.phone || ''}
                                                        onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                                                        className="w-full pl-12 sm:pl-14 pr-4 sm:pr-6 py-3.5 sm:py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-transparent focus:border-blue-500 outline-none transition-all dark:text-white font-bold"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-4">Location</label>
                                                <div className="relative group">
                                                    <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        value={userData.profile?.address || ''}
                                                        onChange={(e) => setUserData({ ...userData, profile: { ...(userData.profile || {}), address: e.target.value } })}
                                                        className="w-full pl-12 sm:pl-14 pr-4 sm:pr-6 py-3.5 sm:py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-transparent focus:border-blue-500 outline-none transition-all dark:text-white font-bold"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-4">About You</label>
                                            <textarea
                                                rows="4"
                                                value={userData.profile?.bio || ''}
                                                onChange={(e) => setUserData({ ...userData, profile: { ...(userData.profile || {}), bio: e.target.value } })}
                                                placeholder="Write a few lines about yourself..."
                                                className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-transparent focus:border-blue-500 outline-none transition-all dark:text-white font-medium resize-none"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="w-full sm:w-auto px-10 py-5 bg-blue-600 text-white rounded-[1.5rem] font-black hover:bg-blue-500 shadow-xl shadow-blue-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
                                        >
                                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                            Save Changes
                                        </button>
                                    </form>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'security' && (
                            <motion.div
                                key="security"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="glass-card p-6 sm:p-10 rounded-3xl sm:rounded-[3rem] border border-slate-200 dark:border-white/5 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-2xl">
                                    <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-100 dark:border-white/5">
                                        <div className="p-3 bg-amber-500/10 rounded-2xl">
                                            <Shield className="w-6 h-6 text-amber-500" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Security Settings</h2>
                                            <p className="text-sm text-slate-500 font-medium">Keep your account secure</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleChangePassword} className="space-y-8">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-4">Current Password</label>
                                            <div className="relative group">
                                                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <input
                                                    type="password"
                                                    required
                                                    value={passwords.current}
                                                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                                                    className="w-full pl-12 sm:pl-14 pr-4 sm:pr-6 py-3.5 sm:py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-transparent focus:border-blue-500 outline-none transition-all dark:text-white font-bold"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-4">New Password</label>
                                                <div className="relative group">
                                                    <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                    <input
                                                        type="password"
                                                        required
                                                        value={passwords.new}
                                                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                                        className="w-full pl-12 sm:pl-14 pr-4 sm:pr-6 py-3.5 sm:py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-transparent focus:border-blue-500 outline-none transition-all dark:text-white font-bold"
                                                        placeholder="••••••••"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-4">Confirm New Password</label>
                                                <div className="relative group">
                                                    <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                    <input
                                                        type="password"
                                                        required
                                                        value={passwords.confirm}
                                                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                                        className="w-full pl-12 sm:pl-14 pr-4 sm:pr-6 py-3.5 sm:py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-transparent focus:border-blue-500 outline-none transition-all dark:text-white font-bold"
                                                        placeholder="••••••••"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="w-full sm:w-auto px-10 py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[1.5rem] font-black hover:opacity-90 shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
                                        >
                                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                                            Update Password
                                        </button>
                                    </form>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'appearance' && (
                            <motion.div
                                key="appearance"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="glass-card p-6 sm:p-10 rounded-3xl sm:rounded-[3rem] border border-slate-200 dark:border-white/5 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-2xl">
                                    <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-100 dark:border-white/5">
                                        <div className="p-3 bg-purple-600/10 rounded-2xl">
                                            <Palette className="w-6 h-6 text-purple-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Look & Feel</h2>
                                            <p className="text-sm text-slate-500 font-medium">Customize your visual experience</p>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <button
                                                onClick={() => setTheme('light')}
                                                className={`p-6 sm:p-8 rounded-[2rem] border-2 transition-all text-left group ${theme === 'light'
                                                        ? 'border-blue-600 bg-blue-50 shadow-lg'
                                                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                                                    }`}
                                            >
                                                <div className={`p-4 rounded-2xl w-fit mb-6 ${theme === 'light' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:text-blue-600 transition-colors'}`}>
                                                    <Sun className="w-8 h-8" />
                                                </div>
                                                <h3 className="text-xl font-black text-slate-900">Light Mode</h3>
                                                <p className="text-sm text-slate-500 font-medium mt-1">Perfect for bright environments</p>
                                                {theme === 'light' && <CheckCircle2 className="w-6 h-6 text-blue-600 mt-4" />}
                                            </button>

                                            <button
                                                onClick={() => setTheme('dark')}
                                                className={`p-6 sm:p-8 rounded-[2rem] border-2 transition-all text-left group ${theme === 'dark'
                                                        ? 'border-blue-600 bg-blue-900/20 shadow-lg'
                                                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                                                    }`}
                                            >
                                                <div className={`p-4 rounded-2xl w-fit mb-6 ${theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500 group-hover:text-blue-600 transition-colors'}`}>
                                                    <Moon className="w-8 h-8" />
                                                </div>
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white">Dark Mode</h3>
                                                <p className="text-sm text-slate-500 font-medium mt-1">Easy on the eyes, premium feel</p>
                                                {theme === 'dark' && <CheckCircle2 className="w-6 h-6 text-blue-600 mt-4" />}
                                            </button>
                                        </div>

                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-white/5">
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                                Pro-tip: Dark mode saves battery on OLED screens and reduces eye strain during late-night sessions.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                        {activeTab === 'provider' && (
                            <motion.div
                                key="provider"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="glass-card p-6 sm:p-10 rounded-3xl sm:rounded-[3rem] border border-slate-200 dark:border-white/5 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-2xl">
                                    <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-100 dark:border-white/5">
                                        <div className="p-3 bg-indigo-500/10 rounded-2xl">
                                            <Briefcase className="w-6 h-6 text-indigo-500" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Professional Profile</h2>
                                            <p className="text-sm text-slate-500 font-medium">Manage your skills, categories, and business details</p>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2rem] border border-slate-100 dark:border-white/5 text-center">
                                        <p className="text-slate-600 dark:text-slate-300 font-medium mb-8 leading-relaxed">
                                            Your professional business settings are managed in a separate workspace to keep things organized. 
                                            This includes your verification status, categories of work, and specialist skills.
                                        </p>
                                        
                                        <button
                                            onClick={() => navigate('/dashboard/provider/profile')}
                                            className="inline-flex items-center gap-3 px-10 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black hover:bg-indigo-500 shadow-xl shadow-indigo-600/30 transition-all active:scale-[0.98]"
                                        >
                                            Go to Pro Workspace
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default Settings;
