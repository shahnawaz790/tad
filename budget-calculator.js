(() => {
  'use strict';

  // Installed planning bands researched on 3 October 2026 from NoBroker,
  // Asian Paints and Brick&Bolt. Custom allowances are not supplier quotes.
  const RATES = {
    kitchen: { standard: [1100, 1500], premium: [1500, 2200], luxury: [2500, 3500] },
    wardrobe: { standard: [800, 1200], premium: [1300, 1800], luxury: [1900, 2500] },
    countertop: { standard: [300, 500], premium: [500, 900], luxury: [900, 1500] },
    ceiling: { standard: [80, 110], premium: [110, 150], luxury: [150, 250] },
    painting: { standard: [18, 25], premium: [25, 35], luxury: [35, 45] },
    flooring: { standard: [85, 135], premium: [120, 200], luxury: [220, 400] },
  };
  const BUILD_RATES = { standard: 2000, premium: 2500, luxury: 3200 };
  const PROJECTS = {
    home: 'Home interior', kitchen: 'Modular kitchen', office: 'Office interior',
    shop: 'Shop interior', construction: 'House construction',
  };
  const LIMITS = {
    area: [50, 100000, 0.01], floors: [1, 4, 1], buildRate: [1000, 10000, 1],
    kitchenBaseArea: [0, 2000, 0.01], kitchenWallArea: [0, 2000, 0.01],
    countertopArea: [0, 2000, 0.01], wardrobeArea: [0, 10000, 0.01],
    storageArea: [0, 10000, 0.01], ceilingArea: [0, 100000, 0.01],
    paintingArea: [0, 500000, 0.01], flooringArea: [0, 100000, 0.01],
    electricalPoints: [0, 5000, 1], electricalRate: [100, 20000, 1],
    localAdjustment: [-30, 50, 1], contingency: [0, 30, 0.5], tax: [0, 30, 0.5],
    kitchenAllowance: [0, 1000000, 1], foundationAllowance: [0, 100000000, 1],
    externalAllowance: [0, 100000000, 1], furnitureAllowance: [0, 100000000, 1],
    designFee: [0, 100000000, 1], extrasAllowance: [0, 100000000, 1],
  };

  function getPreset(projectType = 'home', finish = 'premium') {
    const values = {
      projectType, finish, area: 1000, floors: 2, buildRate: BUILD_RATES[finish],
      kitchenBaseArea: 40, kitchenWallArea: 32, countertopArea: 32,
      kitchenAllowance: 25000, wardrobeArea: 84, storageArea: 35,
      ceilingArea: 450, paintingArea: 3000, flooringArea: 0, electricalPoints: 20,
      electricalRate: 1000, localAdjustment: 0, contingency: 5, tax: 0,
      foundationAllowance: 0, externalAllowance: 0, furnitureAllowance: 0,
      designFee: 0, extrasAllowance: 0,
    };
    if (projectType === 'kitchen') Object.assign(values, {
      area: 120, ceilingArea: 0, paintingArea: 0, electricalPoints: 0,
    });
    if (projectType === 'office') Object.assign(values, {
      storageArea: 40, ceilingArea: 1000, paintingArea: 2500, flooringArea: 1000,
      electricalPoints: 50, furnitureAllowance: 150000, extrasAllowance: 100000,
    });
    if (projectType === 'shop') Object.assign(values, {
      area: 600, storageArea: 120, ceilingArea: 600, paintingArea: 1500,
      flooringArea: 600, electricalPoints: 25, extrasAllowance: 100000,
    });
    if (projectType === 'construction') Object.assign(values, { area: 1200, contingency: 10 });
    return values;
  }

  function calculate(raw = {}) {
    const projectType = raw.projectType || 'home';
    const finish = raw.finish || 'premium';
    if (!Object.hasOwn(PROJECTS, projectType) || !Object.hasOwn(BUILD_RATES, finish)) {
      throw new Error('Choose a valid project type and finish.');
    }
    const data = { ...getPreset(projectType, finish), ...raw };
    const isBuild = projectType === 'construction';
    const hasKitchen = projectType === 'home' || projectType === 'kitchen';
    const keys = ['area', 'designFee', 'tax', 'contingency'];
    if (isBuild) keys.push('floors', 'buildRate', 'foundationAllowance', 'externalAllowance');
    else {
      keys.push('localAdjustment', 'ceilingArea', 'paintingArea', 'flooringArea',
        'electricalPoints', 'electricalRate', 'extrasAllowance');
      if (hasKitchen) keys.push('kitchenBaseArea', 'kitchenWallArea', 'countertopArea', 'kitchenAllowance');
      if (projectType === 'home') keys.push('wardrobeArea');
      if (projectType !== 'kitchen') keys.push('storageArea', 'furnitureAllowance');
    }
    for (const key of keys) {
      const [min, max, step] = LIMITS[key];
      const value = Number(data[key]);
      if (data[key] === '' || data[key] == null || !Number.isFinite(value) || value < min || value > max
        || Math.abs((value - min) / step - Math.round((value - min) / step)) > 0.000001) {
        throw new Error(`Invalid value for ${key}.`);
      }
      data[key] = value;
    }
    if (!isBuild && (data.ceilingArea > data.area || data.flooringArea > data.area)) {
      throw new Error('Ceiling and flooring areas cannot exceed the carpet area.');
    }

    const items = [];
    const adjustment = isBuild ? 1 : 1 + data.localAdjustment / 100;
    function add(label, quantity, unit, band, adjustable = true, allowance = false) {
      if (quantity === 0) return;
      const factor = adjustable ? adjustment : 1;
      const rateLow = band[0] * factor;
      const rateHigh = band[1] * factor;
      const rate = (rateLow + rateHigh) / 2;
      items.push({ label, quantity, unit, rate, rateLow, rateHigh, allowance,
        amount: Math.round(quantity * rate), low: Math.round(quantity * rateLow),
        high: Math.round(quantity * rateHigh) });
    }
    function fixed(label, value) {
      if (value > 0) add(label, 1, 'allowance', [value, value], false, true);
    }
    const measuredArea = isBuild ? data.area * data.floors : data.area;
    if (isBuild) {
      add('Finished building', measuredArea, 'sq ft', [data.buildRate * 0.9, data.buildRate * 1.1], false);
      fixed('Extra foundation / site work', data.foundationAllowance);
      fixed('Boundary / external works', data.externalAllowance);
    } else {
      if (hasKitchen) {
        add('Base kitchen cabinets', data.kitchenBaseArea, 'sq ft frontage', RATES.kitchen[finish]);
        add('Wall kitchen cabinets', data.kitchenWallArea, 'sq ft frontage', RATES.kitchen[finish]);
        add('Countertop', data.countertopArea, 'sq ft', RATES.countertop[finish]);
        fixed('Kitchen accessories / sink', data.kitchenAllowance);
      }
      if (projectType === 'home') add('Wardrobes', data.wardrobeArea, 'sq ft frontage', RATES.wardrobe[finish]);
      if (projectType !== 'kitchen') add('Other cabinetry', data.storageArea, 'sq ft frontage', RATES.wardrobe[finish]);
      add('False ceiling, without light fittings', data.ceilingArea, 'sq ft', RATES.ceiling[finish]);
      add('Surface preparation & painting', data.paintingArea, 'sq ft surface', RATES.painting[finish]);
      add('Flooring material & laying', data.flooringArea, 'sq ft', RATES.flooring[finish]);
      add('Electrical points, without light fittings', data.electricalPoints, 'points',
        [data.electricalRate * 0.8, data.electricalRate * 1.2]);
      if (projectType !== 'kitchen') fixed('Loose furniture / decor', data.furnitureAllowance);
      fixed('Other work / fit-out allowance', data.extrasAllowance);
    }
    fixed('Design / professional fees', data.designFee);
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    function totalWithAllowances(amount) {
      const taxAmount = Math.round(amount * data.tax / 100);
      const reserve = Math.round((amount + taxAmount) * data.contingency / 100);
      return { taxAmount, reserve, total: amount + taxAmount + reserve };
    }
    const totals = totalWithAllowances(subtotal);
    const low = totalWithAllowances(items.reduce((sum, item) => sum + item.low, 0)).total;
    const high = totalWithAllowances(items.reduce((sum, item) => sum + item.high, 0)).total;
    const exclusions = isBuild
      ? 'Excluded unless added as an allowance: land, approvals, utility connections, abnormal foundations, boundary works, basement, lift, modular interiors and loose furniture. Rates assume a residential building of up to four floors.'
      : 'Excluded unless added as an allowance: appliances, light fittings, HVAC, plumbing alterations, demolition, loose furniture, professional fees and commercial fire / statutory work. Custom joinery and premium hardware need a site quote.';
    return { data, items, subtotal, ...totals, low, high, measuredArea,
      perSqft: measuredArea ? totals.total / measuredArea : 0, exclusions };
  }

  const money = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(value);
  const compactMoney = (value) => value >= 10000000
    ? `\u20b9${(value / 10000000).toFixed(2)} Cr`
    : value >= 100000 ? `\u20b9${(value / 100000).toFixed(2)} L` : money(value);
  const number = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);

  function describe(result) {
    const d = result.data;
    const area = d.projectType === 'construction'
      ? `${number(d.area)} sq ft/floor x ${d.floors} floors = ${number(result.measuredArea)} sq ft built-up`
      : `${number(d.area)} sq ft carpet area`;
    return `${PROJECTS[d.projectType]} in ${d.location || 'your city'}. ${area}; ${d.finish} finish. ${d.tax === 0 ? 'Tax excluded' : `${d.tax}% tax allowance`}; ${d.contingency}% reserve included.`;
  }

  function init() {
    const form = document.getElementById('budgetEstimator');
    if (!form) return;
    const el = (id) => document.getElementById(id);
    const field = (name) => form.elements.namedItem(name);
    const saved = new Map();
    let currentProject = field('projectType').value;
    let autoBuildRate = BUILD_RATES[field('finish').value];
    let latest = null;
    let downloading = false;
    const read = () => Object.fromEntries(new FormData(form));
    function fill(values) {
      for (const [key, value] of Object.entries(values)) {
        const input = field(key);
        if (input && !['projectType', 'finish', 'location'].includes(key)) input.value = value;
      }
    }
    function syncScope() {
      const project = field('projectType').value;
      for (const group of form.querySelectorAll('[data-projects]')) {
        group.hidden = !group.dataset.projects.split(' ').includes(project);
        if (group.tagName === 'FIELDSET') group.disabled = group.hidden;
      }
      for (const input of form.querySelectorAll('input, select')) {
        input.disabled = Boolean(input.closest('[hidden]'));
      }
      const build = project === 'construction';
      el('estimateAreaLabel').textContent = build ? 'Built-up area per floor (sq ft)' : 'Carpet area (sq ft)';
      el('estimateAreaHint').textContent = build
        ? 'Enter the built-up area of one floor, including walls and internal stairs, not the plot area. For unequal floors, use their average; the total includes every floor.'
        : 'Carpet area is used for the cost-per-sq-ft summary. Work is priced by the quantities below.';
    }
    function actionsEnabled(enabled) {
      el('estimateDownload').disabled = !enabled || downloading;
      el('estimateWhatsapp').setAttribute('aria-disabled', String(!enabled));
      if (!enabled) el('estimateWhatsapp').removeAttribute('href');
    }
    function showError(message) {
      latest = null;
      el('estimateError').hidden = false;
      el('estimateError').textContent = message;
      el('estimateTotal').textContent = 'Check inputs';
      for (const id of ['estimateRange', 'estimateNote', 'estimateSubtotal', 'estimateTax',
        'estimateReserve', 'estimatePerSqft', 'estimateTableTotal']) el(id).textContent = '';
      el('estimateItems').replaceChildren();
      actionsEnabled(false);
    }
    function render(result) {
      latest = result;
      el('estimateError').hidden = true;
      el('estimateTotal').textContent = compactMoney(result.total);
      el('estimateRange').textContent = `${compactMoney(result.low)} - ${compactMoney(result.high)}`;
      el('estimateNote').textContent = describe(result);
      el('estimateSubtotal').textContent = money(result.subtotal);
      el('estimateTaxLabel').textContent = `Tax allowance (${result.data.tax}%)`;
      el('estimateTax').textContent = result.data.tax ? money(result.taxAmount) : 'Excluded';
      el('estimateReserveLabel').textContent = `Contingency reserve (${result.data.contingency}%)`;
      el('estimateReserve').textContent = money(result.reserve);
      el('estimatePerSqft').textContent = money(result.perSqft);
      el('estimateExclusions').textContent = result.exclusions;
      el('estimateTableTotal').textContent = money(result.total);
      const rows = result.items.map((item) => {
        const row = document.createElement('tr');
        const heading = document.createElement('th');
        heading.scope = 'row';
        heading.textContent = item.label;
        row.append(heading);
        for (const content of [`${number(item.quantity)} ${item.unit}`, item.allowance
          ? `${money(item.rate)} entered` : `${money(item.rate)} (${money(item.rateLow)} - ${money(item.rateHigh)})`, money(item.amount)]) {
          const cell = document.createElement('td');
          cell.textContent = content;
          row.append(cell);
        }
        return row;
      });
      const taxRow = document.createElement('tr');
      const reserveRow = document.createElement('tr');
      for (const [row, title, amount] of [[taxRow, `Tax allowance (${result.data.tax}%)`, result.taxAmount],
        [reserveRow, `Contingency reserve (${result.data.contingency}%)`, result.reserve]]) {
        const heading = document.createElement('th');
        heading.scope = 'row';
        heading.colSpan = 3;
        heading.textContent = title;
        const cell = document.createElement('td');
        cell.textContent = money(amount);
        row.append(heading, cell);
      }
      el('estimateItems').replaceChildren(...rows, taxRow, reserveRow);
      if (!result.items.length) el('estimateNote').textContent = 'No work selected. Enter a work quantity or an allowance.';
      actionsEnabled(result.total > 0);
      if (result.total > 0) {
        const share = ['Hi, I would like a detailed quote.', describe(result),
          ...result.items.map((item) => `${item.label}: ${number(item.quantity)} ${item.unit}, ${money(item.amount)}`),
          `Tax allowance: ${money(result.taxAmount)}. Contingency: ${money(result.reserve)}.`,
          `Budget: ${money(result.total)}. Planning range: ${money(result.low)} - ${money(result.high)}.`,
          result.data.projectType === 'construction' ? `Build rate: ${money(result.data.buildRate)}/sq ft.`
            : `Local unit-rate adjustment: ${result.data.localAdjustment}%.`,
          'Planning estimate only; please confirm site scope, materials and taxes.'].join('\n');
        el('estimateWhatsapp').href = `https://wa.me/918587810424?text=${encodeURIComponent(share)}`;
      }
    }
    function update(event) {
      if (event && event.target.name === 'projectType' && currentProject !== field('projectType').value) {
        saved.set(currentProject, read());
        currentProject = field('projectType').value;
        fill(saved.get(currentProject) || getPreset(currentProject, field('finish').value));
        autoBuildRate = BUILD_RATES[field('finish').value];
      }
      if (event && event.target.name === 'finish') {
        if (Number(field('buildRate').value) === autoBuildRate) field('buildRate').value = BUILD_RATES[field('finish').value];
        autoBuildRate = BUILD_RATES[field('finish').value];
      }
      syncScope();
      const invalid = Array.from(form.querySelectorAll('input, select')).find((input) => !input.disabled && !input.validity.valid);
      for (const input of form.querySelectorAll('input, select')) input.setAttribute('aria-invalid', String(!input.disabled && !input.validity.valid));
      if (invalid) {
        const label = invalid.closest('label').querySelector('span').textContent;
        showError(`${label}: ${invalid.validationMessage}`);
        return;
      }
      try { render(calculate(read())); }
      catch (error) { showError(error.message); }
    }
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', (event) => { event.preventDefault(); update(); });
    form.addEventListener('reset', () => {
      setTimeout(() => {
        saved.clear();
        currentProject = field('projectType').value;
        autoBuildRate = BUILD_RATES[field('finish').value];
        fill(getPreset(currentProject, field('finish').value));
        update();
      }, 0);
    });
    el('estimateWhatsapp').addEventListener('click', (event) => { if (!latest || !latest.total) event.preventDefault(); });
    el('estimateDownload').addEventListener('click', async () => {
      if (!latest || !latest.total || downloading) return;
      const quote = latest;
      downloading = true;
      el('estimateDownload').disabled = true;
      el('estimateDownload').textContent = 'Preparing PDF...';
      el('estimateDownloadError').hidden = true;
      try {
        const bytes = await window.TADBudgetPdf.createEstimatePdf(quote, window.PDFLib);
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `TAD-${quote.data.projectType}-budget.pdf`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        console.error('Estimate PDF export failed:', error);
        el('estimateDownloadError').textContent = 'The PDF could not be prepared. Please try again.';
        el('estimateDownloadError').hidden = false;
      } finally {
        downloading = false;
        el('estimateDownload').textContent = 'Download estimate PDF';
        el('estimateDownload').disabled = !latest || !latest.total;
      }
    });
    const examples = [
      ['budgetExampleHome', getPreset('home')],
      ['budgetExampleLarge', { ...getPreset('home', 'luxury'), area: 1500, wardrobeArea: 126,
        kitchenBaseArea: 50, kitchenWallArea: 40, countertopArea: 40,
        kitchenAllowance: 40000, storageArea: 50, ceilingArea: 750, paintingArea: 4500, electricalPoints: 30 }],
      ['budgetExampleOffice', getPreset('office')], ['budgetExampleShop', getPreset('shop')],
    ];
    for (const [id, values] of examples) {
      const result = calculate(values);
      if (el(id)) el(id).textContent = `${compactMoney(result.low)} - ${compactMoney(result.high)}`;
    }
    update();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calculate, getPreset, RATES, BUILD_RATES };
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
