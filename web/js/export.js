/**
 * FleetPulse - Report Export Utilities (CSV + PDF)
 *
 * CSV needs no library — it's plain text Excel opens natively. PDF uses
 * jsPDF + jspdf-autotable, loaded via CDN in index.html (same pattern as
 * Leaflet/FontAwesome already used across the dashboard).
 */
const ExportUtils = (() => {
  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    const str = String(value ?? '');
    // Quote any field containing a comma, quote, or newline, per RFC 4180.
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  function toCsv(filename, headers, rows) {
    const lines = [headers.map(csvEscape).join(',')];
    rows.forEach(row => lines.push(row.map(csvEscape).join(',')));
    // Leading BOM so Excel detects UTF-8 and renders acentos/ñ correctly.
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(filename, blob);
  }

  function toPdf(title, headers, rows) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('No se pudo cargar el generador de PDF (sin conexión a internet).');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: rows.length && headers.length > 5 ? 'landscape' : 'portrait' });

    doc.setFontSize(14);
    doc.text(title, 14, 16);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`FleetPulse — generado ${new Date().toLocaleString('es-PE')}`, 14, 22);

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [6, 182, 212] }
    });

    doc.save(title.toLowerCase().replace(/\s+/g, '_') + '.pdf');
  }

  return { toCsv, toPdf };
})();
