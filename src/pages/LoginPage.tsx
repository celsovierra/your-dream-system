import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Receipt, Eye, EyeOff, LogIn, Shield, Zap, BarChart3, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getStoredUsers, isVpsMode, loginVps, setCurrentUser } from '@/services/auth';
import api from '@/services/api';

interface LoginPageProps {
  onLogin: (token: string) => void;
  slug?: string;
}

interface TenantBranding {
  slug: string;
  company_name: string;
  logo: string | null;
  primary_color: string | null;
  owner_id: string;
}

const LoginPage = ({ onLogin, slug }: LoginPageProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(!!slug);

  // Load tenant branding from backend if slug is provided
  useEffect(() => {
    if (!slug) return;
    setBrandingLoading(true);
    api.getBranding(slug).then(res => {
      if (res.success && res.data) {
        // Unwrap nested data
        const payload = (res.data as any)?.data || res.data;
        setBranding(payload);
      }
    }).catch(() => {}).finally(() => setBrandingLoading(false));
  }, [slug]);

  const companyName = branding?.company_name || localStorage.getItem('layout_company_name') || 'CobrançaPro';
  const customLogo = branding?.logo || localStorage.getItem('layout_logo');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha usuário e senha');
      return;
    }

    setLoading(true);
    try {
      if (isVpsMode()) {
        await loginVps(email.trim(), password);
        // Store the slug context for the session
        if (slug) {
          localStorage.setItem('login_slug', slug);
        }
        onLogin(localStorage.getItem('auth_token') || `token-${Date.now()}`);
        toast.success('Login realizado com sucesso!');
        return;
      }

      const users = getStoredUsers();
      const loginValue = email.toLowerCase().trim();
      const user = users.find(u => 
        (u.email.toLowerCase() === loginValue || u.name.toLowerCase() === loginValue) && u.password === password
      );
      if (user) {
        const token = 'token-' + Date.now();
        localStorage.setItem('auth_token', token);
        setCurrentUser(user);
        onLogin(token);
        toast.success('Login realizado com sucesso!');
      } else {
        toast.error('Usuário ou senha incorretos');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };

  if (brandingLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(59,130,246,0.15),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(99,102,241,0.1),transparent_60%)]" />
        <div className="absolute top-20 left-10 w-32 h-32 border border-blue-500/20 rounded-2xl rotate-12" />
        <div className="absolute bottom-32 right-16 w-24 h-24 border border-indigo-500/20 rounded-full" />
        <div className="absolute top-1/3 right-20 w-16 h-16 bg-blue-500/10 rounded-lg rotate-45" />
        
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="flex items-center gap-3 mb-8">
            {customLogo ? (
              <img src={customLogo} alt={companyName} className="h-12 w-auto object-contain" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500 shadow-lg shadow-blue-500/30">
                <Receipt className="h-6 w-6 text-white" />
              </div>
            )}
            <h1 className="text-3xl font-bold text-white tracking-tight">{companyName}</h1>
          </div>
          
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Gestão de cobranças<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              inteligente
            </span>
          </h2>
          
          <p className="text-lg text-slate-400 mb-10 max-w-md">
            Automatize suas cobranças via WhatsApp, gere PIX instantaneamente e tenha controle total dos seus recebimentos.
          </p>

          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 border border-blue-500/20">
                <Zap className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Cobranças Automáticas</p>
                <p className="text-xs text-slate-500">WhatsApp + PIX integrados</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15 border border-indigo-500/20">
                <Shield className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Seguro & Confiável</p>
                <p className="text-xs text-slate-500">Mercado Pago & Asaas</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/20">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Dashboard Completo</p>
                <p className="text-xs text-slate-500">Relatórios em tempo real</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/15 border border-purple-500/20">
                <FileText className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Gestão de Contratos</p>
                <p className="text-xs text-slate-500">Controle total de contratos</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-background p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="flex flex-col items-center lg:hidden mb-4">
            {customLogo ? (
              <img src={customLogo} alt={companyName} className="h-14 w-auto object-contain mb-3" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30 mb-3">
                <Receipt className="h-7 w-7 text-primary-foreground" />
              </div>
            )}
            <h1 className="text-2xl font-bold">{companyName}</h1>
          </div>

          <div className="space-y-2 lg:text-left text-center">
            <h2 className="text-2xl font-bold tracking-tight">Bem-vindo de volta</h2>
            <p className="text-muted-foreground">Entre com seu usuário e senha</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Usuário</Label>
              <Input 
                id="email" 
                type="text" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="Email do usuário" 
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">Se existir mais de um usuário com o mesmo nome, entre usando o email.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? 'text' : 'password'} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••" 
                  className="h-11 pr-11"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={loading}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground pt-4">
            © {new Date().getFullYear()} {companyName}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
