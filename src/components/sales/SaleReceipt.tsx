import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Mail, MessageCircle, FileDown, Printer, Loader2 } from 'lucide-react';
import logoImage from '@/assets/logo.png';
import jsPDF from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useToast } from '@/hooks/use-toast';

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
  const [busy, setBusy] = useState<'download' | 'whatsapp' | 'print' | 'email' | null>(null);
  const { toast } = useToast();
  const isNative = Capacitor.isNativePlatform();
  const receiptNo = saleId.slice(0, 8).toUpperCase();

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
    if (!sale) return null;

    // ---- receipt figures (computed here — generatePDFBlob runs before render consts) ----
    const sd = sale as any;
    const amount = type === 'product' ? sd.selling_price : sd.amount;
    const itemName = type === 'product' ? sd.product_type : sd.service_name;
    const cashT = (paymentTxns || []).filter((t: any) => t.payment_method === 'cash').reduce((n: number, t: any) => n + (t.amount || 0), 0);
    const mpesaT = (paymentTxns || []).filter((t: any) => t.payment_method === 'mpesa').reduce((n: number, t: any) => n + (t.amount || 0), 0);
    const hasPaymentTxns = !!(paymentTxns && paymentTxns.length > 0);
    const dueTotal = (instalments || []).reduce((n: number, i: any) => n + (i.amount_due || 0), 0);
    const paidTotal = (instalments || []).reduce((n: number, i: any) => n + (i.amount_paid || 0), 0);
    const remainingBalance = Math.max(0, dueTotal - paidTotal);
    const isLipa = !!sd.is_lipa_pole_pole;
    const isCashPayment = sd.payment_method === 'cash';
    const paymentMethodDisplay = isCashPayment ? 'CASH' : 'M-PESA';

    // Page geometry: thermal roll is 58mm wide, A4 is 210mm wide.
    // Centre X must be pageWidth/2 — never a hardcoded 10/60.
    const pageWidth = printSize === 'a4' ? 210 : 58;
    const margin = printSize === 'a4' ? 14 : 4;
    const rightEdge = pageWidth - margin;
    const cx = pageWidth / 2;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: printSize === 'a4' ? 'a4' : [58, 210],
    });

    let y = 10;

    const ensureSpace = (needed: number) => {
      const pageH = printSize === 'a4' ? 297 : 210;
      if (y + needed > pageH - 10) {
        if (printSize === 'a4') pdf.addPage('a4', 'portrait');
        else pdf.addPage([58, 210], 'portrait');
        y = 10;
      }
    };
    const line = (needed = 7) => { ensureSpace(needed); };

    // Company header (centred on true page centre)
    pdf.setFontSize(printSize === 'a4' ? 13 : 8);
    pdf.setFont('helvetica', 'bold');
    line(10);
    pdf.text(COMPANY.name, cx, y, { align: 'center' });
    y += printSize === 'a4' ? 6 : 5;

    pdf.setFontSize(printSize === 'a4' ? 8 : 5.5);
    pdf.setFont('helvetica', 'normal');
    line(6);
    pdf.text(COMPANY.tagline, cx, y, { align: 'center' });
    y += 4;

    pdf.setFontSize(printSize === 'a4' ? 8 : 5.5);
    line(6);
    // NOTE: plain ASCII separators only — '&bull;' is HTML and prints literally in jsPDF.
    pdf.text(`${displayPhone} | ${displayEmail}`, cx, y, { align: 'center' });
    y += 4;
    line(6);
    pdf.text(COMPANY.website, cx, y, { align: 'center' });
    y += 4;

    if (branch) {
      pdf.setFontSize(printSize === 'a4' ? 8 : 5.5);
      line(6);
      const branchLine = `${branch.name}${branch.location ? ' - ' + branch.location : ''}`;
      const splitBranch = pdf.splitTextToSize(branchLine, pageWidth - margin * 2);
      pdf.text(splitBranch, cx, y, { align: 'center' });
      y += 4 * (Array.isArray(splitBranch) ? splitBranch.length : 1);
    }

    y += 3;

    // Separator
    pdf.setDrawColor(102, 102, 102);
    pdf.setLineWidth(0.5);
    line(8);
    pdf.line(margin, y, rightEdge, y);
    y += 5;

    // Receipt title + receipt number
    pdf.setFontSize(printSize === 'a4' ? 14 : 10);
    pdf.setFont('helvetica', 'bold');
    line(12);
    pdf.text('SALES RECEIPT', cx, y, { align: 'center' });
    y += 6;
    pdf.setFontSize(printSize === 'a4' ? 9 : 6);
    pdf.setFont('courier', 'normal');
    pdf.text(`Receipt #: ${receiptNo}`, cx, y, { align: 'center' });
    y += 6;

    // Separator
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);
    line(8);
    pdf.line(margin, y, rightEdge, y);
    y += 6;

    // Date/Time
    pdf.setFontSize(printSize === 'a4' ? 10 : 7);
    pdf.setFont('helvetica', 'normal');
    line(7);
    pdf.text(`Date: ${new Date(sale.created_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })}`, margin, y);
    y += 5;
    line(7);
    pdf.text(`Time: ${new Date(sale.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}`, margin, y);
    y += 5;

    // Item (wrapped so long names never overflow the 58mm roll)
    const itemLabel = type === 'product' ? 'Product' : 'Service';
    line(7);
    const itemLines = pdf.splitTextToSize(`${itemLabel}: ${itemName}`, pageWidth - margin * 2);
    pdf.text(itemLines, margin, y);
    y += 5 * (Array.isArray(itemLines) ? itemLines.length : 1);

    // Product ID or Service details
    if (type === 'product' && sd.finished_product_id) {
      pdf.setFontSize(printSize === 'a4' ? 9 : 6);
      pdf.setFont('courier', 'normal');
      line(6);
      pdf.text(`Product ID: ${sd.finished_product_id.slice(0, 8).toUpperCase()}`, margin, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
    }
    if (type === 'service' && sd.description) {
      pdf.setFontSize(printSize === 'a4' ? 9 : 6);
      line(6);
      const descLines = pdf.splitTextToSize(`Details: ${sd.description}`, pageWidth - margin * 2);
      pdf.text(descLines, margin, y);
      y += 5 * (Array.isArray(descLines) ? descLines.length : 1);
    }

    y += 3;

    // Customer (wrapped)
    pdf.setFontSize(printSize === 'a4' ? 10 : 7);
    pdf.setFont('helvetica', 'normal');
    line(7);
    const custLines = pdf.splitTextToSize(`Customer: ${sale.customer_name}`, pageWidth - margin * 2);
    pdf.text(custLines, margin, y);
    y += 5 * (Array.isArray(custLines) ? custLines.length : 1);
    if (sale.customer_phone) {
      line(7);
      pdf.text(`Phone: ${sale.customer_phone}`, margin, y);
      y += 5;
    }

    y += 3;

    // Payment mode separator
    pdf.setDrawColor(102, 102, 102);
    pdf.setLineWidth(0.3);
    line(5);
    pdf.line(margin, y, rightEdge, y);
    y += 4;

    // Mode
    pdf.setFontSize(printSize === 'a4' ? 10 : 7);
    pdf.setFont('helvetica', 'bold');
    line(7);
    pdf.text(`Mode: ${isLipa ? 'LIPA POLE POLE' : 'FULL PAYMENT'}`, margin, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');

    // Payment details
    if (hasPaymentTxns) {
      if (cashT > 0) {
        line(7);
        pdf.text(`Cash: Ksh ${cashT.toLocaleString()}`, margin, y);
        y += 5;
      }
      if (mpesaT > 0) {
        line(7);
        pdf.text(`M-Pesa: Ksh ${mpesaT.toLocaleString()}`, margin, y);
        y += 5;
      }
      if (paymentTxns && paymentTxns.length > 0) {
        pdf.setFontSize(printSize === 'a4' ? 8 : 5);
        pdf.setFont('courier', 'normal');
        const refs = paymentTxns.filter((t: any) => t.payment_method === 'mpesa').map((t: any) => t.reference_number).filter(Boolean);
        if (refs.length > 0) {
          line(7);
          const refLines = pdf.splitTextToSize(`M-Pesa Ref: ${refs.join(', ')}`, pageWidth - margin * 2);
          pdf.text(refLines, margin, y);
          y += 5 * (Array.isArray(refLines) ? refLines.length : 1);
        }
        pdf.setFont('helvetica', 'normal');
      }
    } else {
      pdf.setFontSize(printSize === 'a4' ? 10 : 7);
      line(7);
      pdf.text(`Payment Method: ${paymentMethodDisplay}`, margin, y);
      y += 5;
      if (isCashPayment) {
        line(7);
        pdf.text(`Cash Received: Ksh ${sd.amount_received?.toLocaleString()}`, margin, y);
        y += 5;
        line(7);
        pdf.text(`Change Given: Ksh ${sd.change_given?.toLocaleString()}`, margin, y);
        y += 5;
      }
    }

    if (isLipa && remainingBalance > 0) {
      pdf.setFontSize(printSize === 'a4' ? 10 : 7);
      pdf.setFont('helvetica', 'bold');
      line(7);
      pdf.text(`Remaining Balance: Ksh ${remainingBalance.toLocaleString()}`, margin, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
    }

    y += 3;

    // Total box
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(1);
    line(5);
    pdf.line(margin, y, rightEdge, y);
    y += 5;

    pdf.setFontSize(printSize === 'a4' ? 13 : 9);
    pdf.setFont('helvetica', 'bold');
    line(10);
    // Right-align TOTAL against the true right edge (align:'right' anchors at the given x).
    pdf.text(`TOTAL: Ksh ${amount.toLocaleString()}`, rightEdge, y, { align: 'right' });
    y += 7;

    // Served by
    pdf.setFontSize(printSize === 'a4' ? 10 : 7);
    pdf.setFont('helvetica', 'normal');
    line(7);
    pdf.text(`Served by: ${officerProfile?.full_name || 'Staff'}`, margin, y);
    y += 5;

    // Footer (centred on true page centre)
    y += 3;
    pdf.setFontSize(printSize === 'a4' ? 9 : 6);
    pdf.setFont('helvetica', 'italic');
    line(6);
    pdf.text('Thank you for choosing', cx, y, { align: 'center' });
    y += 4;
    line(6);
    pdf.text('Jabima Funeral Directors', cx, y, { align: 'center' });
    y += 4;
    pdf.setFontSize(printSize === 'a4' ? 8 : 5);
    line(6);
    const footerLines = pdf.splitTextToSize('This is a computer-generated receipt', pageWidth - margin * 2);
    pdf.text(footerLines, cx, y, { align: 'center' });

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

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read PDF data'));
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.readAsDataURL(blob);
    });

  const writePdfToDevice = async (blob: Blob, fileName: string, dir: Directory): Promise<string> => {
    const base64 = await blobToBase64(blob);
    const saved = await Filesystem.writeFile({ path: fileName, data: base64, directory: dir });
    return saved.uri;
  };

  const sharePDFViaWhatsApp = async () => {
    if (!sale) return;
    setBusy('whatsapp');
    try {
      const blob = pdfBlob || await generatePDFBlob();
      if (!blob) throw new Error('Could not generate the PDF');

      const fileName = `Receipt-${receiptNo}.pdf`;

      if (isNative) {
        try {
          const uri = await writePdfToDevice(blob, fileName, Directory.Cache);
          await Share.share({
            title: `Receipt #${receiptNo}`,
            text: `${COMPANY.name} Receipt #${receiptNo}`,
            url: uri,
            dialogTitle: 'Share receipt',
          });
          toast({ title: 'Receipt shared', description: 'Choose WhatsApp in the share sheet to send the PDF.' });
        } catch (e: any) {
          if (e?.message !== 'Share canceled' && e?.name !== 'AbortError') throw e;
        }
        return;
      }

      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Receipt #${receiptNo}`,
          text: `${COMPANY.name} Receipt`,
        });
        return;
      }

      await downloadPDF(blob);
      const msg = encodeURIComponent(
        `${COMPANY.name} Receipt #${receiptNo} - the PDF has been downloaded, please attach it here.`
      );
      const phone = (sale as any).customer_phone
        ? String((sale as any).customer_phone).replace(/[^0-9]/g, '')
        : '';
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
      toast({ title: 'PDF downloaded', description: 'Attach the downloaded PDF in WhatsApp to send it.' });
    } catch (error: any) {
      if (error?.name !== 'AbortError' && error?.message !== 'Share canceled') {
        toast({ variant: 'destructive', title: 'WhatsApp share failed', description: String(error?.message || error) });
      }
    } finally {
      setBusy(null);
    }
  };

const sharePDFViaEmail = async () => {
    if (!sale) return;
    setBusy('email');
    try {
      const blob = pdfBlob || await generatePDFBlob();
      if (!blob) throw new Error('Could not generate the PDF');
      if (isNative) {
        const uri = await writePdfToDevice(blob, `Receipt-${receiptNo}.pdf`, Directory.Cache);
        await Share.share({
          title: `Sales Receipt #${receiptNo}`,
          text: formatReceiptText(),
          url: uri,
          dialogTitle: 'Share receipt',
        });
        return;
      }
      await downloadPDF(blob);
      const subject = `Sales Receipt #${receiptNo} - ${COMPANY.name}`;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(formatReceiptText())}`;
    } catch (error: any) {
      if (error?.name !== 'AbortError' && error?.message !== 'Share canceled') {
        toast({ variant: 'destructive', title: 'Email share failed', description: String(error?.message || error) });
      }
    } finally {
      setBusy(null);
    }
  };

  const doPrint = async () => {
    if (!sale) return;
    setBusy('print');
    try {
      const blob = pdfBlob || await generatePDFBlob();
      if (!blob) throw new Error('Could not generate the PDF');
      if (isNative) {
        try {
          const uri = await writePdfToDevice(blob, `Receipt-${receiptNo}.pdf`, Directory.Cache);
          await Share.share({
            title: `Print Receipt #${receiptNo}`,
            text: `${COMPANY.name} Receipt #${receiptNo} - choose a printer app to print.`,
            url: uri,
            dialogTitle: 'Print receipt (choose printer app)',
          });
          toast({ title: 'Sent to printer apps', description: 'Pick your printer / Print app from the share sheet.' });
        } catch (e: any) {
          if (e?.message !== 'Share canceled' && e?.name !== 'AbortError') throw e;
        }
        return;
      }
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        window.setTimeout(() => { try { printWindow.focus(); printWindow.print(); } catch { /* noop */ } }, 800);
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        toast({ variant: 'destructive', title: 'Pop-up blocked', description: 'Please allow pop-ups to print the receipt.' });
        URL.revokeObjectURL(url);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Print failed', description: String(error?.message || error) });
    } finally {
      setBusy(null);
    }
  };

  const downloadPDF = async (existingBlob?: Blob) => {
    if (!sale) return;
    const wasIdle = busy === null;
    if (wasIdle) setBusy('download');
    try {
      const blob = existingBlob || pdfBlob || await generatePDFBlob();
      if (!blob) throw new Error('Could not generate the PDF');

      const fileName = `Receipt-${receiptNo}.pdf`;

      if (isNative) {
        try {
          await writePdfToDevice(blob, fileName, Directory.Documents);
          toast({ title: 'Receipt downloaded', description: `${fileName} saved to Documents.` });
        } catch {
          const uri = await writePdfToDevice(blob, fileName, Directory.Cache);
          await Share.share({ title: fileName, text: `${COMPANY.name} Receipt #${receiptNo}`, url: uri, dialogTitle: 'Save receipt file' });
        }
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast({ title: 'Receipt downloaded', description: fileName });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Download failed', description: String(error?.message || error) });
    } finally {
      if (wasIdle) setBusy(null);
    }
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
        <Button onClick={() => downloadPDF()} disabled={busy !== null} variant="outline" size="lg" className="flex-1">
          {busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}Download
        </Button>
        <Button onClick={sharePDFViaWhatsApp} disabled={busy !== null} variant="outline" size="lg" className="flex-1">
          {busy === 'whatsapp' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}WhatsApp
        </Button>
        <Button onClick={doPrint} disabled={busy !== null} variant="outline" size="lg" className="flex-1">
          {busy === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}Print
        </Button>
        <Button onClick={sharePDFViaEmail} disabled={busy !== null} variant="outline" size="lg" className="flex-1">
          {busy === 'email' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Email
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