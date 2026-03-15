import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wifi, WifiOff, CreditCard, Save, Download, Upload, UserPlus, Trash2, Users } from 'lucide-react';
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

  return (
    <div className="space-y-6 max-w-2xl">

      {/* WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {whatsapp.status === 'connected' ? (
              <Wifi className="h-5 w-5 text-success" />
            ) : (
              <WifiOff className="h-5 w-5 text-destructive" />
            )}
            WhatsApp (Evolution API)
            <Badge variant={whatsapp.status === 'connected' ? 'default' : 'secondary'}>
              {whatsapp.status === 'connected' ? 'Conectado' : 'Desconectado'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
      </Card>

      {/* Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-5 w-5 text-primary" />
            Gateway de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
      </Card>

      {/* Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-5 w-5 text-primary" />
            Backup do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button size="sm" variant="outline" onClick={() => toast.info('Função de backup será implementada em breve')}>
            <Download className="mr-2 h-3 w-3" /> Fazer Backup
          </Button>
          <Button size="sm" variant="outline" onClick={() => toast.info('Função de restauração será implementada em breve')}>
            <Upload className="mr-2 h-3 w-3" /> Restaurar Backup
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfiguracoesPage;
