import { useState, useEffect, useRef } from 'react';
import { invokeEvolutionProxy } from '@/services/data-layer';
import api from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Wifi, WifiOff, CreditCard, Save, Download, Upload, ChevronDown, Copy, QrCode, Palette, ImageIcon, MapPin, Server, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import asaasLogo from '@/assets/asaas.png';
import mercadoPagoLogo from '@/assets/mercado-pago.png';
import { userStorageGet, userStorageSet, isAdmin } from '@/services/auth';

const ConfiguracoesPage = () => {
  const userIsAdmin = isAdmin();
  const autoInstanceName = window.location.hostname.replace(/\./g, '_') + '_cobrancapro';
  const [whatsapp, setWhatsapp] = useState<{ api_url: string; api_key: string; instance_name: string; status: 'connected' | 'disconnected' | 'connecting' }>({ api_url: '', api_key: '', instance_name: autoInstanceName, status: 'disconnected' });
  const [payment, setPayment] = useState({ gateway: 'mercadopago' as 'mercadopago' | 'asaas' | 'pix_manual', access_token: '', asaas_token: '' });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [pollingStatus, setPollingStatus] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const [layoutCompanyName, setLayoutCompanyName] = useState(() => localStorage.getItem('layout_company_name') || 'CobrançaPro');
  const [layoutPrimaryColor, setLayoutPrimaryColor] = useState(() => localStorage.getItem('layout_primary_color') || '#3b82f6');
  const [layoutLogo, setLayoutLogo] = useState<string | null>(() => localStorage.getItem('layout_logo'));
  const [apiBaseUrl, setApiBaseUrl] = useState(() => localStorage.getItem('api_base_url') || '');
  const configuredWebhookBase = (apiBaseUrl || window.location.origin).trim().replace(/\/+$/, '').replace(/\/api$/, '');
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [traccarUrl, setTraccarUrl] = useState(() => userStorageGet('traccar_url') || '');
  const [traccarUser, setTraccarUser] = useState(() => userStorageGet('traccar_user') || '');
  const [traccarPassword, setTraccarPassword] = useState(() => userStorageGet('traccar_password') || '');
  const [traccarTesting, setTraccarTesting] = useState(false);

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
          userStorageSet('whatsapp_status', 'connected');
          toast.success('WhatsApp conectado com sucesso!');
          return;
        }
      } catch {}
      if (active) setTimeout(checkStatus, 3000);
    };

    const timeout = setTimeout(checkStatus, 3000);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [qrCode, whatsapp.api_url, whatsapp.api_key, whatsapp.instance_name]);

  useEffect(() => {
    const savedGateway = userStorageGet('payment_gateway') || 'mercadopago';
    const savedMpToken = userStorageGet('mp_access_token') || '';
    const savedAsaasToken = userStorageGet('asaas_access_token') || '';
    setPayment({ gateway: savedGateway as any, access_token: savedMpToken, asaas_token: savedAsaasToken });

    const savedWa = userStorageGet('whatsapp_config');
    if (!savedWa) return;

    try {
      const parsed = JSON.parse(savedWa);
      const api_url = parsed?.api_url || '';
      const api_key = parsed?.api_key || '';
      const cachedStatus = userStorageGet('whatsapp_status');
      const initialStatus = cachedStatus === 'connected' ? 'connected' : 'disconnected';

      setWhatsapp({
        api_url,
        api_key,
        instance_name: autoInstanceName,
        status: initialStatus as any,
      });

      if (api_url && api_key) {
        invokeEvolutionProxy({
          api_url,
          api_key,
          instance_name: autoInstanceName,
          action: 'status',
        }).then(({ data }) => {
          if (data?.state === 'open' || data?.state === 'connected') {
            setWhatsapp(prev => ({ ...prev, status: 'connected' }));
            userStorageSet('whatsapp_status', 'connected');
          } else {
            userStorageSet('whatsapp_status', 'disconnected');
          }
        }).catch(() => undefined);
      }
    } catch {}
  }, [autoInstanceName]);

  const toggleSection = (key: string) => {
    setOpenSection(prev => (prev === key ? null : key));
  };

  const handleTestTraccar = async () => {
    const url = traccarUrl.trim().replace(/\/+$/, '');
    const user = traccarUser.trim();
    const password = traccarPassword;

    if (!url || !user || !password) {
      toast.error('Preencha a URL, usuário e senha do Traccar');
      return;
    }

    if (/^https:\/\/\d{1,3}(\.\d{1,3}){3}(:\d+)?$/i.test(url)) {
      toast.warning('HTTPS com IP costuma falhar por certificado. Se possível, use http://IP:PORTA ou um domínio com SSL válido.');
    }

    setTraccarTesting(true);

    try {
      const result = await api.traccarProxy({
        traccar_url: url,
        traccar_user: user,
        traccar_password: password,
        endpoint: '/api/devices',
        method: 'GET',
      });

      const devices = result.data && typeof result.data === 'object' && 'data' in result.data
        ? (result.data as { data?: unknown }).data
        : result.data;

      if (!result.success || !Array.isArray(devices)) {
        throw new Error(result.error || 'Resposta inválida do Traccar');
      }

      toast.success(`Conexão com Traccar OK: ${devices.length} veículo(s) encontrado(s).`);
    } catch (err: any) {
      toast.error(`Falha no Traccar: ${err?.message || 'erro desconhecido'}`);
    } finally {
      setTraccarTesting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
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
                userStorageSet('whatsapp_config', JSON.stringify({
                  api_url: whatsapp.api_url,
                  api_key: whatsapp.api_key,
                  instance_name: autoInstanceName,
                  status: whatsapp.status,
                }));
                toast.success('Configuração salva! Agora gere o QR Code para conectar.');
              }}>
                <Save className="mr-2 h-3 w-3" /> Salvar
              </Button>
              <Button size="sm" variant="outline" disabled={qrLoading || !whatsapp.api_url || !whatsapp.api_key} onClick={async () => {
                setQrLoading(true);
                setQrCode(null);
                try {
                  const { data, error } = await invokeEvolutionProxy({
                    api_url: whatsapp.api_url,
                    api_key: whatsapp.api_key,
                    instance_name: autoInstanceName,
                    action: 'create',
                  });
                  if (error) throw new Error(error);
                  const base64 = data?.qrcode;
                  if (base64) {
                    setQrCode(base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`);
                    toast.success('QR Code gerado! Escaneie com seu WhatsApp.');
                  } else if (data?.state === 'connected') {
                    toast.success('Instância já está conectada!');
                    setWhatsapp(prev => ({ ...prev, status: 'connected' }));
                  } else {
                    toast.warning('QR Code não disponível. Verifique a configuração.');
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
                <div className="mt-4 flex flex-col items-center gap-2 p-4 border rounded-lg bg-background">
                  <p className="text-sm font-medium text-foreground">Escaneie o QR Code com seu WhatsApp:</p>
                  <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64 object-contain" />
                  {pollingStatus && <p className="text-xs text-muted-foreground animate-pulse">Aguardando conexão...</p>}
                  <Button size="sm" variant="ghost" onClick={() => { setQrCode(null); setPollingStatus(false); }}>Fechar</Button>
                </div>
              )}
              {whatsapp.status === 'connected' && !qrCode && (
                <div className="mt-4 flex items-center gap-2 p-3 border rounded-lg bg-muted text-foreground">
                  <Wifi className="h-4 w-4" />
                  <span className="text-sm font-medium">WhatsApp conectado!</span>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openSection === 'payment'} onOpenChange={() => toggleSection('payment')}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 rounded-t-lg transition-colors">
              <div className="flex items-center gap-2 text-base font-semibold">
                <CreditCard className="h-5 w-5 text-primary" />
                Gateway de Pagamento
                {((payment.gateway === 'mercadopago' && payment.access_token) || (payment.gateway === 'asaas' && payment.asaas_token) || payment.gateway === 'pix_manual') && (
                  <Badge variant="default">Ativa</Badge>
                )}
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

              {payment.gateway === 'mercadopago' && (
                <div>
                  <Label>Access Token Mercado Pago</Label>
                  <Input type="password" value={payment.access_token} onChange={(e) => setPayment({ ...payment, access_token: e.target.value })} />
                </div>
              )}

              {payment.gateway === 'asaas' && (
                <div>
                  <Label>Token Asaas</Label>
                  <Input type="password" value={payment.asaas_token} onChange={(e) => setPayment({ ...payment, asaas_token: e.target.value })} />
                </div>
              )}

              {(payment.gateway === 'mercadopago' || payment.gateway === 'asaas') && (
                <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <Label>URL do Webhook</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input readOnly value={`${configuredWebhookBase}/api/webhook/${payment.gateway}`} className="bg-background cursor-default text-xs" />
                    <Button size="sm" variant="outline" type="button" onClick={() => {
                      navigator.clipboard.writeText(`${configuredWebhookBase}/api/webhook/${payment.gateway}`);
                      toast.success('URL do Webhook copiada!');
                    }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Cole esta URL nas configurações de webhook do {payment.gateway === 'mercadopago' ? 'Mercado Pago' : 'Asaas'}.</p>
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
                <div>
                  <h4 className="text-sm font-semibold">Tutoriais de configuração</h4>
                  <p className="text-xs text-muted-foreground">Esses vídeos vão junto no código e aparecerão também em novas instalações na VPS.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <img src={mercadoPagoLogo} alt="Mercado Pago" className="h-6 w-auto" />
                      <h5 className="text-sm font-semibold">Tutorial Mercado Pago</h5>
                    </div>
                    <p className="text-xs text-muted-foreground">Cadastro da conta, geração do Access Token e configuração para cobranças via PIX.</p>
                    <div className="aspect-video rounded-md border border-dashed border-border bg-muted flex items-center justify-center text-sm text-muted-foreground">
                      📹 Vídeo do Mercado Pago em breve
                    </div>
                  </div>

                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <img src={asaasLogo} alt="Asaas" className="h-6 w-auto" />
                      <h5 className="text-sm font-semibold">Tutorial Asaas</h5>
                    </div>
                    <p className="text-xs text-muted-foreground">Configuração da conta, obtenção do token e ativação da integração com o sistema.</p>
                    <div className="aspect-video rounded-md border border-dashed border-border bg-muted flex items-center justify-center text-sm text-muted-foreground">
                      📹 Vídeo do Asaas em breve
                    </div>
                  </div>
                </div>
              </div>

              <Button size="sm" onClick={() => {
                userStorageSet('payment_gateway', payment.gateway);
                userStorageSet('mp_access_token', payment.access_token);
                userStorageSet('asaas_access_token', payment.asaas_token);
                toast.success('Configuração de pagamento salva!');
              }}>
                <Save className="mr-2 h-3 w-3" /> Salvar
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {userIsAdmin && <Collapsible open={openSection === 'backup'} onOpenChange={() => toggleSection('backup')}>
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
      </Collapsible>}

      <Collapsible open={openSection === 'traccar'} onOpenChange={() => toggleSection('traccar')}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 rounded-t-lg transition-colors">
              <div className="flex items-center gap-2 text-base font-semibold">
                <MapPin className="h-5 w-5 text-primary" />
                API Traccar
                {traccarUrl && traccarUser && traccarPassword && <Badge variant="default">Configurado</Badge>}
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSection === 'traccar' ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div>
                <Label>URL do Servidor Traccar</Label>
                <Input value={traccarUrl} onChange={(e) => setTraccarUrl(e.target.value)} placeholder="https://traccar.seudominio.com.br" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Se estiver usando IP, prefira <span className="font-medium">http://IP:PORTA</span>. <span className="font-medium">https://IP</span> costuma falhar por certificado inválido.
                </p>
              </div>
              <div>
                <Label>Usuário / Email</Label>
                <Input value={traccarUser} onChange={(e) => setTraccarUser(e.target.value)} placeholder="admin@exemplo.com" />
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" value={traccarPassword} onChange={(e) => setTraccarPassword(e.target.value)} placeholder="Senha do Traccar" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => {
                  if (!traccarUrl || !traccarUser || !traccarPassword) {
                    toast.error('Preencha todos os campos do Traccar');
                    return;
                  }
                  userStorageSet('traccar_url', traccarUrl.trim().replace(/\/+$/, ''));
                  userStorageSet('traccar_user', traccarUser.trim());
                  userStorageSet('traccar_password', traccarPassword);
                  window.dispatchEvent(new Event('traccar-config-updated'));
                  toast.success('Configuração do Traccar salva!');
                }}>
                  <Save className="mr-2 h-3 w-3" /> Salvar
                </Button>
                <Button size="sm" variant="outline" onClick={handleTestTraccar} disabled={traccarTesting}>
                  {traccarTesting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <MapPin className="mr-2 h-3 w-3" />}
                  Testar conexão
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {userIsAdmin && <Collapsible open={openSection === 'vps-api'} onOpenChange={() => toggleSection('vps-api')}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 rounded-t-lg transition-colors">
              <div className="flex items-center gap-2 text-base font-semibold">
                <Server className="h-5 w-5 text-primary" />
                API da VPS
                {apiBaseUrl && <Badge variant="default">Ativa</Badge>}
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSection === 'vps-api' ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div>
                <Label>URL base da VPS</Label>
                <Input value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} placeholder="https://seudominio.com ou https://seudominio.com/api" />
              </div>
              <p className="text-sm text-muted-foreground">
                Quando salva aqui, o preview passa a usar a mesma API e o mesmo banco MariaDB da VPS.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => {
                  const trimmed = apiBaseUrl.trim().replace(/\/+$/, '');
                  if (!trimmed) {
                    toast.error('Informe a URL da API da VPS');
                    return;
                  }
                  const normalized = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
                  localStorage.setItem('api_base_url', normalized);
                  toast.success('API da VPS salva! Recarregando para usar o banco da VPS...');
                  setTimeout(() => window.location.reload(), 700);
                }}>
                  <Save className="mr-2 h-3 w-3" /> Salvar API VPS
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  localStorage.removeItem('api_base_url');
                  toast.success('API da VPS removida! Recarregando...');
                  setTimeout(() => window.location.reload(), 500);
                }}>
                  Limpar
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>}

      {userIsAdmin && <Collapsible open={openSection === 'layout'} onOpenChange={() => toggleSection('layout')}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 rounded-t-lg transition-colors">
              <div className="flex items-center gap-2 text-base font-semibold">
                <Palette className="h-5 w-5 text-primary" />
                Configuração de Layout
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openSection === 'layout' ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-5 pt-0">
              <div>
                <Label>Nome da Empresa (tela de login)</Label>
                <Input value={layoutCompanyName} onChange={(e) => setLayoutCompanyName(e.target.value)} placeholder="Nome da sua empresa" maxLength={50} />
              </div>

              <div>
                <Label>Cor Principal do Sistema</Label>
                <div className="flex items-center gap-3 mt-1">
                  <input type="color" value={layoutPrimaryColor} onChange={(e) => setLayoutPrimaryColor(e.target.value)} className="h-10 w-14 rounded border border-border cursor-pointer" />
                  <Input value={layoutPrimaryColor} onChange={(e) => setLayoutPrimaryColor(e.target.value)} placeholder="#3b82f6" className="w-32 font-mono text-sm" maxLength={7} />
                  <div className="h-10 w-10 rounded-md border" style={{ backgroundColor: layoutPrimaryColor }} />
                </div>
              </div>

              <div>
                <Label>Logo da Tela de Login</Label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) {
                      toast.error('Imagem deve ter no máximo 2MB');
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => setLayoutLogo(reader.result as string);
                    reader.readAsDataURL(file);
                  }}
                />
                <div className="mt-1 flex items-center gap-4">
                  {layoutLogo ? (
                    <div className="relative">
                      <img src={layoutLogo} alt="Logo" className="h-16 w-auto rounded-md border object-contain bg-background p-1" />
                      <button onClick={() => setLayoutLogo(null)} className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs">×</button>
                    </div>
                  ) : (
                    <div className="h-16 w-24 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                  )}
                  <Button size="sm" variant="outline" onClick={() => logoInputRef.current?.click()}>
                    <Upload className="mr-2 h-3 w-3" /> {layoutLogo ? 'Trocar' : 'Enviar Logo'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou SVG, máx. 2MB</p>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
                <div className="flex items-center gap-3">
                  {layoutLogo ? (
                    <img src={layoutLogo} alt="Preview" className="h-10 w-auto object-contain" />
                  ) : (
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: layoutPrimaryColor }}>
                      <span className="text-white font-bold text-sm">{layoutCompanyName.charAt(0)}</span>
                    </div>
                  )}
                  <span className="text-lg font-bold">{layoutCompanyName}</span>
                </div>
              </div>

              <Button size="sm" onClick={() => {
                localStorage.setItem('layout_company_name', layoutCompanyName);
                localStorage.setItem('layout_primary_color', layoutPrimaryColor);
                if (layoutLogo) localStorage.setItem('layout_logo', layoutLogo);
                else localStorage.removeItem('layout_logo');

                const hsl = hexToHSL(layoutPrimaryColor);
                if (hsl) {
                  document.documentElement.style.setProperty('--primary', hsl);
                  localStorage.setItem('layout_primary_hsl', hsl);
                }

                toast.success('Layout salvo! A tela de login será atualizada.');
              }}>
                <Save className="mr-2 h-3 w-3" /> Salvar Layout
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>}
    </div>
  );
};

function hexToHSL(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default ConfiguracoesPage;
