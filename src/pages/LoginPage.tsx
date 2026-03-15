import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface LoginPageProps {
  onLogin: (token: string) => void;
}

const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha email e senha');
      return;
    }

    setLoading(true);

    try {
      const apiUrl = localStorage.getItem('api_base_url') || '/api';
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        // Em modo dev sem backend, aceita credenciais padrão
        if (email === 'admin@cobranca.com' && password === 'admin123') {
          const devToken = 'dev-token-' + Date.now();
          localStorage.setItem('auth_token', devToken);
          onLogin(devToken);
          toast.success('Login realizado (modo desenvolvimento)');
          return;
        }
        toast.error('Email ou senha incorretos');
        return;
      }

      const data = await res.json();
      localStorage.setItem('auth_token', data.token);
      onLogin(data.token);
      toast.success('Login realizado com sucesso!');
    } catch {
      // Sem backend - aceita credenciais de dev
      if (email === 'admin@cobranca.com' && password === 'admin123') {
        const devToken = 'dev-token-' + Date.now();
        localStorage.setItem('auth_token', devToken);
        onLogin(devToken);
        toast.success('Login realizado (modo desenvolvimento)');
        return;
      }
      toast.error('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Receipt className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">CobrançaPro</CardTitle>
          <p className="text-sm text-muted-foreground">Entre com suas credenciais</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@cobranca.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Dev: admin@cobranca.com / admin123
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
