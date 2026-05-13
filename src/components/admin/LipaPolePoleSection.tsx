import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BadgePercent, Calendar } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

const LipaPolePoleSection = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [saleForm, setSaleForm] = useState({ deposit: '', frequency: 'monthly', num_instalments: '3' });

  const { data: openSales, isLoading } = useQuery({
    queryKey: ['open-sales-lipa'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales' as any)
        .select('id, customer_name, product_type, selling_price, amount_paid, payment_status')
        .in('payment_status', ['unpaid', 'partial'])
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const generateInstalments = useMutation({
    mutationFn: async () => {
      if (!selectedSaleId) throw new Error('Select a sale');
      const sale = (openSales || []).find((s: any) => s.id === selectedSaleId);
      if (!sale) throw new Error('Sale not found');
      const total = (sale as any).selling_price;
      const deposit = parseFloat(saleForm.deposit) || 0;
      const num = parseInt(saleForm.num_instalments) || 1;
      const remaining = total - deposit;
      const perInstallment = remaining / num;
      const startDate = new Date();
      const rows = [];

      for (let i = 0; i < num; i++) {
        const due = new Date(startDate);
        if (saleForm.frequency === 'weekly') due.setDate(due.getDate() + (i + 1) * 7);
        else if (saleForm.frequency === 'monthly') due.setMonth(due.getMonth() + (i + 1));
        else due.setMonth(due.getMonth() + (i + 1) * 3);
        rows.push({
          sale_id: selectedSaleId,
          due_date: due.toISOString().split('T')[0],
          amount_due: i === num - 1 ? remaining - perInstallment * (num - 1) : perInstallment,
          amount_paid: 0,
          status: 'pending',
        });
      }

      const { error } = await supabase.from('instalment_schedule' as any).insert(rows);
      if (error) throw error;

      const { error: updateError } = await supabase
        .from('sales')
        .update({ is_lipa_pole_pole: true, instalment_plan: saleForm.frequency, amount_paid: deposit, payment_status: deposit > 0 ? 'partial' : 'unpaid' } as any)
        .eq('id', selectedSaleId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast({ title: 'Instalment plan created' });
      setSelectedSaleId('');
      setSaleForm({ deposit: '', frequency: 'monthly', num_instalments: '3' });
      queryClient.invalidateQueries({ queryKey: ['open-sales-lipa'] });
      queryClient.invalidateQueries({ queryKey: ['instalment-schedules'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const selectedSale = (openSales || []).find((s: any) => s.id === selectedSaleId);

  return (
    <Card className="border border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BadgePercent className="h-4 w-4 text-primary" />
          Lipa Pole Pole — Instalment Plans
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-xs">Select Open Sale</Label>
              <select value={selectedSaleId} onChange={(e) => setSelectedSaleId(e.target.value)}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm">
                <option value="">Choose sale...</option>
                {(openSales || []).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.customer_name} — {s.product_type} — {formatCurrency(s.selling_price)} ({s.payment_status})
                  </option>
                ))}
              </select>
            </div>

            {selectedSale && (
              <div className="bg-accent/20 rounded-lg p-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Total: <span className="font-bold text-foreground">{formatCurrency((selectedSale as any).selling_price)}</span>
                  {' · '}Paid: <span className="font-medium">{formatCurrency((selectedSale as any).amount_paid || 0)}</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px]">Deposit</Label>
                    <Input type="number" value={saleForm.deposit} onChange={e => setSaleForm(f => ({ ...f, deposit: e.target.value }))} className="h-9 text-sm" placeholder="0" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Frequency</Label>
                    <select value={saleForm.frequency} onChange={e => setSaleForm(f => ({ ...f, frequency: e.target.value }))}
                      className="w-full h-9 rounded-lg border border-input bg-background px-2 text-xs">
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Instalments</Label>
                    <Input type="number" min="1" max="24" value={saleForm.num_instalments} onChange={e => setSaleForm(f => ({ ...f, num_instalments: e.target.value }))} className="h-9 text-sm" />
                  </div>
                </div>
                <Button size="sm" className="w-full text-xs" onClick={() => generateInstalments.mutate()}
                  disabled={generateInstalments.isPending || !selectedSaleId}>
                  {generateInstalments.isPending ? <Loader2 className="animate-spin h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                  Generate Instalment Schedule
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default LipaPolePoleSection;
