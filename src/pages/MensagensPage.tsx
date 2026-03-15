import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { mockTemplates } from '@/services/mock-data';
import { Save, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const typeLabels: Record<string, string> = {
  reminder: 'Lembrete',
  due: 'Vencimento',
  overdue: 'Atraso',
  receipt: 'Recibo',
  blocked: 'Bloqueio',
};

const MensagensPage = () => {
  const [templates, setTemplates] = useState(mockTemplates);
  const [reminderDays, setReminderDays] = useState(() => {
    return Number(localStorage.getItem('cobranca_reminder_days') || '3');
  });
  const [sendTime, setSendTime] = useState(() => {
    return localStorage.getItem('cobranca_send_time') || '08:00';
  });

  useEffect(() => {
    localStorage.setItem('cobranca_reminder_days', String(reminderDays));
  }, [reminderDays]);

  useEffect(() => {
    localStorage.setItem('cobranca_send_time', sendTime);
  }, [sendTime]);

  const handleSave = (id: number, content: string) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, content } : t)));
    toast.success('Template salvo!');
  };

  const handleToggle = (id: number) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, is_active: !t.is_active } : t)));
  };

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
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={reminderDays}
                      onChange={(e) => setReminderDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                      className="w-32 mt-1"
                    />
                  </div>
                  <div>
                    <Label>Horário de envio</Label>
                    <Input
                      type="time"
                      value={sendTime}
                      onChange={(e) => setSendTime(e.target.value)}
                      className="w-32 mt-1"
                    />
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
              <Button size="sm" onClick={() => handleSave(template.id, template.content)}>
                <Save className="mr-2 h-3 w-3" /> Salvar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MensagensPage;
