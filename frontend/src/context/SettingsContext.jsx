import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import api from '../api';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        platform_name: 'ServeFlow AI',
        currency_symbol: '$',
        contact_email: '',
        maintenance_mode: false,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPublicSettings();
    }, []);

    const fetchPublicSettings = async () => {
        try {
            const baseUrl = (api.defaults.baseURL || '').replace(/\/$/, '');
            const publicUrl = `${baseUrl}/settings/public_config/`;
            const res = await axios.get(publicUrl);
            setSettings(res.data);
        } catch (error) {
            console.error('Error fetching public settings:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SettingsContext.Provider value={{ settings, loading, refreshSettings: fetchPublicSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => useContext(SettingsContext);
