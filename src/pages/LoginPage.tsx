import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Receipt, Eye, EyeOff, LogIn, Shield, Zap, BarChart3, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { getStoredUsers, setCurrentUser, loginVps, isVpsMode } from '@/services/auth';

interface LoginPageProps {
  onLogin: (token: string) => void;
}

const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const companyName = localStorage.getItem('layout_company_name') || 'CobrançaPro';
  const customLogo = localStorage.getItem('layout_logo');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha usuário e senha');
      return;
    }

    setLoading(true);
    try {
      if (isVpsMode()) {
        // VPS: authenticate via backend API
        const user = await loginVps(email, password);
        onLogin(localStorage.getItem('auth_token') || 'token');
        toast.success(`Bem-vindo, ${user.name}!`);
      } else {
        // Cloud/Lovable: authenticate via localStorage
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
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };

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
                placeholder="Nome ou email" 
                className="h-11"
              />
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
