import { useState, useEffect } from 'react';
import api from '../api';
import { ArrowRight, Wrench, Zap, Truck, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Services = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await api.get('categories/');
                setCategories(response.data);
            } catch (error) {
                console.error('Error fetching categories:', error);

                // Fallback mock
                setCategories([
                    { id: 1, name: 'Home Cleaning', description: 'Professional home cleaning services', icon: 'home' },
                    { id: 2, name: 'Plumbing', description: 'Expert plumbing repairs and installation', icon: 'wrench' },
                    { id: 3, name: 'Electrical', description: 'Certified electricians for all needs', icon: 'zap' },
                    { id: 4, name: 'Moving', description: 'Reliable moving and packing help', icon: 'truck' },
                ]);
            } finally {
                setLoading(false);
            }
        };
        fetchCategories();
    }, []);

    const getIcon = (name) => {
        const n = name.toLowerCase();
        if (n.includes('plumb')) return <Wrench className="w-8 h-8 text-blue-500" />;
        if (n.includes('electric')) return <Zap className="w-8 h-8 text-yellow-500" />;
        if (n.includes('mov')) return <Truck className="w-8 h-8 text-green-500" />;
        return <Home className="w-8 h-8 text-primary" />;
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-20">


            <div className="max-w-7xl mx-auto px-4 py-16">
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">Our Services</h1>
                    <p className="text-xl text-slate-600 dark:text-slate-400">Professional services tailored to your needs</p>
                </div>

                {loading ? (
                    <div className="text-center">Loading services...</div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {categories.map((category) => (
                            <div key={category.id} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-slate-100 dark:border-slate-700">
                                <div className="mb-6 bg-slate-50 dark:bg-slate-700 w-16 h-16 rounded-xl flex items-center justify-center">
                                    {getIcon(category.name)}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">{category.name}</h3>
                                <p className="text-slate-600 dark:text-slate-400 mb-6">{category.description || 'Quality service guaranteed.'}</p>
                                <button
                                    onClick={() => navigate('/create-request')}
                                    className="flex items-center text-primary font-semibold hover:gap-2 transition-all group"
                                >
                                    Book Now <ArrowRight className="w-4 h-4 ml-1 group-hover:ml-2 transition-all" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Services;
