import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

const ThemeToggle = ({ className = "" }) => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={`relative p-3 rounded-2xl glass-card transition-all duration-500 hover:scale-110 active:scale-90 group flex items-center justify-center overflow-hidden ${className}`}
            aria-label="Toggle Theme"
        >
            <AnimatePresence mode="wait">
                {theme === 'light' ? (
                    <motion.div
                        key="sun"
                        initial={{ y: 20, opacity: 0, rotate: -45 }}
                        animate={{ y: 0, opacity: 1, rotate: 0 }}
                        exit={{ y: -20, opacity: 0, rotate: 45 }}
                        transition={{ duration: 0.3, ease: "circOut" }}
                    >
                        <Sun className="w-5 h-5 text-amber-500 fill-amber-500/10 group-hover:rotate-45 transition-transform duration-500" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="moon"
                        initial={{ y: 20, opacity: 0, rotate: -45 }}
                        animate={{ y: 0, opacity: 1, rotate: 0 }}
                        exit={{ y: -20, opacity: 0, rotate: 45 }}
                        transition={{ duration: 0.3, ease: "circOut" }}
                    >
                        <Moon className="w-5 h-5 text-blue-400 fill-blue-400/10 group-hover:-rotate-12 transition-transform duration-500" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Subtle glow effect */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity bg-gradient-to-br ${theme === 'light' ? 'from-amber-400 to-orange-500' : 'from-blue-400 to-purple-600'
                }`} />
        </button>
    );
};

export default ThemeToggle;
