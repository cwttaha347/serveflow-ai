import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { MapPin, Navigation, Phone, CheckCircle, Clock } from 'lucide-react';

const LiveTracking = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);

    // Mock coordinates for demo
    const [providerLoc, setProviderLoc] = useState({ lat: 40.7128, lng: -74.0060 });

    useEffect(() => {
        const fetchJob = async () => {
            try {
                const response = await api.get(`jobs/${id}/`);
                setJob(response.data);
            } catch (error) {
                console.error("Error fetching job:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchJob();

        // Simulate movement
        const interval = setInterval(() => {
            setProviderLoc(prev => ({
                lat: prev.lat + (Math.random() - 0.5) * 0.001,
                lng: prev.lng + (Math.random() - 0.5) * 0.001
            }));
        }, 3000);

        return () => clearInterval(interval);
    }, [id]);

    if (loading) return <div className="p-8 text-center">Loading tracking data...</div>;
    if (!job) return <div className="p-8 text-center">Job not found</div>;

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col lg:flex-row gap-6">
            <div className="lg:w-1/3 space-y-6">
                <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-primary mb-2 flex items-center gap-1">
                    ← Back
                </button>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">Live Status</h2>

                    <div className="space-y-6 relative">
                        {/* Status Timeline */}
                        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-700"></div>

                        {[
                            { status: 'pending', label: 'Request Sent', icon: Clock },
                            { status: 'accepted', label: 'Provider Accepted', icon: CheckCircle },
                            { status: 'started', label: 'On The Way / Working', icon: Navigation },
                            { status: 'completed', label: 'Job Completed', icon: CheckCircle }
                        ].map((step, idx) => {
                            const isActive = step.status === job.status;
                            const isPast = ['pending', 'accepted', 'started', 'completed'].indexOf(job.status) >= idx;

                            return (
                                <div key={step.status} className={`relative flex items-center gap-4 ${isPast ? 'opacity-100' : 'opacity-40'}`}>
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 bg-white dark:bg-slate-800 
                                        ${isActive ? 'border-primary text-primary animate-pulse' : isPast ? 'border-green-500 text-green-500' : 'border-slate-300 text-slate-300'}`}>
                                        <step.icon className="w-3 h-3" />
                                    </div>
                                    <span className={`font-medium ${isActive ? 'text-primary' : 'text-slate-600 dark:text-slate-400'}`}>
                                        {step.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold mb-4 text-slate-900 dark:text-slate-100">Provider Details</h3>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center font-bold text-lg">
                            {job.provider?.user?.first_name?.[0]}
                        </div>
                        <div>
                            <p className="font-semibold">{job.provider?.user?.first_name} {job.provider?.user?.last_name}</p>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <Phone className="w-3 h-3" />
                                {job.provider?.user?.phone || 'No phone'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Map Placeholder */}
            <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-xl relative overflow-hidden group">
                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                    <div className="text-center">
                        <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Map View (Google Maps Integration Required)</p>
                        <p className="text-xs mt-2">Simulated Provider Loc: {providerLoc.lat.toFixed(4)}, {providerLoc.lng.toFixed(4)}</p>
                    </div>
                </div>

                {/* Simulated Map Marker */}
                <div
                    className="absolute w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg transition-all duration-1000 ease-linear"
                    style={{
                        top: '50%',
                        left: '50%',
                        transform: `translate(${Math.sin(providerLoc.lat * 100) * 50}px, ${Math.cos(providerLoc.lng * 100) * 50}px)`
                    }}
                >
                    <div className="absolute -inset-2 bg-primary/20 rounded-full animate-ping"></div>
                </div>
            </div>
        </div>
    );
};

export default LiveTracking;
