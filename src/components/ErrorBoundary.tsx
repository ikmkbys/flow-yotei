'use client';

import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ textAlign: 'center', paddingTop: 80, color: 'var(--muted)' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>⚠️</p>
          <p>予期しないエラーが発生しました。</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 20 }}
            onClick={() => this.setState({ hasError: false })}
          >
            再試行
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
