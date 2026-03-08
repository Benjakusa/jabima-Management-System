import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Printer, Share2, Download } from 'lucide-react';

interface Props {
  saleId: string;
  type: 'product' | 'service';
}

const SaleReceipt = ({ saleId, type }: Props) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const { data: sale, isLoading } = useQuery({
    queryKey: ['receipt-data', saleId, type],
    queryFn: async () => {
      if (type === 'product') {
        const { data, error } = await supabase.from('sales').select('*').eq('id', saleId).single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.from('service_sales').select('*').eq('id', saleId).single();
        if (error) throw error;
        return data;
      }
    },
  });

  const { data: officerProfile } = useQuery({
    queryKey: ['receipt-officer', sale?.sales_officer_id],
    enabled: !!sale,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('full_name').eq('user_id', sale!.sales_officer_id).single();
      return data;
    },
  });

  const { data: branch } = useQuery({
    queryKey: ['receipt-branch', (sale as any)?.branch_id],
    enabled: !!(sale as any)?.branch_id,
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('name, location').eq('id', (sale as any).branch_id).single();
      return data;
    },
  });

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
        body { padding: 20px; }
        ${printContent.querySelector('style')?.textContent || ''}
      </style>
      </head><body>${printContent.innerHTML}</body></html>
    `);
    win.document.close();
    win.print();
  };

  const handleShare = async () => {
    if (!sale) return;
    const amount = type === 'product' ? (sale as any).selling_price : (sale as any).amount;
    const itemName = type === 'product' ? (sale as any).product_type : (sale as any).service_name;
    const text = `Jabima Funeral Directors\nReceipt\n\n${type === 'product' ? 'Product' : 'Service'}: ${itemName}\nAmount: Ksh ${amount.toLocaleString()}\nCustomer: ${sale.customer_name}\nMPESA: ${sale.mpesa_code}\nDate: ${new Date(sale.created_at).toLocaleDateString()}\n\nThank you for your business.`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Jabima Receipt', text });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  if (isLoading || !sale) {
    return <div className="bg-card rounded-2xl border p-8 animate-pulse h-96" />;
  }

  const amount = type === 'product' ? (sale as any).selling_price : (sale as any).amount;
  const itemName = type === 'product' ? (sale as any).product_type : (sale as any).service_name;
  const itemLabel = type === 'product' ? 'Product' : 'Service';

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex gap-2">
        <Button onClick={handlePrint} variant="outline" size="lg" className="flex-1">
          <Printer className="h-4 w-4" />
          Print
        </Button>
        <Button onClick={handleShare} variant="outline" size="lg" className="flex-1">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </div>

      {/* Receipt */}
      <div ref={receiptRef} className="bg-card rounded-2xl border overflow-hidden">
        <style>{`
          .receipt-divider { border-top: 1px dashed hsl(var(--border)); margin: 16px 0; }
        `}</style>

        {/* Header */}
        <div className="bg-primary px-6 py-5 text-center">
          <div className="w-14 h-14 bg-primary-foreground/20 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <span className="text-primary-foreground font-display text-2xl font-bold">J</span>
          </div>
          <h2 className="font-display text-xl font-bold text-primary-foreground">Jabima Funeral Directors</h2>
          {branch && (
            <p className="text-primary-foreground/70 text-sm mt-1">{branch.name}{branch.location ? ` • ${branch.location}` : ''}</p>
          )}
        </div>

        <div className="px-6 py-5">
          {/* Receipt title */}
          <div className="text-center mb-4">
            <h3 className="font-display text-lg font-bold text-foreground">SALES RECEIPT</h3>
            <p className="text-xs text-muted-foreground">Receipt #{sale.id.slice(0, 8).toUpperCase()}</p>
          </div>

          <div className="receipt-divider" />

          {/* Sale details */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium text-foreground">{new Date(sale.created_at).toLocaleDateString('en-KE', { dateStyle: 'long' })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{itemLabel}</span>
              <span className="font-medium text-foreground">{itemName}</span>
            </div>
            {type === 'product' && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Product ID</span>
                <span className="font-medium text-foreground font-mono text-xs">{(sale as any).finished_product_id?.slice(0, 8)}</span>
              </div>
            )}
            {type === 'service' && (sale as any).description && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Description</span>
                <span className="font-medium text-foreground text-right max-w-[60%]">{(sale as any).description}</span>
              </div>
            )}
          </div>

          <div className="receipt-divider" />

          {/* Customer info */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium text-foreground">{sale.customer_name}</span>
            </div>
            {sale.customer_phone && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium text-foreground">{sale.customer_phone}</span>
              </div>
            )}
          </div>

          <div className="receipt-divider" />

          {/* Payment */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment Method</span>
              <span className="font-medium text-foreground">MPESA</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Transaction Code</span>
              <span className="font-medium text-foreground font-mono">{sale.mpesa_code}</span>
            </div>
          </div>

          <div className="receipt-divider" />

          {/* Total */}
          <div className="bg-success/5 border border-success/20 rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">AMOUNT PAID</p>
            <p className="text-3xl font-bold font-display text-success">Ksh {amount.toLocaleString()}</p>
          </div>

          <div className="receipt-divider" />

          {/* Officer */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Served by</span>
            <span className="font-medium text-foreground">{officerProfile?.full_name || 'Unknown'}</span>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 pt-4 border-t border-dashed border-border">
            <p className="text-xs text-muted-foreground">Thank you for choosing Jabima Funeral Directors</p>
            <p className="text-[10px] text-muted-foreground mt-1">This is a computer-generated receipt</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaleReceipt;
