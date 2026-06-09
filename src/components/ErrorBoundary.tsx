/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error inside ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    try {
      // Clear all xuongan related localStorage items to resolve corrupted local states
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('xuongan_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('firebase:previous_sessions');
      
      // Reload page
      window.location.reload();
    } catch (e) {
      console.error("Failed to clear localStorage:", e);
      window.location.reload();
    }
  };

  private copyError = () => {
    const errorDetails = `
Error: ${this.state.error?.message}
Stack: ${this.state.error?.stack}
Component Stack: ${this.state.errorInfo?.componentStack}
    `.trim();

    navigator.clipboard.writeText(errorDetails).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans selection:bg-indigo-500 selection:text-white">
          <div className="w-full max-w-xl bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-indigo-500" />
            
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/5">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-white uppercase">Xảy Ra Lỗi Hệ Thống</h2>
                <p className="text-xs text-slate-400 font-mono">CODE_INITIALIZATION_ERROR</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              Ứng dụng xưởng may đã phát hiện lỗi không mong muốn trong quá trình khởi động hoặc kết xuất giao diện. Hãy thử khôi phục nhanh cấu hình trình duyệt hoặc gửi thông tin mã lỗi bên dưới cho nhà phát triển.
            </p>

            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 mb-6 font-mono text-xs text-red-400 overflow-auto max-h-48 whitespace-pre-wrap select-all">
              {this.state.error && this.state.error.toString()}
              {this.state.errorInfo && (
                <span className="text-slate-500 block mt-2 text-[10px]">
                  {this.state.errorInfo.componentStack}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border-t border-slate-800/80 pt-6">
              <button
                onClick={this.copyError}
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 transition-all cursor-pointer border border-slate-700/60"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400 mr-2 animate-pulse" />
                    Đã sao chép mã lỗi
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-2" />
                    Sao chép thông tin lỗi
                  </>
                )}
              </button>

              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Dọn sạch cache & Thử lại
              </button>
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                Xưởng May Toản Vũ — Hỗ Trợ Đội Ngũ Kế Toán
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
