import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

const applyThemeToDocument = (theme) => {
    const root = document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
    root.style.colorScheme = theme;
};

export const ThemeProvider = ({ children }) => {
    const [theme, setThemeState] = useState(() => {
        const stored = localStorage.getItem('theme');
        const initial = stored === 'dark' || stored === 'light' ? stored : 'light';
        applyThemeToDocument(initial);
        return initial;
    });

    useEffect(() => {
        localStorage.setItem('theme', theme);
        applyThemeToDocument(theme);
    }, [theme]);

    const setTheme = useCallback((next) => {
        if (next === 'light' || next === 'dark') {
            setThemeState(next);
        }
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
