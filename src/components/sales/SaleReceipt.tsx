import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Printer, Share2, Mail, MessageCircle, Download } from 'lucide-react';
import logoImage from '@/assets/logo.png';

interface Props {
  saleId: string;
  type: 'product' | 'service';
}

const COMPANY = {
  name: 'JABIMA FUNERAL DIRECTORS',
  phone: '+254 XXX XXX XXX',
  email: 'info@jabima.co.ke',
  tagline: 'Honoring Life, Celebrating Memories',
  website: 'www.jabima.co.ke',
};

type PrintSize = 'thermal' | 'a4';

const SaleReceipt = ({ saleId, type }: Props) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [printSize, setPrintSize] = useState<PrintSize>('thermal');

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

  const generatePDFBlob = async (): Promise<Blob | null> => {
    const printContent = receiptRef.current;
    if (!printContent) return null;
    const size = printSize;
    const winWidth = size === 'a4' ? '210mm' : '58mm';
    const padding = size === 'a4' ? '15mm' : '2mm';
    const fontSize = size === 'a4' ? '12px' : '9px';
    
    const html = `
      <!DOCTYPE html>
      <html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Receipt - ${COMPANY.name}</title>
        <style>
          @page { margin: 0; size: ${size === 'a4' ? 'A4' : '58mm auto'}; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', Courier, monospace; 
            width: ${winWidth}; 
            margin: 0 auto;
            padding: ${padding}; 
            font-size: ${fontSize}; 
            line-height: 1.3;
            background: white;
          }
          .header { text-align: center; margin-bottom: 8px; }
          .logo { width: ${size === 'a4' ? '80px' : '40px'}; height: ${size === 'a4' ? '80px' : '40px'}; }
          .company { font-size: ${size === 'a4' ? '16px' : '10px'}; font-weight: bold; }
          .tagline { font-size: ${size === 'a4' ? '10px' : '7px'}; font-style: italic; }
          .contact { font-size: ${size === 'a4' ? '9px' : '7px'}; }
          .title { font-size: ${size === 'a4' ? '14px' : '11px'}; font-weight: bold; margin: 6px 0; }
          .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
          .divider-solid { border-bottom: 2px solid #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; }
          .row .label { color: #666; }
          .row .value { text-align: right; max-width: 65%; word-break: break-word; }
          .row.mono { font-family: monospace; }
          .total-box { text-align: center; padding: 8px; border: 2px solid #22c55e; margin: 8px 0; }
          .total-label { font-size: ${size === 'a4' ? '12px' : '9px'}; }
          .total-amount { font-size: ${size === 'a4' ? '20px' : '14px'}; font-weight: bold; color: #16a34a; }
          .footer { text-align: center; font-size: ${size === 'a4' ? '9px' : '7px'}; margin-top: 10px; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head><body>${printContent.innerHTML}</body></html>
    `;
    
    return new Blob([html], { type: 'text/html' });
  };

const formatReceiptText = () => {
    if (!sale) return '';
    const saleData = sale as any;
    const amount = type === 'product' ? saleData.selling_price : saleData.amount;
    const itemName = type === 'product' ? saleData.product_type : saleData.service_name;
    const isCashPayment = saleData.payment_method === 'cash';
    const todayStr = new Date(sale.created_at).toISOString().slice(0,10).replace(/-/g,'');
    return `${COMPANY.name}\nTel: ${COMPANY.phone}\nEmail: ${COMPANY.email}\n\n══════════════════════════════\nSALES RECEIPT\nReceipt #: ${sale.id.slice(0, 8).toUpperCase()}\n══════════════════════════════\n\nDate: ${new Date(sale.created_at).toLocaleDateString()}\nTime: ${new Date(sale.created_at).toLocaleTimeString()}\n${type === 'product' ? 'Product' : 'Service'}: ${itemName}\n\nCustomer: ${sale.customer_name}${sale.customer_phone ? `\nPhone: ${sale.customer_phone}` : ''}\n\n──────────────────────────────\nPayment: ${isCashPayment ? 'CASH' : 'M-PESA'}\nRef: ${isCashPayment ? `CSH-${todayStr}-${sale.id.slice(0,6).toUpperCase()}` : saleData.mpesa_code}${isCashPayment ? `\nCash: Ksh ${saleData.amount_received}\nChange: Ksh ${saleData.change_given}` : ''}\n\n══════════════════════════════\nTOTAL: Ksh ${amount.toLocaleString()}\n══════════════════════════════\n\nServed by: ${officerProfile?.full_name || 'Staff'}\nThank you for choosing\nJabima Funeral Directors`;
  };

  const sharePDFViaWhatsApp = async () => {
    if (!sale) return;
    const blob = await generatePDFBlob();
    if (!blob) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      const text = `Sales Receipt - ${COMPANY.name}\nReceipt #: ${sale.id.slice(0, 8).toUpperCase()}\n\nPlease find attached receipt.`;
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    };
    reader.readAsDataURL(blob);
  };

  const sharePDFViaEmail = async () => {
    if (!sale) return;
    const blob = await generatePDFBlob();
    if (!blob) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const subject = `Sales Receipt - ${sale.id.slice(0, 8).toUpperCase()}`;
      const body = `Dear Customer,\n\nPlease find attached your sales receipt from ${COMPANY.name}.\n\nReceipt #: ${sale.id.slice(0, 8).toUpperCase()}\nAmount: Ksh ${(type === 'product' ? (sale as any).selling_price : (sale as any).amount).toLocaleString()}\n\nThank you for choosing ${COMPANY.name}.\n\nBest regards,\n${COMPANY.name}`;
      const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoUrl;
    };
    reader.readAsDataURL(blob);
  };

  const downloadPDF = () => {
    const printContent = receiptRef.current;
    if (!printContent || !sale) return;
    
    const win = window.open('', '_blank');
    if (!win) return;
    const size = printSize;
    const winWidth = size === 'a4' ? '210mm' : '58mm';
    const padding = size === 'a4' ? '15mm' : '2mm';
    const fontSize = size === 'a4' ? '12px' : '9px';
    
    win.document.write(`
      <!DOCTYPE html>
      <html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Receipt - ${sale.id.slice(0, 8).toUpperCase()}</title>
        <style>
          @page { margin: 0; size: ${size === 'a4' ? 'A4' : '58mm auto'}; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', Courier, monospace; 
            width: ${winWidth}; 
            margin: 0 auto;
            padding: ${padding}; 
            font-size: ${fontSize}; 
            line-height: 1.3;
            background: white;
          }
          .total-amount { color: #16a34a !important; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head><body>${printContent.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 250);
  };

  if (isLoading || !sale) {
    return <div className="bg-card rounded-2xl border p-8 animate-pulse h-96" />;
  }

  const s = sale as any;
  const amount = type === 'product' ? s.selling_price : s.amount;
  const itemName = type === 'product' ? s.product_type : s.service_name;
  const itemLabel = type === 'product' ? 'Product' : 'Service';
  const isCashPayment = s.payment_method === 'cash';
  const paymentMethodDisplay = isCashPayment ? 'CASH' : 'M-PESA';
  const today = new Date(sale.created_at).toISOString().slice(0,10).replace(/-/g,'');
  const cashReference = isCashPayment 
    ? `CSH-${today}-${sale.id.slice(0,6).toUpperCase()}`
    : '';

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <select 
          value={printSize} 
          onChange={(e) => setPrintSize(e.target.value as PrintSize)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="thermal">Thermal (58mm)</option>
          <option value="a4">A4 Paper</option>
        </select>
        <Button onClick={downloadPDF} variant="outline" size="lg" className="flex-1">
          <Printer className="h-4 w-4" />Print
        </Button>
        <Button onClick={sharePDFViaWhatsApp} variant="outline" size="lg" className="flex-1">
          <MessageCircle className="h-4 w-4" />WhatsApp
        </Button>
        <Button onClick={sharePDFViaEmail} variant="outline" size="lg" className="flex-1">
          <Mail className="h-4 w-4" />Email
        </Button>
      </div>

      <div ref={receiptRef} className="bg-white/80 backdrop-blur-sm rounded-lg border-2 border-black/20 overflow-hidden mx-auto shadow-lg"
        style={{ width: printSize === 'a4' ? '190mm' : '58mm', minWidth: printSize === 'a4' ? 'auto' : '58mm', maxWidth: '100%' }}>
        <style>{`
          .rpt-divider { border-top: 1px dashed #666; margin: 8px 0; }
          .rpt-divider-solid { border-top: 2px solid #000; margin: 10px 0; }
          .rpt-row { display: flex; justify-content: space-between; padding: 2px 0; align-items: baseline; }
          .rpt-label { color: #444; }
          .rpt-value { text-align: right; word-break: break-word; }
          .rpt-mono { font-family: 'Courier New', monospace; }
          .rpt-total-box { border: 2px solid #22c55e; padding: 12px; text-align: center; margin: 8px 0; border-radius: 8px; background: linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.05) 100%); }
          @media print {
            @page { margin: 0; ${printSize === 'a4' ? 'size: A4' : 'size: 58mm auto'}; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .rpt-divider { border-color: #999; }
            .rpt-total-box { border: 2px solid #22c55e !important; background: none !important; }
          }
        `}</style>

        {/* Header */}
        <div className="p-3 text-center border-b-2 border-black/80 bg-gradient-to-b from-white to-gray-50" style={{ textAlign: 'center' }}>
          <img src={logoImage} alt="Jabima" className="mx-auto mb-2" 
            style={{ width: printSize === 'a4' ? '72px' : '40px', height: printSize === 'a4' ? '72px' : '40px', objectFit: 'contain' }} />
          <h2 className="font-bold" style={{ fontSize: printSize === 'a4' ? '18px' : '11px', textAlign: 'center' }}>{COMPANY.name}</h2>
          <p className="italic" style={{ fontSize: printSize === 'a4' ? '10px' : '7px', color: '#666', textAlign: 'center' }}>{COMPANY.tagline}</p>
          <p style={{ fontSize: printSize === 'a4' ? '9px' : '6px', color: '#444', textAlign: 'center' }}>{COMPANY.phone} &bull; {COMPANY.email}</p>
          <p style={{ fontSize: printSize === 'a4' ? '9px' : '6px', color: '#444', textAlign: 'center' }}>{COMPANY.website}</p>
          {branch && (
            <p style={{ fontSize: printSize === 'a4' ? '9px' : '6px', color: '#444', textAlign: 'center' }}>{branch.name}{branch.location ? ` - ${branch.location}` : ''}</p>
          )}
        </div>

        <div className="p-3">
          {/* Receipt Title */}
          <div className="text-center mb-2" style={{ textAlign: 'center' }}>
            <h3 className="font-bold" style={{ fontSize: printSize === 'a4' ? '14px' : '10px', textAlign: 'center' }}>SALES RECEIPT</h3>
            <p style={{ fontSize: printSize === 'a4' ? '10px' : '7px', textAlign: 'center' }}>Receipt #: {sale.id.slice(0, 8).toUpperCase()}</p>
          </div>

          <div className="rpt-divider-solid" />

          {/* Transaction Info */}
          <div className="space-y-1">
            <div className="rpt-row">
              <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Date</span>
              <span className="rpt-value" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>{new Date(sale.created_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="rpt-row">
              <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Time</span>
              <span className="rpt-value" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>{new Date(sale.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="rpt-row">
              <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>{itemLabel}</span>
              <span className="rpt-value font-medium" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>{itemName}</span>
            </div>
            {type === 'product' && s.finished_product_id && (
              <div className="rpt-row">
                <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Product ID</span>
                <span className="rpt-value rpt-mono" style={{ fontSize: printSize === 'a4' ? '10px' : '7px' }}>{s.finished_product_id.slice(0, 8).toUpperCase()}</span>
              </div>
            )}
            {type === 'service' && s.description && (
              <div className="rpt-row">
                <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Details</span>
                <span className="rpt-value" style={{ fontSize: printSize === 'a4' ? '10px' : '7px', maxWidth: '60%' }}>{s.description}</span>
              </div>
            )}
          </div>

          <div className="rpt-divider" />

          {/* Customer Info */}
          <div className="space-y-1">
            <div className="rpt-row">
              <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Customer</span>
              <span className="rpt-value font-medium" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>{sale.customer_name}</span>
            </div>
            {sale.customer_phone && (
              <div className="rpt-row">
                <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Phone</span>
                <span className="rpt-value" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>{sale.customer_phone}</span>
              </div>
            )}
          </div>

          <div className="rpt-divider" />

          {/* Payment Info */}
          <div className="space-y-1">
            <div className="rpt-row">
              <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Payment Method</span>
              <span className="rpt-value" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>{paymentMethodDisplay}</span>
            </div>
            <div className="rpt-row">
              <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Reference</span>
              <span className="rpt-value rpt-mono" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>
                {isCashPayment ? cashReference : (sale.mpesa_code || 'N/A')}
              </span>
            </div>
            {isCashPayment && (
              <>
                <div className="rpt-row">
                  <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Cash Received</span>
                  <span className="rpt-value" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Ksh {s.amount_received?.toLocaleString()}</span>
                </div>
                <div className="rpt-row">
                  <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Change Given</span>
                  <span className="rpt-value" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Ksh {s.change_given?.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>

          <div className="rpt-divider-solid" />

          {/* Total */}
          <div className="rpt-total-box">
            <p style={{ fontSize: printSize === 'a4' ? '11px' : '8px', color: '#666' }}>TOTAL AMOUNT</p>
            <p className="font-bold" style={{ fontSize: printSize === 'a4' ? '22px' : '14px', color: '#16a34a' }}>Ksh {amount.toLocaleString()}</p>
          </div>

          <div className="rpt-divider-solid" />

          {/* Served by */}
          <div className="rpt-row">
            <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Served by</span>
            <span className="rpt-value font-medium" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>{officerProfile?.full_name || 'Staff'}</span>
          </div>

          {/* Footer */}
          <div className="text-center mt-4 pt-2 border-t border-dashed border-gray-400">
            <p className="font-medium" style={{ fontSize: printSize === 'a4' ? '10px' : '7px' }}>Thank you for choosing</p>
            <p style={{ fontSize: printSize === 'a4' ? '9px' : '6px' }}>Jabima Funeral Directors</p>
            <p className="italic mt-1" style={{ fontSize: printSize === 'a4' ? '8px' : '5px' }}>This is a computer-generated receipt</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaleReceipt;