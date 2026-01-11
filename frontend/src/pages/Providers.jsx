import { useState, useEffect } from 'react';
import api from '../api';
import { Star, MapPin, Shield, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Providers = () => {
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProviders = async () => {
            try {
                const response = await api.get('providers/');
                setProviders(response.data);
            } catch (error) {
                console.error('Error fetching providers:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProviders();
    }, []);

    const filteredProviders = providers.filter(p =>
        p.user?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.bio?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-20">

            <div className="max-w-7xl mx-auto px-4 py-16">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">Our Providers</h1>
                    <p className="text-xl text-slate-600 dark:text-slate-400">Verified professionals ready to help</p>
                </div>

                <div className="max-w-xl mx-auto mb-12 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search providers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                </div>

                {loading ? (
                    <div className="text-center">Loading providers...</div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredProviders.map((provider) => (
                            <div key={provider.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all border border-slate-100 dark:border-slate-700 flex flex-col">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xl font-bold text-slate-600 dark:text-slate-300">
                                        {provider.user?.first_name?.[0] || 'P'}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                            {provider.user?.first_name} {provider.user?.last_name}
                                        </h3>
                                        <div className="flex items-center gap-1 text-yellow-500 font-medium">
                                            <Star className="w-4 h-4 fill-current" />
                                            {provider.rating || 'New'}
                                        </div>
                                    </div>
                                </div>

                                <p className="text-slate-600 dark:text-slate-300 mb-4 line-clamp-3 flex-1">{provider.bio}</p>

                                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                                    {provider.verified && (
                                        <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                                            <Shield className="w-4 h-4" /> Verified Professional
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                                        <MapPin className="w-4 h-4" />
                                        {provider.user?.profile?.address || 'Location hidden'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Providers;
