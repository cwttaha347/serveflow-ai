import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Shield, Globe, Star, CheckCircle, User, ArrowRight, Play, Menu, X, ChevronRight } from 'lucide-react';
import Hero3D from '../components/Hero3D';
import api from '../api';
import { useSettings } from '../context/SettingsContext';

const Landing = () => {
    const { settings } = useSettings();
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const response = await api.get('categories/');
            setCategories(response.data.filter(c => c.is_active));
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        // Removed automatic redirect to keep homepage accessible
    }, []);

    const features = [
        {
            icon: <Zap className="w-6 h-6 text-yellow-400" />,
            title: "AI-Powered Matching",
            desc: "Our Gemini AI analyzes your request to find the perfect provider instantly."
        },
        {
            icon: <Shield className="w-6 h-6 text-green-400" />,
            title: "Verified Providers",
            desc: "Every professional is thoroughly vetted and background checked."
        },
        {
            icon: <Globe className="w-6 h-6 text-blue-400" />,
            title: "Real-time Tracking",
            desc: "Track your service provider's location and status in real-time."
        }
    ];

    // Categories are now fetched from API

    return (
        <div className="min-h-screen bg-slate-900 text-white overflow-x-hidden font-sans selection:bg-blue-500 selection:text-white">

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-blob"></div>
                <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
            </div>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden min-h-screen flex items-center">

                {/* 3D Background */}
                <Hero3D />

                {/* CSS Animated Background (Fallback/Underlay) */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-blob"></div>
                    <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
                    <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
                </div>

                {/* Overlay Gradient for Readability */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/0 via-slate-900/60 to-slate-900 pointer-events-none z-0"></div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">

                        {/* Hero Content */}
                        <div className="space-y-8 animate-in slide-in-from-left-10 duration-1000">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-blue-500/30 text-blue-300 text-sm font-medium backdrop-blur-md">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                </span>
                                AI-Powered Service Aggregator
                            </div>

                            <h1 className="text-5xl lg:text-7xl font-bold leading-tight text-white drop-shadow-2xl">
                                Services at the <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-pulse">
                                    Speed of AI
                                </span>
                            </h1>

                            <p className="text-xl text-slate-300 max-w-xl leading-relaxed drop-shadow-md">
                                Experience the future of home services. Our advanced AI matches you with top-rated professionals instantly, ensuring quality and peace of mind.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <Link
                                    to="/create-request"
                                    className="group relative px-8 py-4 bg-blue-600 rounded-full font-bold text-lg overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(37,99,235,0.5)] z-20"
                                >
                                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                                    <span className="relative flex items-center gap-2 text-white">
                                        Book a Service <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                </Link>
                                <Link
                                    to="/login"
                                    className="px-8 py-4 glass rounded-full font-bold text-lg hover:bg-white/10 transition-all hover:scale-105 flex items-center gap-2 justify-center"
                                >
                                    <Play className="w-5 h-5 fill-current" /> Watch Demo
                                </Link>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-slate-500 pt-4">
                                <div className="flex -space-x-2">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-xs font-bold text-white">
                                            {i}
                                        </div>
                                    ))}
                                </div>
                                <p>Trusted by 10,000+ homeowners</p>
                            </div>
                        </div>

                        {/* Hero Visual (3D Effect) */}
                        <div className="relative lg:h-[600px] flex items-center justify-center perspective-1000">
                            {/* Floating Cards */}
                            <div className="relative w-full max-w-md aspect-square preserve-3d animate-float">
                                {/* Main Card */}
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 rotate-y-12 hover:rotate-y-0 transition-transform duration-500">
                                    <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                <User className="w-6 h-6 text-blue-400" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold">John Doe</h3>
                                                <p className="text-xs text-slate-400">Plumbing Specialist</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />)}
                                        </div>
                                    </div>
                                    <div className="flex-1 bg-slate-900/50 rounded-xl p-4 space-y-3">
                                        <div className="h-2 w-3/4 bg-slate-700 rounded-full"></div>
                                        <div className="h-2 w-1/2 bg-slate-700 rounded-full"></div>
                                        <div className="h-32 bg-slate-800 rounded-xl mt-4 border border-slate-700/50 flex items-center justify-center">
                                            <div className="text-center">
                                                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                                                <p className="text-sm text-green-400 font-medium">Job Completed</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Floating Elements */}
                                <div className="absolute -right-12 top-20 glass p-4 rounded-2xl animate-float-delayed shadow-lg shadow-purple-500/20">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                            <Shield className="w-6 h-6 text-green-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">Verified Pro</p>
                                            <p className="text-xs text-slate-400">Background Checked</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="absolute -left-12 bottom-32 glass p-4 rounded-2xl animate-float shadow-lg shadow-blue-500/20">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                            <Star className="w-6 h-6 text-yellow-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">4.9/5 Rating</p>
                                            <p className="text-xs text-slate-400">Based on 500+ reviews</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 relative z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">Why Choose <span className="text-gradient">{settings.platform_name}</span>?</h2>
                        <p className="text-slate-400 max-w-2xl mx-auto">We combine cutting-edge AI technology with top-tier professionals to deliver an unmatched service experience.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {features.map((feature, index) => (
                            <div key={index} className="group relative p-8 rounded-3xl bg-slate-800/50 border border-slate-700 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/10">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-slate-700 group-hover:border-blue-500/30">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                                <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Categories Section */}
            <section id="categories" className="py-24 bg-slate-900/50 relative z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between mb-12">
                        <h2 className="text-3xl font-bold">Popular Services</h2>
                        <Link to="/create-request" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors group">
                            View all <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {loading ? (
                            [1, 2, 3, 4].map(i => (
                                <div key={i} className="h-64 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl"></div>
                            ))
                        ) : (
                            categories.slice(0, 8).map((category) => (
                                <div
                                    key={category.id}
                                    className="group bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-slate-100 dark:border-slate-700 cursor-pointer"
                                    onClick={() => navigate('/create-request', { state: { categoryId: category.id } })}
                                >
                                    <div className="aspect-video relative overflow-hidden">
                                        <img
                                            src={category.image || `https://images.unsplash.com/photo-1581578731548-c64695cc6958?auto=format&fit=crop&q=80&w=800`}
                                            alt={category.name}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                            <span className="text-white text-sm font-medium">Book Now →</span>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-primary transition-colors">
                                            {category.name}
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2">
                                            {category.description || 'Professional service by certified experts.'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-600/10"></div>
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <h2 className="text-4xl md:text-6xl font-bold mb-8">Ready to transform your home?</h2>
                    <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">Join thousands of satisfied customers who have found their perfect service match with {settings.platform_name}.</p>
                    <Link
                        to="/register"
                        className="inline-flex items-center gap-3 px-10 py-5 bg-white text-blue-600 rounded-full font-bold text-lg hover:bg-blue-50 transition-all hover:scale-105 hover:shadow-xl"
                    >
                        Get Started Now <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </section>


        </div >
    );
};

export default Landing;
