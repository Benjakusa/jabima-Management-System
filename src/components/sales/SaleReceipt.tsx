import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Printer, Share2 } from 'lucide-react';

interface Props {
  saleId: string;
  type: 'product' | 'service';
}

const COMPANY = {
  name: 'JABIMA FUNERAL DIRECTORS',
  phone: '+254 XXX XXX XXX',
  email: 'info@jabima.co.ke',
};

const SaleReceipt = ({ saleId, type }: Props) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const { data: sale, isLoading } = useQuery({
    queryKey: ['receipt-data', saleId, type],
    queryFn: async () => {
      const table = type === 'product' ? 'sales' : 'service_sales';
      const { data, error } = await supabase.from(table).select('*').eq('id', saleId).single();
      if (error) throw error;
      return data;
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
    const text = `${COMPANY.name}\nTel: ${COMPANY.phone}\nEmail: ${COMPANY.email}\n\nSALES RECEIPT\nReceipt #${sale.id.slice(0, 8).toUpperCase()}\n\n${type === 'product' ? 'Product' : 'Service'}: ${itemName}\nAmount: Ksh ${amount.toLocaleString()}\nCustomer: ${sale.customer_name}\n${sale.customer_phone ? `Phone: ${sale.customer_phone}\n` : ''}MPESA: ${sale.mpesa_code}\nDate: ${new Date(sale.created_at).toLocaleDateString()}\nServed by: ${officerProfile?.full_name || 'Staff'}\n\nThank you for choosing Jabima Funeral Directors.`;

    if (navigator.share) {
      try { await navigator.share({ title: 'Jabima Receipt', text }); } catch {}
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
      <div className="flex gap-2">
        <Button onClick={handlePrint} variant="outline" size="lg" className="flex-1">
          <Printer className="h-4 w-4" />Print
        </Button>
        <Button onClick={handleShare} variant="outline" size="lg" className="flex-1">
          <Share2 className="h-4 w-4" />Share
        </Button>
      </div>

      <div ref={receiptRef} className="bg-card rounded-2xl border overflow-hidden">
        <style>{`.receipt-divider { border-top: 1px dashed hsl(var(--border)); margin: 16px 0; }`}</style>

        {/* Header */}
        <div className="bg-primary px-6 py-5 text-center">
          <div className="w-14 h-14 bg-primary-foreground/20 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <span className="text-primary-foreground font-display text-2xl font-bold">J</span>
          </div>
          <h2 className="font-display text-xl font-bold text-primary-foreground">{COMPANY.name}</h2>
          <p className="text-primary-foreground/70 text-xs mt-1">{COMPANY.phone} • {COMPANY.email}</p>
          {branch && (
            <p className="text-primary-foreground/60 text-xs mt-0.5">{branch.name}{branch.location ? ` • ${branch.location}` : ''}</p>
          )}
        </div>

        <div className="px-6 py-5">
          <div className="text-center mb-4">
            <h3 className="font-display text-lg font-bold text-foreground">SALES RECEIPT</h3>
            <p className="text-xs text-muted-foreground">Receipt #{sale.id.slice(0, 8).toUpperCase()}</p>
          </div>

          <div className="receipt-divider" />

          <div className="space-y-3">
            <Row label="Date" value={new Date(sale.created_at).toLocaleDateString('en-KE', { dateStyle: 'long' })} />
            <Row label="Time" value={new Date(sale.created_at).toLocaleTimeString('en-KE', { timeStyle: 'short' })} />
            <Row label={itemLabel} value={itemName} />
            {type === 'product' && (sale as any).finished_product_id && (
              <Row label="Product ID" value={(sale as any).finished_product_id.slice(0, 8)} mono />
            )}
            {type === 'service' && (sale as any).description && (
              <Row label="Details" value={(sale as any).description} />
            )}
          </div>

          <div className="receipt-divider" />

          <div className="space-y-3">
            <Row label="Customer" value={sale.customer_name} />
            {sale.customer_phone && <Row label="Phone" value={sale.customer_phone} />}
          </div>

          <div className="receipt-divider" />

          <div className="space-y-3">
            <Row label="Payment Method" value="M-PESA" />
            <Row label="Transaction Code" value={sale.mpesa_code} mono />
          </div>

          <div className="receipt-divider" />

          <div className="bg-success/5 border border-success/20 rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">AMOUNT PAID</p>
            <p className="text-3xl font-bold font-display text-success">Ksh {amount.toLocaleString()}</p>
          </div>

          <div className="receipt-divider" />

          <Row label="Served by" value={officerProfile?.full_name || 'Staff'} />

          <div className="text-center mt-6 pt-4 border-t border-dashed border-border">
            <p className="text-xs text-muted-foreground">Thank you for choosing {COMPANY.name}</p>
            <p className="text-[10px] text-muted-foreground mt-1">This is a computer-generated receipt</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-medium text-foreground text-right max-w-[60%] ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
  </div>
);

export default SaleReceipt;
