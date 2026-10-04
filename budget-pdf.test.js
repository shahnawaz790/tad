const test = require('node:test');
const assert = require('node:assert/strict');
const PDFLib = require('./vendor/pdf-lib.min.js');
const { calculate, getPreset } = require('./budget-calculator');
const { createEstimatePdf } = require('./budget-pdf');

test('every project exports a valid A4 PDF, including maximum-size allowances', async () => {
  for (const projectType of ['home', 'kitchen', 'office', 'shop', 'construction']) {
    for (const extra of [{}, { designFee: 100000000, tax: 30, contingency: 30 }]) {
      const result = calculate({ ...getPreset(projectType), ...extra });
      const bytes = await createEstimatePdf(result, PDFLib);
      assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), '%PDF-');
      const document = await PDFLib.PDFDocument.load(bytes);
      assert.ok(document.getPageCount() >= 1 && document.getPageCount() <= 2);
      assert.ok(document.getTitle().includes('Budget Estimate'));
      for (const page of document.getPages()) {
        assert.ok(Math.abs(page.getWidth() - 595.28) < 0.01);
        assert.ok(Math.abs(page.getHeight() - 841.89) < 0.01);
      }
    }
  }
});

test('PDF export reports an unavailable library instead of generating a bogus file', async () => {
  await assert.rejects(createEstimatePdf(calculate(), null), /PDF library is unavailable/);
});
