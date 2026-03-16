import { useState, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ClientesPage from "./pages/ClientesPage";
import LogsPage from "./pages/LogsPage";

import FilaPage from "./pages/FilaPage";
import MensagensPage from "./pages/MensagensPage";
import ContratosPage from "./pages/ContratosPage";

import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import NotFound from "./pages/NotFound";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-destructive font-semibold">Ocorreu um erro ao carregar esta página.</p>
          <p className="text-sm text-muted-foreground max-w-md text-center">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient();

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) setIsAuthenticated(true);

    // Apply saved primary color
    const savedHSL = localStorage.getItem('layout_primary_hsl');
    if (savedHSL) {
      document.documentElement.style.setProperty('--primary', savedHSL);
    }
  }, []);

  const handleLogin = (token: string) => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <LoginPage onLogin={handleLogin} />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout onLogout={handleLogout}>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/financeiro" element={<DashboardPage />} />
                <Route path="/clientes" element={<ClientesPage />} />
                
                <Route path="/logs" element={<LogsPage />} />
                <Route path="/fila" element={<FilaPage />} />
                <Route path="/mensagens" element={<MensagensPage />} />
                <Route path="/contratos" element={<ContratosPage />} />
                
                <Route path="/configuracoes" element={<ConfiguracoesPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
