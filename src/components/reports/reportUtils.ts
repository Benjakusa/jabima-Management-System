/**
 * Utility helpers for exporting report data as CSV or printing as PDF.
 */

export const exportCSV = (filename: string, headers: string[], rows: string[][]) => {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const printReport = (title: string, tableHtml: string) => {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <html><head><title>${title}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif; }
      body { padding: 24px; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      p.sub { font-size: 12px; color: #666; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
      th { background: #f5f5f5; font-weight: 600; }
      tr:nth-child(even) { background: #fafafa; }
      .total-row { font-weight: 700; background: #f0f0f0 !important; }
      @media print { body { padding: 0; } }
    </style>
    </head><body>
      <h1>${title}</h1>
      <p class="sub">Generated on ${new Date().toLocaleDateString('en-KE', { dateStyle: 'long' })}</p>
      ${tableHtml}
    </body></html>
  `);
  win.document.close();
  win.print();
};

export const fmt = (v: number) => `Ksh ${v.toLocaleString()}`;
