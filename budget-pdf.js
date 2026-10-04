(() => {
  'use strict';

  async function createEstimatePdf(result, library) {
    if (!library) throw new Error('PDF library is unavailable.');
    const { PDFDocument, StandardFonts, rgb } = library;
    const doc = await PDFDocument.create();
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const ink = rgb(0.1, 0.16, 0.18);
    const muted = rgb(0.38, 0.44, 0.46);
    const accent = rgb(0.05, 0.48, 0.6);
    const pale = rgb(0.91, 0.95, 0.94);
    const line = rgb(0.84, 0.88, 0.88);
    const width = 595.28;
    const height = 841.89;
    const margin = 40;
    const usable = width - margin * 2;
    const d = result.data;
    const projects = { home: 'Home interior', kitchen: 'Modular kitchen', office: 'Office interior',
      shop: 'Shop interior', construction: 'House construction' };
    const number = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
    // Standard PDF fonts do not contain the rupee glyph; use the ISO currency code.
    const money = (value) => `INR ${Math.round(value).toLocaleString('en-IN')}`;
    const clean = (text) => String(text).replace(/[^\x20-\x7e]/g, '-');
    let page;
    let y;

    function text(value, x, top, size = 9, font = regular, color = ink) {
      page.drawText(clean(value), { x, y: top, size, font, color });
    }
    function wrap(value, available, size = 9, font = regular) {
      const lines = [];
      let current = '';
      for (const original of clean(value).split(/\s+/)) {
        let word = original;
        if (current && font.widthOfTextAtSize(`${current} ${word}`, size) > available) {
          lines.push(current);
          current = '';
        }
        while (font.widthOfTextAtSize(word, size) > available) {
          let count = word.length - 1;
          while (count > 1 && font.widthOfTextAtSize(word.slice(0, count), size) > available) count--;
          lines.push(word.slice(0, count));
          word = word.slice(count);
        }
        current = current ? `${current} ${word}` : word;
      }
      if (current) lines.push(current);
      return lines;
    }
    function newPage() {
      page = doc.addPage([width, height]);
      y = height - margin;
      if (doc.getPageCount() > 1) {
        text('The Architech Design | Project Budget (continued)', margin, y, 11, bold);
        y -= 28;
      }
    }
    function ensure(space, repeatTable = false) {
      if (y - space < 62) {
        newPage();
        if (repeatTable) tableHeader();
      }
    }
    function paragraph(value, size = 9, color = muted, font = regular) {
      const lines = wrap(value, usable, size, font);
      for (const value of lines) {
        ensure(size + 5);
        text(value, margin, y, size, font, color);
        y -= size + 5;
      }
      y -= 8;
    }
    const columns = [40, 233, 332, 434];
    const columnWidths = [179, 85, 88, 107];
    function tableHeader() {
      ensure(30);
      page.drawRectangle({ x: margin, y: y - 24, width: usable, height: 28, color: pale });
      ['Selected work', 'Quantity', 'Unit rate', 'Amount'].forEach((value, i) => {
        text(value, columns[i] + 5, y - 13, 9, bold);
      });
      y -= 32;
    }
    function row(item) {
      const values = [item.label, `${number(item.quantity)} ${item.unit}`,
        money(item.rate), money(item.amount)];
      const lines = values.map((value, i) => wrap(value, columnWidths[i], 8.5));
      const rowHeight = Math.max(...lines.map((cell) => cell.length)) * 12 + 12;
      ensure(rowHeight + 8, true);
      lines.forEach((cell, i) => cell.forEach((value, j) => {
        const x = i === 3 ? width - margin - 5 - regular.widthOfTextAtSize(value, 8.5) : columns[i] + 5;
        text(value, x, y - 10 - j * 12, 8.5);
      }));
      y -= rowHeight;
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: line });
    }
    function total(label, value, highlight = false) {
      ensure(30);
      if (highlight) page.drawRectangle({ x: margin, y: y - 10, width: usable, height: 27, color: pale });
      const font = highlight ? bold : regular;
      const size = highlight ? 11 : 9;
      text(label, margin + 5, y, size, font);
      text(value, width - margin - 5 - font.widthOfTextAtSize(value, size), y, size, font);
      y -= highlight ? 36 : 22;
    }

    doc.setTitle(`TAD ${projects[d.projectType]} Budget Estimate`);
    doc.setAuthor('The Architech Design');
    doc.setSubject('Project planning estimate');
    newPage();
    text('THE ARCHITECH DESIGN', margin, y, 11, bold, accent);
    y -= 30;
    text('Project Budget Estimate', margin, y, 23, bold);
    y -= 25;
    paragraph(`Prepared ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`);
    paragraph(`${projects[d.projectType]} | ${d.location || 'Location to be confirmed'} | ${d.finish} finish`, 10, ink, bold);
    paragraph(d.projectType === 'construction'
      ? `${number(d.area)} sq ft per floor x ${d.floors} floors = ${number(result.measuredArea)} sq ft total built-up. Construction rate: ${money(d.buildRate)}/sq ft.`
      : `${number(d.area)} sq ft carpet area. Cabinet quantities use measured front-face area; painting uses actual surface area.`);
    y -= 4;
    tableHeader();
    result.items.forEach(row);
    y -= 22;
    // Keep the financial summary together if the table needs another page.
    ensure(170);
    total('Selected work & allowances', money(result.subtotal));
    total(`Tax allowance (${d.tax}%)`, d.tax ? money(result.taxAmount) : 'Excluded');
    total(`Contingency reserve (${d.contingency}%)`, money(result.reserve));
    total('PLANNED BUDGET', money(result.total), true);
    total('Planning range', `${money(result.low)} - ${money(result.high)}`);
    total('Budget per sq ft', money(result.perSqft));
    y -= 8;
    paragraph('Scope & exclusions', 10, ink, bold);
    paragraph(result.exclusions, 8);
    paragraph('Planning estimate only, subject to site measurements, local supplier prices and agreed material specifications. The range is not a fixed quotation. Tax and contingency are included only at the selected values.', 8);
    const pages = doc.getPages();
    pages.forEach((current, index) => {
      current.drawLine({ start: { x: margin, y: 45 }, end: { x: width - margin, y: 45 }, thickness: 0.5, color: line });
      current.drawText('The Architech Design | +91 85878 10424', { x: margin, y: 29, size: 8, font: regular, color: muted });
      const value = `${index + 1} / ${pages.length}`;
      current.drawText(value, { x: width - margin - regular.widthOfTextAtSize(value, 8), y: 29, size: 8, font: regular, color: muted });
    });
    return doc.save();
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { createEstimatePdf };
  if (typeof window !== 'undefined') window.TADBudgetPdf = { createEstimatePdf };
})();
