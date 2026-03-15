import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Wifi, WifiOff, CreditCard, Save, Download, Upload, UserPlus, Trash2, Users, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface AppUser {
  id: string;
  email: string;
  password: string;
  name: string;
  createdAt: string;
}

const ConfiguracoesPage = () => {
  const autoInstanceName = window.location.hostname.replace(/\./g, '_') + '_cobrancapro';
  const [whatsapp, setWhatsapp] = useState<{ api_url: string; api_key: string; instance_name: string; status: 'connected' | 'disconnected' | 'connecting' }>({ api_url: '', api_key: '', instance_name: autoInstanceName, status: 'disconnected' });
  const [payment, setPayment] = useState({ gateway: 'mercadopago' as const, access_token: '' });

  const [users, setUsers] = useState<AppUser[]>([]);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '' });

  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (key: string) => {
    setOpenSection(prev => prev === key ? null : key);
  };

  useEffect(() => {
    const stored = localStorage.getItem('app_users');
    if (stored) {
      setUsers(JSON.parse(stored));
    } else {
      const defaultUser: AppUser = {
        id: '1',
        email: 'admin@cobranca.com',
        password: 'admin123',
        name: 'Administrador',
        createdAt: new Date().toISOString(),
      };
      setUsers([defaultUser]);
      localStorage.setItem('app_users', JSON.stringify([defaultUser]));
    }
  }, []);

  const handleAddUser = () => {
    if (!newUser.email || !newUser.password || !newUser.name) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (users.find(u => u.email === newUser.email)) {
      toast.error('Este email já está cadastrado');
      return;
    }
    const user: AppUser = {
      id: Date.now().toString(),
      email: newUser.email,
      password: newUser.password,
      name: newUser.name,
      createdAt: new Date().toISOString(),
    };
    const updated = [...users, user];
    setUsers(updated);
    localStorage.setItem('app_users', JSON.stringify(updated));
    setNewUser({ email: '', password: '', name: '' });
    toast.success('Usuário criado com sucesso!');
  };

  const handleDeleteUser = (id: string) => {
    if (users.length <= 1) {
      toast.error('Deve existir pelo menos 1 usuário');
      return;
    }
    const updated = users.filter(u => u.id !== id);
    setUsers(updated);
    localStorage.setItem('app_users', JSON.stringify(updated));
    toast.success('Usuário removido');
  };

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Gerenciar Usuários */}
      <Collapsible open={openSection === 'users'} onOpenChange={() => toggleSection('users')}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 rounded-t-lg transition-colors">
              <div className="flex items-center gap-2 text-base font-semibold">
                <Users className="h-5 w-5 text-primary" />
                Gerenciar Usuários
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSection === 'users' ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="grid gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="Nome do usuário" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="email@exemplo.com" />
                </div>
                <div>
                  <Label>Senha</Label>
                  <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
                </div>
                <Button size="sm" onClick={handleAddUser}>
                  <UserPlus className="mr-2 h-3 w-3" /> Criar Usuário
                </Button>
              </div>

              {users.length > 0 && (
                <div className="border-t pt-4 space-y-2">
                  <Label className="text-muted-foreground text-xs">Usuários cadastrados</Label>
                  {users.map(user => (
                    <div key={user.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => handleDeleteUser(user.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* WhatsApp */}
      <Collapsible open={openSection === 'whatsapp'} onOpenChange={() => toggleSection('whatsapp')}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 rounded-t-lg transition-colors">
              <div className="flex items-center gap-2 text-base font-semibold">
                {whatsapp.status === 'connected' ? (
                  <Wifi className="h-5 w-5 text-success" />
                ) : (
                  <WifiOff className="h-5 w-5 text-destructive" />
                )}
                WhatsApp (Evolution API)
                <Badge variant={whatsapp.status === 'connected' ? 'default' : 'secondary'}>
                  {whatsapp.status === 'connected' ? 'Conectado' : 'Desconectado'}
                </Badge>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSection === 'whatsapp' ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div>
                <Label>URL da API</Label>
                <Input value={whatsapp.api_url} onChange={(e) => setWhatsapp({ ...whatsapp, api_url: e.target.value })} placeholder="https://evolution.seudominio.com.br" />
              </div>
              <div>
                <Label>API Key</Label>
                <Input type="password" value={whatsapp.api_key} onChange={(e) => setWhatsapp({ ...whatsapp, api_key: e.target.value })} />
              </div>
              <div>
                <Label>Nome da Instância</Label>
                <Input value={whatsapp.instance_name} readOnly className="bg-muted cursor-not-allowed" />
              </div>
              <Button size="sm" onClick={() => toast.success('Configuração WhatsApp salva!')}>
                <Save className="mr-2 h-3 w-3" /> Salvar
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Pagamento */}
      <Collapsible open={openSection === 'payment'} onOpenChange={() => toggleSection('payment')}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 rounded-t-lg transition-colors">
              <div className="flex items-center gap-2 text-base font-semibold">
                <CreditCard className="h-5 w-5 text-primary" />
                Gateway de Pagamento
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSection === 'payment' ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div>
                <Label>Gateway</Label>
                <Select value={payment.gateway} onValueChange={(v) => setPayment({ ...payment, gateway: v as 'mercadopago' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                    <SelectItem value="pix_manual">PIX Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Access Token</Label>
                <Input type="password" value={payment.access_token} onChange={(e) => setPayment({ ...payment, access_token: e.target.value })} />
              </div>
              <Button size="sm" onClick={() => { localStorage.setItem('mp_access_token', payment.access_token); toast.success('Access Token do Mercado Pago salvo!'); }}>
                <Save className="mr-2 h-3 w-3" /> Salvar
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Backup */}
      <Collapsible open={openSection === 'backup'} onOpenChange={() => toggleSection('backup')}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 rounded-t-lg transition-colors">
              <div className="flex items-center gap-2 text-base font-semibold">
                <Download className="h-5 w-5 text-primary" />
                Backup do Sistema
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSections.backup ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="flex gap-3 pt-0">
              <Button size="sm" variant="outline" onClick={() => toast.info('Função de backup será implementada em breve')}>
                <Download className="mr-2 h-3 w-3" /> Fazer Backup
              </Button>
              <Button size="sm" variant="outline" onClick={() => toast.info('Função de restauração será implementada em breve')}>
                <Upload className="mr-2 h-3 w-3" /> Restaurar Backup
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};

export default ConfiguracoesPage;
