import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt, Eye, EyeOff, UserPlus, LogIn } from 'lucide-react';
import { toast } from 'sonner';

interface LoginPageProps {
  onLogin: (token: string) => void;
}

const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha email e senha');
      return;
    }

    setLoading(true);
    try {
      const storedUsers = localStorage.getItem('app_users');
      const users = storedUsers ? JSON.parse(storedUsers) : [
        { id: '1', email: 'admin@cobranca.com', password: 'admin123', name: 'Administrador' }
      ];
      if (!storedUsers) localStorage.setItem('app_users', JSON.stringify(users));

      const user = users.find((u: { email: string; password: string }) => u.email === email && u.password === password);
      if (user) {
        const token = 'token-' + Date.now();
        localStorage.setItem('auth_token', token);
        onLogin(token);
        toast.success('Login realizado com sucesso!');
      } else {
        toast.error('Email ou senha incorretos');
      }
    } catch {
      toast.error('Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (regPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    const storedUsers = localStorage.getItem('app_users');
    const users = storedUsers ? JSON.parse(storedUsers) : [
      { id: '1', email: 'admin@cobranca.com', password: 'admin123', name: 'Administrador' }
    ];

    if (users.find((u: { email: string }) => u.email === regEmail)) {
      toast.error('Este email já está cadastrado');
      return;
    }

    const newUser = {
      id: Date.now().toString(),
      email: regEmail,
      password: regPassword,
      name: regName,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    localStorage.setItem('app_users', JSON.stringify(users));
    toast.success('Conta criada! Faça login com suas credenciais.');
    setRegName('');
    setRegEmail('');
    setRegPassword('');
    setMode('login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Receipt className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">CobrançaPro</CardTitle>
          <p className="text-sm text-muted-foreground">
            {mode === 'login' ? 'Entre com suas credenciais' : 'Crie sua conta'}
          </p>
        </CardHeader>
        <CardContent>
          {mode === 'login' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <LogIn className="mr-2 h-4 w-4" />
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Seu nome" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="seu@email.com" />
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <Button type="submit" className="w-full">
                <UserPlus className="mr-2 h-4 w-4" />
                Criar Conta
              </Button>
            </form>
          )}

          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="mt-4 w-full text-center text-sm text-primary hover:underline"
          >
            {mode === 'login' ? 'Não tem conta? Criar conta' : 'Já tem conta? Fazer login'}
          </button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
