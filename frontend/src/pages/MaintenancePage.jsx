import { useSettings } from '../context/SettingsContext';
import { Hammer, Mail } from 'lucide-react';

const MaintenancePage = () => {
    const { settings } = useSettings();

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Blobs */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] animate-blob"></div>
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] animate-blob animation-delay-2000"></div>

            <div className="max-w-md w-full glass-dark p-12 rounded-[2.5rem] border-slate-800 text-center relative z-10 shadow-2xl">
                <div className="w-20 h-20 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-8 animate-bounce">
                    <Hammer className="w-10 h-10 text-blue-500" />
                </div>

                <h1 className="text-3xl font-black text-white mb-4">
                    Under Maintenance
                </h1>

                <p className="text-slate-400 mb-8 leading-relaxed">
                    {settings.platform_name} is currently undergoing scheduled maintenance to improve our AI services. We'll be back shortly!
                </p>

                <div className="pt-8 border-t border-slate-800">
                    <p className="text-sm text-slate-500 mb-2 font-medium uppercase tracking-widest">Need urgent help?</p>
                    <a
                        href={`mailto:${settings.contact_email}`}
                        className="flex items-center justify-center gap-2 text-blue-400 hover:text-blue-300 transition-colors font-bold"
                    >
                        <Mail className="w-4 h-4" />
                        {settings.contact_email || 'support@serveflow.ai'}
                    </a>
                </div>
            </div>
        </div>
    );
};

export default MaintenancePage;
