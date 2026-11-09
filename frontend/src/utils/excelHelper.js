/**
 * excelHelper.js
 * Comprehensive utilities to ensure all numeric data field values in Excel exports
 * are saved as native Excel numbers (cell type 'n') so that SUM, AVERAGE, and AutoSum
 * work seamlessly when users select numeric cells in Microsoft Excel.
 */

/**
 * Safely converts any value to a native JavaScript Number for Excel export.
 * Returns null for empty/null/undefined so that empty cells don't show arbitrary 0s
 * where not applicable, but numeric cells remain true numbers.
 *
 * @param {any} val - The input value (number, numeric string, currency string).
 * @param {number|null} decimals - Optional number of decimal places to round to.
 * @returns {number|null} - Clean numeric value or null.
 */
export const toExcelNum = (val, decimals = null) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    if (isNaN(val)) return null;
    if (decimals !== null) {
      const factor = Math.pow(10, decimals);
      return Math.round(val * factor) / factor;
    }
    return val;
  }

  const str = String(val).trim();
  if (!str || str === '-' || str === '—') return null;

  // Preserve codes with leading zeros (e.g. '0012') as string
  if (/^0\d+/.test(str) && !str.startsWith('0.')) {
    return null;
  }

  // Strip currency prefixes and commas: ₹, Rs., $, commas
  const cleaned = str.replace(/[\u20B9$,]|Rs\.?/g, '').trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  if (decimals !== null) {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  }
  return num;
};

/**
 * Traverses a SheetJS (XLSX) worksheet and ensures all numeric cells
 * are explicitly tagged with cell.t = 'n' and have numeric primitive values.
 * Also converts any string-formatted numbers (e.g. from `.toFixed(2)` or raw strings)
 * into true numbers while preserving text strings, codes, and dates.
 *
 * @param {object} worksheet - The XLSX worksheet object from XLSX.utils.*
 * @returns {object} - The sanitized worksheet
 */
export const ensureNumericWorksheet = (worksheet) => {
  if (!worksheet || typeof worksheet !== 'object') return worksheet;

  for (const cellAddress in worksheet) {
    if (cellAddress.startsWith('!')) continue;
    const cell = worksheet[cellAddress];
    if (!cell) continue;

    // Already a number
    if (typeof cell.v === 'number') {
      cell.t = 'n';
      continue;
    }

    // If it's a string, inspect whether it represents a number
    if (cell.t === 's' && typeof cell.v === 'string') {
      const trimmed = cell.v.trim();
      if (!trimmed || trimmed === '-' || trimmed === '—') continue;

      // Do not convert dates (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY)
      if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(trimmed)) continue;
      if (/^[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}/.test(trimmed)) continue;

      // Do not convert codes with leading zeros (e.g. '0012')
      if (/^0\d+/.test(trimmed) && !trimmed.startsWith('0.')) continue;

      // Do not convert 10-digit mobile numbers without formatting (e.g. '9825012345')
      if (/^[6-9]\d{9}$/.test(trimmed)) continue;

      // Handle accounting parentheses for negative numbers, e.g. (1,234.50)
      let cleanStr = trimmed;
      let isNegative = false;
      if (cleanStr.startsWith('(') && cleanStr.endsWith(')')) {
        isNegative = true;
        cleanStr = cleanStr.slice(1, -1).trim();
      } else if (cleanStr.startsWith('-')) {
        isNegative = true;
        cleanStr = cleanStr.slice(1).trim();
      }

      // Strip currency prefixes ₹, Rs, Rs., $, INR
      cleanStr = cleanStr.replace(/^(\u20B9|Rs\.?|\$|INR)\s*/i, '').trim();

      // Remove all commas (handles both Indian 27,22,190 and Western 1,234,567 formats)
      const noCommas = cleanStr.replace(/,/g, '');

      // Must match purely digits with optional decimal point
      if (/^\d+(\.\d+)?$/.test(noCommas)) {
        const parsed = Number(noCommas);
        if (!isNaN(parsed)) {
          cell.t = 'n';
          cell.v = isNegative ? -parsed : parsed;
        }
      }
    }
  }

  return worksheet;
};

/**
 * Helper to append a worksheet to workbook after running ensureNumericWorksheet.
 *
 * @param {object} XLSX - The XLSX library object.
 * @param {object} workbook - The XLSX workbook object.
 * @param {object} worksheet - The XLSX worksheet object.
 * @param {string} sheetName - The sheet name to append.
 */
export const appendNumericSheet = (XLSX, workbook, worksheet, sheetName) => {
  ensureNumericWorksheet(worksheet);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
};
