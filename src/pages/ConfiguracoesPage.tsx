import { useState, useEffect } from 'react';
import { invokeEvolutionProxy } from '@/services/data-layer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Wifi, WifiOff, CreditCard, Save, Download, Upload, UserPlus, Trash2, Users, ChevronDown, Copy, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import asaasLogo from '@/assets/asaas.png';
import mercadoPagoLogo from '@/assets/mercado-pago.png';

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
  const [payment, setPayment] = useState({ gateway: 'mercadopago' as 'mercadopago' | 'asaas' | 'pix_manual', access_token: '', asaas_token: '' });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [pollingStatus, setPollingStatus] = useState(false);

  // Poll for connection status after QR code is shown
  useEffect(() => {
    if (!qrCode || !whatsapp.api_url || !whatsapp.api_key || !whatsapp.instance_name) return;
    
    setPollingStatus(true);
    let active = true;
    
    const checkStatus = async () => {
      try {
        const { data } = await invokeEvolutionProxy({
          api_url: whatsapp.api_url,
          api_key: whatsapp.api_key,
          instance_name: whatsapp.instance_name,
          action: 'status',
        });
        if (data?.state === 'open' || data?.state === 'connected') {
          setQrCode(null);
          setPollingStatus(false);
          setWhatsapp(prev => ({ ...prev, status: 'connected' }));
          toast.success('WhatsApp conectado com sucesso!');
          return;
        }
      } catch {}
      if (active) setTimeout(checkStatus, 3000);
    };
    
    const timeout = setTimeout(checkStatus, 3000);
    return () => { active = false; clearTimeout(timeout); };
  }, [qrCode, whatsapp.api_url, whatsapp.api_key, whatsapp.instance_name]);

  useEffect(() => {
    const savedGateway = localStorage.getItem('payment_gateway') || 'mercadopago';
    const savedMpToken = localStorage.getItem('mp_access_token') || '';
    const savedAsaasToken = localStorage.getItem('asaas_access_token') || '';
    setPayment({ gateway: savedGateway as any, access_token: savedMpToken, asaas_token: savedAsaasToken });

    // Carregar config WhatsApp salva
    const savedWa = localStorage.getItem('whatsapp_config');
    if (savedWa) {
      try {
        const parsed = JSON.parse(savedWa);
        setWhatsapp(prev => ({ ...prev, ...parsed }));
      } catch {}
    }
  }, []);

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
                  <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Mínimo 4 caracteres" />
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
                <Badge variant={whatsapp.status === 'connected' ? 'default' : whatsapp.status === 'connecting' ? 'outline' : 'secondary'}>
                  {whatsapp.status === 'connected' ? 'Conectado' : whatsapp.status === 'connecting' ? 'Conectando...' : 'Desconectado'}
                </Badge>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSection === 'whatsapp' ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div>
                <Label>URL da API</Label>
                <Input value={whatsapp.api_url} onChange={(e) => setWhatsapp({ ...whatsapp, api_url: e.target.value })} placeholder="https://evolution.seudominio.com.br" onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()} className="select-none" />
              </div>
              <div>
                <Label>API Key</Label>
                <Input type="password" value={whatsapp.api_key} onChange={(e) => setWhatsapp({ ...whatsapp, api_key: e.target.value })} onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()} className="select-none" />
              </div>
              <div>
                <Label>Nome da Instância</Label>
                <Input value={whatsapp.instance_name} readOnly className="bg-muted cursor-not-allowed" />
              </div>
              <Button size="sm" onClick={() => {
                if (!whatsapp.api_url || !whatsapp.api_key) {
                  toast.error('Preencha a URL e a API Key');
                  return;
                }
                localStorage.setItem('whatsapp_config', JSON.stringify({
                  api_url: whatsapp.api_url,
                  api_key: whatsapp.api_key,
                  instance_name: whatsapp.instance_name,
                  status: 'connected',
                }));
                setWhatsapp(prev => ({ ...prev, status: 'connected' }));
                toast.success('WhatsApp configurado e conectado!');
              }}>
                <Save className="mr-2 h-3 w-3" /> Salvar
              </Button>
              <Button size="sm" variant="outline" disabled={qrLoading || !whatsapp.api_url || !whatsapp.api_key} onClick={async () => {
                setQrLoading(true);
                setQrCode(null);
                try {
                  const { data, error } = await supabase.functions.invoke('evolution-proxy', {
                    body: {
                      api_url: whatsapp.api_url,
                      api_key: whatsapp.api_key,
                      instance_name: whatsapp.instance_name,
                      action: 'create',
                    },
                  });
                  if (error) throw error;
                  console.log('Evolution proxy response:', data);
                  const base64 = data?.qrcode;
                  if (base64) {
                    setQrCode(base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`);
                    toast.success('QR Code gerado! Escaneie com seu WhatsApp.');
                  } else if (data?.state === 'connected') {
                    toast.success('Instância já está conectada!');
                    setWhatsapp(prev => ({ ...prev, status: 'connected' }));
                  } else {
                    console.log('Evolution API debug:', JSON.stringify(data?.debug, null, 2));
                    const debugInfo = data?.debug;
                    const createStatus = debugInfo?.createResult?.status;
                    if (createStatus === 401) {
                      toast.error('API Key inválida. Verifique a chave na Evolution API.');
                    } else {
                      const instances = debugInfo?.instances;
                      const detail = instances ? ` Instâncias encontradas: ${JSON.stringify(instances).substring(0, 150)}` : '';
                      toast.warning('QR Code não disponível. Verifique o console para debug.' + detail);
                    }
                  }
                } catch (err: any) {
                  toast.error('Erro ao gerar QR Code: ' + (err?.message || 'verifique a URL e API Key'));
                } finally {
                  setQrLoading(false);
                }
              }}>
                <QrCode className="mr-2 h-3 w-3" /> {qrLoading ? 'Gerando...' : 'Gerar QR Code'}
              </Button>
              {qrCode && (
                <div className="mt-4 flex flex-col items-center gap-2 p-4 border rounded-lg bg-white">
                  <p className="text-sm font-medium text-foreground">Escaneie o QR Code com seu WhatsApp:</p>
                  <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64 object-contain" />
                  {pollingStatus && <p className="text-xs text-muted-foreground animate-pulse">Aguardando conexão...</p>}
                  <Button size="sm" variant="ghost" onClick={() => { setQrCode(null); setPollingStatus(false); }}>Fechar</Button>
                </div>
              )}
              {whatsapp.status === 'connected' && !qrCode && (
                <div className="mt-4 flex items-center gap-2 p-3 border rounded-lg bg-green-50 text-green-700">
                  <Wifi className="h-4 w-4" />
                  <span className="text-sm font-medium">WhatsApp conectado!</span>
                </div>
              )}
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
            <CardContent className="space-y-6 pt-0">
              <div>
                <Label>Gateway Ativo para Cobranças</Label>
                <Select value={payment.gateway} onValueChange={(v) => setPayment({ ...payment, gateway: v as any })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mercadopago">
                      <div className="flex items-center gap-2">
                        <img src={mercadoPagoLogo} alt="Mercado Pago" className="h-5 w-auto" />
                        Mercado Pago
                      </div>
                    </SelectItem>
                    <SelectItem value="asaas">
                      <div className="flex items-center gap-2">
                        <img src={asaasLogo} alt="Asaas" className="h-5 w-auto" />
                        Asaas
                      </div>
                    </SelectItem>
                    <SelectItem value="pix_manual">PIX Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mostrar apenas o gateway selecionado */}
              {payment.gateway === 'mercadopago' && (
                <div className="rounded-lg border border-primary p-4 space-y-3 bg-primary/5">
                  <div className="flex items-center gap-2">
                    <img src={mercadoPagoLogo} alt="Mercado Pago" className="h-6 w-auto" />
                    <span className="font-medium text-sm">Mercado Pago</span>
                    <Badge variant="default" className="text-xs">Ativo</Badge>
                  </div>
                  <div>
                    <Label className="text-xs">Access Token</Label>
                    <Input type="password" value={payment.access_token} onChange={(e) => setPayment({ ...payment, access_token: e.target.value })} placeholder="APP_USR-..." />
                  </div>
                </div>
              )}

              {payment.gateway === 'asaas' && (
                <div className="rounded-lg border border-primary p-4 space-y-3 bg-primary/5">
                  <div className="flex items-center gap-2">
                    <img src={asaasLogo} alt="Asaas" className="h-6 w-auto" />
                    <span className="font-medium text-sm">Asaas</span>
                    <Badge variant="default" className="text-xs">Ativo</Badge>
                  </div>
                  <div>
                    <Label className="text-xs">API Key</Label>
                    <Input type="password" value={payment.asaas_token} onChange={(e) => setPayment({ ...payment, asaas_token: e.target.value })} placeholder="$aas_..." />
                  </div>
                </div>
              )}

              {/* Webhook URL */}
              <div className="rounded-lg border-2 border-dashed border-primary/40 p-4 space-y-2 bg-primary/5">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  🔗 URL do Webhook
                </Label>
                <p className="text-xs text-muted-foreground">
                  Copie e cole nas configurações de webhook do {payment.gateway === 'mercadopago' ? 'Mercado Pago' : payment.gateway === 'asaas' ? 'Asaas' : 'gateway'}
                </p>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={`${window.location.origin}/api/webhook/${payment.gateway}`} 
                    className="text-xs font-mono bg-background" 
                  />
                  <Button size="sm" variant="outline" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/api/webhook/${payment.gateway}`);
                    toast.success('URL do Webhook copiada!');
                  }}>
                    <Copy className="h-4 w-4 mr-1" /> Copiar
                  </Button>
                </div>
              </div>

              <Button size="sm" onClick={() => {
                localStorage.setItem('payment_gateway', payment.gateway);
                localStorage.setItem('mp_access_token', payment.access_token);
                localStorage.setItem('asaas_access_token', payment.asaas_token);
                toast.success('Configuração de pagamento salva!');
              }}>
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
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSection === 'backup' ? 'rotate-180' : ''}`} />
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
