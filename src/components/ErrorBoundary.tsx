import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// A crash anywhere in the tree below this (e.g. a third-party library like
// HanziWriter choking on unexpected data) would otherwise unmount the whole
// app and leave a blank page requiring a manual refresh. This catches it and
// offers a way back in without losing everything else in the app.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Caught by ErrorBoundary:', error, info);
  }

  handleReset = (): void => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <AlertTriangle size={32} aria-hidden="true" />
          <p>Something went wrong on this screen.</p>
          <button type="button" className="btn btn-primary" onClick={this.handleReset}>
            <RotateCcw size={18} aria-hidden="true" /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
