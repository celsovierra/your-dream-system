import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { mockTemplates } from '@/services/mock-data';
import { Save, MessageSquare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchSettings, saveSettings, fetchMessageTemplates, updateMessageTemplate } from '@/services/data-layer';
import { userStorageSet } from '@/services/auth';

const typeLabels: Record<string, string> = {
  reminder: 'Lembrete',
  due: 'Vencimento',
  overdue: 'Atraso',
  receipt: 'Recibo',
  blocked: 'Bloqueio',
};

const MensagensPage = () => {
  const [templates, setTemplates] = useState(mockTemplates);
  const [reminderDays, setReminderDays] = useState(3);
  const [sendTimeReminder, setSendTimeReminder] = useState('08:00');
  const [sendTimeDue, setSendTimeDue] = useState('08:00');
  const [sendTimeOverdue, setSendTimeOverdue] = useState('09:00');
  const [overdueFrequency, setOverdueFrequency] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Buscar templates do banco de dados
    fetchMessageTemplates()
      .then((dbTemplates) => {
        if (dbTemplates && dbTemplates.length > 0) {
          setTemplates(dbTemplates);
        }
      })
      .catch((err) => {
        console.error('Erro ao buscar templates, usando mock:', err);
      });

    fetchSettings().then((s) => {
      setReminderDays(Number(s.reminder_days) || 3);
      setSendTimeReminder(s.send_time_reminder || '08:00');
      setSendTimeDue(s.send_time_due || '08:00');
      setSendTimeOverdue(s.send_time_overdue || '09:00');
      setOverdueFrequency(Number(s.overdue_frequency) || 3);
    }).finally(() => setLoading(false));
  }, []);

  const handleToggle = (id: number) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, is_active: !t.is_active } : t)));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Salvar templates no banco
      for (const t of templates) {
        await updateMessageTemplate(t.id, { content: t.content, is_active: t.is_active, name: t.name });
      }

      await saveSettings({
        reminder_days: String(reminderDays),
        send_time_reminder: sendTimeReminder,
        send_time_due: sendTimeDue,
        send_time_overdue: sendTimeOverdue,
        overdue_frequency: String(overdueFrequency),
      });
      userStorageSet('cobranca_reminder_days', String(reminderDays));
      userStorageSet('cobranca_send_time_reminder', sendTimeReminder);
      userStorageSet('cobranca_send_time_due', sendTimeDue);
      userStorageSet('cobranca_send_time_overdue', sendTimeOverdue);
      userStorageSet('cobranca_overdue_frequency', String(overdueFrequency));
      toast.success('Todas as configurações e templates salvos!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground mb-1">Variáveis disponíveis:</p>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary" className="bg-orange-600 text-white hover:bg-orange-700">{'{nome}'}</Badge>
        <Badge variant="secondary" className="bg-blue-600 text-white hover:bg-blue-700">{'{vencimento}'}</Badge>
        <Badge variant="secondary" className="bg-blue-600 text-white hover:bg-blue-700">{'{valor}'}</Badge>
        <Badge variant="secondary" className="bg-orange-600 text-white hover:bg-orange-700">{'{valor_atualizado}'}</Badge>
        <Badge variant="secondary" className="bg-yellow-600 text-white hover:bg-yellow-700">{'{multa}'}</Badge>
        <Badge variant="secondary" className="bg-blue-600 text-white hover:bg-blue-700">{'{juros}'}</Badge>
        <Badge variant="secondary" className="bg-purple-600 text-white hover:bg-purple-700">{'{pix_copia_cola}'}</Badge>
        <Badge variant="secondary" className="bg-green-600 text-white hover:bg-green-700">{'{prox_vencimento}'}</Badge>
        <Badge variant="secondary" className="bg-green-600 text-white hover:bg-green-700">{'{data_hoje}'}</Badge>
        <Badge variant="secondary" className="bg-green-600 text-white hover:bg-green-700">{'{desconto}'}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{template.name}</CardTitle>
                <Badge variant="outline">{typeLabels[template.type]}</Badge>
              </div>
              <Switch checked={template.is_active} onCheckedChange={() => handleToggle(template.id)} />
            </CardHeader>
            <CardContent className="space-y-3">
              {template.type === 'reminder' && (
                <div className="flex flex-wrap gap-4">
                  <div>
                    <Label>Dias antes do vencimento</Label>
                    <Input type="number" min={1} max={30} value={reminderDays}
                      onChange={(e) => setReminderDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                      className="w-32 mt-1" />
                  </div>
                  <div>
                    <Label>Horário de envio</Label>
                    <Input type="time" value={sendTimeReminder}
                      onChange={(e) => setSendTimeReminder(e.target.value)}
                      className="w-32 mt-1" />
                  </div>
                </div>
              )}
              {template.type === 'due' && (
                <div>
                  <Label>Horário de envio</Label>
                  <Input type="time" value={sendTimeDue}
                    onChange={(e) => setSendTimeDue(e.target.value)}
                    className="w-32 mt-1" />
                </div>
              )}
              {template.type === 'overdue' && (
                <div className="flex flex-wrap gap-4">
                  <div>
                    <Label>Cobrar a cada (dias)</Label>
                    <Input type="number" min={1} max={30} value={overdueFrequency}
                      onChange={(e) => setOverdueFrequency(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                      className="w-32 mt-1" />
                  </div>
                  <div>
                    <Label>Horário de envio</Label>
                    <Input type="time" value={sendTimeOverdue}
                      onChange={(e) => setSendTimeOverdue(e.target.value)}
                      className="w-32 mt-1" />
                  </div>
                </div>
              )}
              <div>
                <Label>Conteúdo da mensagem</Label>
                <Textarea
                  value={template.content}
                  onChange={(e) => setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, content: e.target.value } : t)))}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSaveAll} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar Tudo
        </Button>
      </div>
    </div>
  );
};

export default MensagensPage;
