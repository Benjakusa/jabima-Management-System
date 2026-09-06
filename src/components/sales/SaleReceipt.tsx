import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Mail, MessageCircle, FileDown, Printer } from 'lucide-react';
import logoImage from '@/assets/logo.png';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Props {
  saleId: string;
  type: 'product' | 'service';
}

const COMPANY = {
  name: 'JABIMA FUNERAL DIRECTORS',
  phone: '+254 724 645137',
  email: 'info@jabima.co.ke',
  tagline: 'Honoring Life, Celebrating Memories',
  website: 'www.jabima.co.ke',
};

const ADMIN_EMAIL = 'info@jabimafuneraldirectors.co.ke';

type PrintSize = 'thermal' | 'a4';

const SaleReceipt = ({ saleId, type }: Props) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [printSize, setPrintSize] = useState<PrintSize>('thermal');
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

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

  const { data: adminProfile } = useQuery({
    queryKey: ['admin-profile-receipt'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('phone, email')
        .eq('email', ADMIN_EMAIL)
        .maybeSingle();
      return data as { phone: string | null; email: string } | null;
    },
  });

  const displayPhone = adminProfile?.phone || COMPANY.phone;
  const displayEmail = adminProfile?.email || COMPANY.email;

  const { data: paymentTxns } = useQuery({
    queryKey: ['receipt-payments', saleId],
    enabled: !!sale && type === 'product',
    queryFn: async () => {
      const { data } = await supabase.from('payment_transactions' as any).select('*').eq('sale_id', saleId);
      return (data || []) as any[];
    },
  });

  const { data: instalments } = useQuery({
    queryKey: ['receipt-instalments', saleId],
    enabled: !!sale && type === 'product',
    queryFn: async () => {
      const { data } = await supabase.from('instalment_schedule' as any).select('*').eq('sale_id', saleId).order('due_date');
      return (data || []) as any[];
    },
  });

  const generatePDFBlob = async (): Promise<Blob | null> => {
    const printContent = receiptRef.current;
    if (!printContent) return null;

    const canvas = await html2canvas(printContent, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: false,
      useCORS: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 190;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF({
      orientation: imgHeight > imgWidth ? 'portrait' : 'portrait',
      unit: 'mm',
      format: printSize === 'a4' ? 'a4' : [58, Math.max(imgHeight, 80)],
    });

    if (printSize === 'thermal') {
      pdf.addImage(imgData, 'PNG', 0, 0, 58, imgHeight * (58 / imgWidth));
    } else {
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
    }

    const blob = pdf.output('blob');
    setPdfBlob(blob);
    return blob;
  };

const formatReceiptText = () => {
    if (!sale) return '';
    const saleData = sale as any;
    const amount = type === 'product' ? saleData.selling_price : saleData.amount;
    const itemName = type === 'product' ? saleData.product_type : saleData.service_name;
    const cashT = cashTotal || 0;
    const mpesaT = mpesaTotal || 0;
    const isLipaT = !!saleData.is_lipa_pole_pole;
    const remainingT = remainingBalance || 0;

    let paymentLines = `Mode: ${isLipaT ? 'LIPA POLE POLE' : 'FULL PAYMENT'}`;
    if (hasPaymentTxns) {
      if (cashT > 0) paymentLines += `\nCash: Ksh ${cashT.toLocaleString()}`;
      if (mpesaT > 0) paymentLines += `\nM-Pesa: Ksh ${mpesaT.toLocaleString()}`;
    } else {
      paymentLines += `\nPayment: ${saleData.payment_method === 'cash' ? 'CASH' : 'M-PESA'}`;
      if (saleData.payment_method === 'cash') {
        paymentLines += `\nCash: Ksh ${saleData.amount_received}\nChange: Ksh ${saleData.change_given}`;
      }
    }
    if (isLipaT && remainingT > 0) {
      paymentLines += `\nRemaining: Ksh ${remainingT.toLocaleString()}`;
    }

    const todayStr = new Date(sale.created_at).toISOString().slice(0,10).replace(/-/g,'');
    return `${COMPANY.name}\nTel: ${displayPhone}\nEmail: ${displayEmail}\n\n══════════════════════════════\nSALES RECEIPT\nReceipt #: ${sale.id.slice(0, 8).toUpperCase()}\n══════════════════════════════\n\nDate: ${new Date(sale.created_at).toLocaleDateString()}\nTime: ${new Date(sale.created_at).toLocaleTimeString()}\n${type === 'product' ? 'Product' : 'Service'}: ${itemName}\n\nCustomer: ${sale.customer_name}${sale.customer_phone ? `\nPhone: ${sale.customer_phone}` : ''}\n\n──────────────────────────────\n${paymentLines}\n\n══════════════════════════════\nTOTAL: Ksh ${amount.toLocaleString()}\n══════════════════════════════\n\nServed by: ${officerProfile?.full_name || 'Staff'}\nThank you for choosing\nJabima Funeral Directors`;
  };

  const sharePDFViaWhatsApp = async () => {
    if (!sale) return;
    const blob = pdfBlob || await generatePDFBlob();
    if (!blob) return;

    downloadPDF(blob);

    const file = new File([blob], `receipt-${sale.id.slice(0, 8).toUpperCase()}.pdf`, {
      type: 'application/pdf',
    });

    if (navigator.share) {
      await navigator.share({
        files: [file],
        title: `Receipt #${sale.id.slice(0, 8).toUpperCase()}`,
        text: `${COMPANY.name} Receipt`,
      });
    } else {
      const waUrl = `https://wa.me/?text=${encodeURIComponent(formatReceiptText())}`;
      const a = document.createElement('a');
      a.href = waUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

const sharePDFViaEmail = async () => {
    if (!sale) return;
    const blob = pdfBlob || await generatePDFBlob();
    if (!blob) return;

    downloadPDF(blob);

    const subject = `Sales Receipt #${sale.id.slice(0, 8).toUpperCase()} - ${COMPANY.name}`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(formatReceiptText())}`;
    window.location.href = mailtoUrl;
  };

  const printReceipt = () => {
    if (!receiptRef.current) return;

    const printSizeVal = printSize === 'a4' ? 'A4' : '58mm';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <style>
            @page { margin: 0; size: ${printSizeVal} auto; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .rpt-divider { border-color: #999; }
            .rpt-total-box { border: 2px solid #22c55e !important; background: none !important; }
            h2, h3 { text-align: center; }
            p { margin: 4px 0; }
          </style>
        </head>
        <body>
          ${receiptRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const downloadPDF = async (existingBlob?: Blob) => {
    if (!sale) return;
    const blob = existingBlob || pdfBlob || await generatePDFBlob();
    if (!blob) return;

    const fileName = `Receipt-${sale.id.slice(0, 8).toUpperCase()}.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading || !sale) {
    return <div className="bg-card rounded-2xl border p-8 animate-pulse h-96" />;
  }

  const s = sale as any;
  const amount = type === 'product' ? s.selling_price : s.amount;
  const itemName = type === 'product' ? s.product_type : s.service_name;
  const itemLabel = type === 'product' ? 'Product' : 'Service';
  const cashTotal = paymentTxns?.filter((t: any) => t.payment_method === 'cash').reduce((s: number, t: any) => s + t.amount, 0) || 0;
  const mpesaTotal = paymentTxns?.filter((t: any) => t.payment_method === 'mpesa').reduce((s: number, t: any) => s + t.amount, 0) || 0;
  const hasPaymentTxns = !!(paymentTxns && paymentTxns.length > 0);

  const instalTotalDue = instalments?.reduce((s: number, i: any) => s + (i.amount_due || 0), 0) || 0;
  const instalTotalPaid = instalments?.reduce((s: number, i: any) => s + (i.amount_paid || 0), 0) || 0;
  const remainingBalance = Math.max(0, instalTotalDue - instalTotalPaid);
  const isLipa = !!s.is_lipa_pole_pole;

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
        <Button onClick={() => downloadPDF()} variant="outline" size="lg" className="flex-1">
          <FileDown className="h-4 w-4" />Download
        </Button>
        <Button onClick={sharePDFViaWhatsApp} variant="outline" size="lg" className="flex-1">
          <MessageCircle className="h-4 w-4" />WhatsApp
        </Button>
        <Button onClick={printReceipt} variant="outline" size="lg" className="flex-1">
          <Printer className="h-4 w-4" />Print
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
          <p style={{ fontSize: printSize === 'a4' ? '9px' : '6px', color: '#444', textAlign: 'center' }}>{displayPhone} &bull; {displayEmail}</p>
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
              <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Mode</span>
              <span className="rpt-value" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>{isLipa ? 'LIPA POLE POLE' : 'FULL PAYMENT'}</span>
            </div>
            {hasPaymentTxns ? (
              <>
                {cashTotal > 0 && (
                  <div className="rpt-row">
                    <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Cash</span>
                    <span className="rpt-value" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Ksh {cashTotal.toLocaleString()}</span>
                  </div>
                )}
                {mpesaTotal > 0 && (
                  <div className="rpt-row">
                    <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>M-Pesa</span>
                    <span className="rpt-value" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>Ksh {mpesaTotal.toLocaleString()}</span>
                  </div>
                )}
                {paymentTxns.filter((t: any) => t.payment_method === 'mpesa').map((t: any) => t.reference_number).filter(Boolean).length > 0 && (
                  <div className="rpt-row">
                    <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>M-Pesa Ref</span>
                    <span className="rpt-value rpt-mono" style={{ fontSize: printSize === 'a4' ? '11px' : '8px' }}>
                      {paymentTxns.filter((t: any) => t.payment_method === 'mpesa').map((t: any) => t.reference_number).filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
            {isLipa && remainingBalance > 0 && (
              <div className="rpt-row" style={{ borderTop: '1px dashed #ccc', paddingTop: 6, marginTop: 4 }}>
                <span className="rpt-label" style={{ fontSize: printSize === 'a4' ? '11px' : '8px', fontWeight: 'bold' }}>Remaining Balance</span>
                <span className="rpt-value" style={{ fontSize: printSize === 'a4' ? '11px' : '8px', fontWeight: 'bold', color: '#dc2626' }}>Ksh {remainingBalance.toLocaleString()}</span>
              </div>
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