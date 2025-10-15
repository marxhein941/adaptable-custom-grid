import * as React from 'react';
import { MessageBar, MessageBarType } from '@fluentui/react';

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('[GridChangeTracker] Component error:', error, errorInfo);
    }

    render(): React.ReactNode {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px' }}>
                    <MessageBar messageBarType={MessageBarType.error}>
                        An unexpected error occurred in the grid. Please refresh the page or contact support if the issue persists.
                    </MessageBar>
                </div>
            );
        }

        return this.props.children;
    }
}
