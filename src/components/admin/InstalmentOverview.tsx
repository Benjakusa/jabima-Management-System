import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, AlertTriangle } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

const InstalmentOverview = () => {
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['instalment-schedules-overview'],
    queryFn: async () => {
      const { data } = await supabase
        .from('instalment_schedule' as any)
        .select('*, sales(customer_name, product_type, selling_price)')
        .order('due_date', { ascending: true });
      return data || [];
    },
  });

  if (isLoading) return <div className="p-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;

  const overdue = (schedules || []).filter((s: any) => s.status === 'overdue' || (s.status === 'pending' && new Date(s.due_date) < new Date()));
  const upcoming = (schedules || []).filter((s: any) => s.status === 'pending' && new Date(s.due_date) >= new Date());
  const paid = (schedules || []).filter((s: any) => s.status === 'paid');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Card className="border border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Overdue</p>
            <p className="text-lg font-bold text-destructive">{overdue.length}</p>
          </CardContent>
        </Card>
        <Card className="border border-warning/30 bg-warning/5">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Upcoming</p>
            <p className="text-lg font-bold text-warning">{upcoming.length}</p>
          </CardContent>
        </Card>
        <Card className="border border-success/30 bg-success/5">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-success">{paid.length}</p>
          </CardContent>
        </Card>
      </div>

      {overdue.length > 0 && (
        <Card className="border border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Overdue Instalments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdue.slice(0, 10).map((inst: any) => (
              <div key={inst.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-destructive/5 text-xs">
                <div>
                  <span className="font-medium">{inst.sales?.customer_name || 'Unknown'}</span>
                  <span className="text-muted-foreground ml-2">{inst.sales?.product_type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{formatCurrency(inst.amount_due)}</span>
                  <Badge variant="destructive" className="text-[9px]">Overdue</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InstalmentOverview;
