import { DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const FinanceiroPage = () => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <div className="rounded-full bg-primary/10 p-4">
            <DollarSign className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-card-foreground">Financeiro</h2>
          <p className="text-muted-foreground text-center text-sm">
            Esta área está em desenvolvimento e estará disponível em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceiroPage;
