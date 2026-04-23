import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return this.props.fallback || (
                <div className="flex items-center justify-center p-8 bg-slate-900/50 rounded-3xl border border-slate-800 text-slate-400 text-sm italic">
                    Something went wrong rendering this component.
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
