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
import { fetchSettings, saveSettings } from '@/services/data-layer';
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
      await saveSettings({
        reminder_days: String(reminderDays),
        send_time_reminder: sendTimeReminder,
        send_time_due: sendTimeDue,
        send_time_overdue: sendTimeOverdue,
        overdue_frequency: String(overdueFrequency),
      });
      // Also save to localStorage for backward compat
      localStorage.setItem('cobranca_reminder_days', String(reminderDays));
      localStorage.setItem('cobranca_send_time_reminder', sendTimeReminder);
      localStorage.setItem('cobranca_send_time_due', sendTimeDue);
      localStorage.setItem('cobranca_send_time_overdue', sendTimeOverdue);
      localStorage.setItem('cobranca_overdue_frequency', String(overdueFrequency));
      toast.success('Todas as configurações salvas!');
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
      <p className="text-sm text-muted-foreground">
        Variáveis disponíveis: <code className="rounded bg-secondary px-1">{'{nome}'}</code>,{' '}
        <code className="rounded bg-secondary px-1">{'{valor}'}</code>,{' '}
        <code className="rounded bg-secondary px-1">{'{data_vencimento}'}</code>,{' '}
        <code className="rounded bg-secondary px-1">{'{dias_atraso}'}</code>,{' '}
        <code className="rounded bg-secondary px-1">{'{link_pagamento}'}</code>
      </p>

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
