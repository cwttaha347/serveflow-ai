import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import {
    Moon, Sun, User, Bell, Shield, Database, LogOut,
    Camera, Mail, MapPin, Phone, Lock, Save, Loader2, Palette
} from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const Settings = () => {
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const { success, error: showError } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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
            const response = await api.get('profile/');
            setUserData(response.data);
        } catch (error) {
            console.error(error);
            showError('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUserData(prev => ({
                ...prev,
                profile: { ...prev.profile, photo: file }
            }));
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);

            // 1. Update basic user info
            await api.patch('users/me/', {
                first_name: userData.first_name,
                last_name: userData.last_name,
                phone: userData.phone
            });

            // 2. Update profile (BIO, Address, Photo)
            const formData = new FormData();
            formData.append('bio', userData.profile?.bio || '');
            formData.append('address', userData.profile?.address || '');
            if (userData.profile?.photo instanceof File) {
                formData.append('photo', userData.profile?.photo);
            }

            await api.patch('profiles/me/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            await fetchProfile(); // Refresh to get proper URLs
            success('Profile updated successfully');
        } catch (error) {
            console.error(error);
            showError('Failed to update profile');
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
            showError('Failed to change password. check current password.');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
                <p className="text-slate-500 animate-pulse">Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <header>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white">Account Settings</h1>
                <p className="text-slate-500 dark:text-slate-400">Manage your profile, security and preferences</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Visual Identity Sidebar */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-8 text-center shadow-sm">
                        <div className="relative inline-block group mb-4">
                            <div className="w-32 h-32 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-xl shadow-blue-500/20 overflow-hidden">
                                {previewImage || userData.profile?.photo ? (
                                    <img
                                        src={previewImage || userData.profile?.photo}
                                        alt="Profile"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    userData.first_name?.[0] || 'U'
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 p-2 bg-white dark:bg-slate-700 rounded-full shadow-lg border border-slate-100 dark:border-slate-600 hover:scale-110 transition-transform cursor-pointer">
                                <Camera className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                />
                            </label>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{userData.first_name} {userData.last_name}</h3>
                        <p className="text-slate-500 text-sm mt-1">@{userData.username || 'user'}</p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <Palette className="w-5 h-5 text-pink-600" />
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Theme</h2>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                {theme === 'light' ? 'Light Mode' : 'Dark Mode'}
                            </span>
                            <button
                                onClick={toggleTheme}
                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${theme === 'dark' ? 'bg-blue-600' : 'bg-slate-200'}`}
                            >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="md:col-span-2 space-y-8">
                    {/* Basic Info */}
                    <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <User className="w-5 h-5 text-blue-600" />
                                <h2 className="font-bold text-slate-900 dark:text-white">Public Profile</h2>
                            </div>
                        </div>

                        <form onSubmit={handleUpdateProfile} className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">First Name</label>
                                    <input
                                        type="text"
                                        value={userData.first_name}
                                        onChange={(e) => setUserData({ ...userData, first_name: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Last Name</label>
                                    <input
                                        type="text"
                                        value={userData.last_name}
                                        onChange={(e) => setUserData({ ...userData, last_name: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        readOnly
                                        value={userData.email}
                                        className="w-full px-4 py-3 pl-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 font-medium cursor-not-allowed"
                                    />
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 italic font-medium">To change your email, please contact platform support.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Phone Number</label>
                                    <div className="relative">
                                        <input
                                            type="tel"
                                            value={userData.phone || ''}
                                            onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                                            className="w-full px-4 py-3 pl-11 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                        />
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Location / Address</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={userData.profile?.address || ''}
                                            onChange={(e) => setUserData({ ...userData, profile: { ...(userData.profile || {}), address: e.target.value } })}
                                            className="w-full px-4 py-3 pl-11 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                        />
                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Professional Bio</label>
                                <textarea
                                    rows="4"
                                    value={userData.profile?.bio || ''}
                                    onChange={(e) => setUserData({ ...userData, profile: { ...(userData.profile || {}), bio: e.target.value } })}
                                    placeholder="Tell us a bit about yourself..."
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium resize-none"
                                />
                            </div>

                            <div className="flex justify-end pt-4">
                                <button
                                    disabled={saving}
                                    className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save Profile Changes
                                </button>
                            </div>
                        </form>
                    </section>

                    {/* Security */}
                    <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                            <Lock className="w-5 h-5 text-amber-500" />
                            <h2 className="font-bold text-slate-900 dark:text-white">Security & Password</h2>
                        </div>
                        <form onSubmit={handleChangePassword} className="p-8 space-y-6">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Current Password</label>
                                <input
                                    type="password"
                                    required
                                    value={passwords.current}
                                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">New Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={passwords.new}
                                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Confirm New Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={passwords.confirm}
                                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button
                                    disabled={saving}
                                    className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
                                >
                                    Update Password
                                </button>
                            </div>
                        </form>
                    </section>

                    {/* Danger Zone */}
                    <section className="bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/30 p-8">
                        <div className="flex items-center gap-3 mb-4">
                            <Shield className="w-5 h-5 text-red-600" />
                            <h2 className="font-black text-red-600 uppercase tracking-widest">System Access</h2>
                        </div>
                        <p className="text-sm text-red-600/70 mb-6 font-medium italic">Logging out will terminate your current secure session. Make sure you have saved all changes.</p>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-500/20"
                        >
                            <LogOut className="w-4 h-4" />
                            Secure Logout
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Settings;
