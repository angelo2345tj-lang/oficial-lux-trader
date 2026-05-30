import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  declare props: Props;
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lux Trader UI error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#020204] text-white p-8">
          <div className="text-center max-w-md">
            <p className="text-lg font-semibold mb-2">Algo deu errado</p>
            <p className="text-sm text-zinc-500 mb-6">Recarregue a página para continuar.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
