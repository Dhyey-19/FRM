import * as XLSX from 'xlsx';
import { ensureNumericWorksheet } from './excelHelper';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker using module URL with fallback
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch (e) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.0.379'}/build/pdf.worker.min.mjs`;
}

/**
 * Standard date formatter to YYYY-MM-DD
 */
export const normalizeDate = (val) => {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val)) {
    return val.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  
  // DD/MM/YYYY or DD-MM-YYYY
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (m) {
    const year = m[1];
    const month = m[2].padStart(2, '0');
    const day = m[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // DD-Mon-YYYY (e.g. 15-Jan-2026 or 15/Jan/2026)
  m = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{2,4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const months = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const monStr = m[2].toLowerCase().substring(0, 3);
    const month = months[monStr] || '01';
    let year = m[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }

  // Excel serial number
  if (/^\d{5}$/.test(s)) {
    const serial = parseInt(s, 10);
    const utcDays = serial - 25569;
    const date = new Date(utcDays * 86400 * 1000);
    if (!isNaN(date)) return date.toISOString().split('T')[0];
  }

  const parsed = new Date(s);
  if (!isNaN(parsed) && parsed.getFullYear() > 1990) {
    return parsed.toISOString().split('T')[0];
  }

  return s;
};

/**
 * Format date for display (DD/MM/YYYY)
 */
export const formatDisplayDate = (isoStr) => {
  if (!isoStr) return '-';
  const parts = isoStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoStr;
};

/**
 * Clean and parse numeric amount
 */
export const parseCleanAmount = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return Math.abs(val);
  const s = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  const num = parseFloat(s);
  return isNaN(num) ? 0 : Math.abs(num);
};

/**
 * Header column finder by keywords
 */
const findColumnIndex = (headers, keywords) => {
  if (!headers || !headers.length) return -1;
  const lowerHeaders = headers.map(h => (h ? String(h).toLowerCase().trim() : ''));
  for (const kw of keywords) {
    const idx = lowerHeaders.findIndex(h => h === kw || h.includes(kw));
    if (idx !== -1) return idx;
  }
  return -1;
};

/**
 * Parse Excel (.xlsx, .xls, .csv) Bank Statement
 */
export const parseExcelStatement = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('The uploaded Excel file contains no sheets.');
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rawJson || rawJson.length === 0) {
          throw new Error('The uploaded sheet is empty.');
        }

        // Find header row: look for row containing keywords like date, particulars/description, debit/withdrawal, credit/deposit
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rawJson.length, 25); i++) {
          const rowStr = rawJson[i].map(c => String(c).toLowerCase()).join(' ');
          if (
            (rowStr.includes('date') || rowStr.includes('txn')) &&
            (rowStr.includes('particular') || rowStr.includes('desc') || rowStr.includes('narration') || rowStr.includes('detail') || rowStr.includes('remark')) &&
            (rowStr.includes('withdrawal') || rowStr.includes('deposit') || rowStr.includes('debit') || rowStr.includes('credit') || rowStr.includes('amount') || rowStr.includes('dr') || rowStr.includes('cr'))
          ) {
            headerRowIndex = i;
            break;
          }
        }

        // Fallback: look for row with 'date' and ('amount' or 'debit' or 'credit')
        if (headerRowIndex === -1) {
          for (let i = 0; i < Math.min(rawJson.length, 25); i++) {
            const rowStr = rawJson[i].map(c => String(c).toLowerCase()).join(' ');
            if (rowStr.includes('date') && (rowStr.includes('amount') || rowStr.includes('debit') || rowStr.includes('credit') || rowStr.includes('withdrawal') || rowStr.includes('deposit'))) {
              headerRowIndex = i;
              break;
            }
          }
        }

        // Default to first non-empty row if still not found
        if (headerRowIndex === -1) {
          headerRowIndex = rawJson.findIndex(r => r.some(c => Boolean(c)));
        }

        if (headerRowIndex === -1) {
          throw new Error('Unable to detect bank statement table headers.');
        }

        const headers = rawJson[headerRowIndex].map(h => (h !== undefined && h !== null ? String(h).trim() : ''));

        // Identify columns
        const dateCol = findColumnIndex(headers, ['txn date', 'transaction date', 'value date', 'posting date', 'date']);
        const descCol = findColumnIndex(headers, ['narration', 'particulars', 'particular', 'description', 'transaction details', 'details', 'remarks', 'remark']);
        const refCol = findColumnIndex(headers, ['cheque no', 'chq no', 'chq/ref no', 'ref no', 'reference no', 'reference', 'utr', 'tran id', 'transaction id', 'chq']);
        const withdrawalCol = findColumnIndex(headers, ['withdrawal amt', 'withdrawal amount', 'withdrawal', 'debit amt', 'debit amount', 'debit', 'dr amt', 'dr amount', 'paid out', 'dr']);
        const depositCol = findColumnIndex(headers, ['deposit amt', 'deposit amount', 'deposit', 'credit amt', 'credit amount', 'credit', 'cr amt', 'cr amount', 'received in', 'cr']);
        const balanceCol = findColumnIndex(headers, ['closing balance', 'net balance', 'running balance', 'balance']);
        const amountCol = findColumnIndex(headers, ['transaction amount', 'amount', 'amt']);
        const typeCol = findColumnIndex(headers, ['cr/dr', 'dr/cr', 'type', 'txn type', 'transaction type']);

        const transactions = [];

        for (let i = headerRowIndex + 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || !row.some(c => Boolean(c))) continue;

          const rawDate = dateCol !== -1 ? row[dateCol] : '';
          const normalizedDate = normalizeDate(rawDate);
          if (!normalizedDate || normalizedDate.length < 8) continue; // Skip non-date rows (summary / totals / footer)

          const description = descCol !== -1 ? String(row[descCol] || '').trim() : '';
          const refNo = refCol !== -1 ? String(row[refCol] || '').trim() : '';
          const balance = balanceCol !== -1 ? parseCleanAmount(row[balanceCol]) : 0;

          let withdrawal = 0;
          let deposit = 0;
          let type = '';

          if (withdrawalCol !== -1 && depositCol !== -1) {
            withdrawal = parseCleanAmount(row[withdrawalCol]);
            deposit = parseCleanAmount(row[depositCol]);
            if (withdrawal > 0) type = 'Withdrawal';
            else if (deposit > 0) type = 'Deposit';
          } else if (amountCol !== -1) {
            const rawAmt = parseCleanAmount(row[amountCol]);
            const typeStr = typeCol !== -1 ? String(row[typeCol] || '').toUpperCase() : '';
            if (typeStr.includes('DR') || typeStr.includes('WITHDRAW') || typeStr.includes('DEBIT')) {
              withdrawal = rawAmt;
              type = 'Withdrawal';
            } else if (typeStr.includes('CR') || typeStr.includes('DEPOSIT') || typeStr.includes('CREDIT')) {
              deposit = rawAmt;
              type = 'Deposit';
            } else {
              // Check description or sign
              const numVal = parseFloat(String(row[amountCol]).replace(/,/g, ''));
              if (numVal < 0) {
                withdrawal = Math.abs(numVal);
                type = 'Withdrawal';
              } else {
                deposit = Math.abs(numVal);
                type = 'Deposit';
              }
            }
          }

          const amount = withdrawal > 0 ? withdrawal : deposit;
          if (amount <= 0) continue; // Skip zero-amount header/footer lines

          transactions.push({
            id: `stmt-${transactions.length + 1}`,
            date: normalizedDate,
            dateDisplay: formatDisplayDate(normalizedDate),
            description: description || 'Bank Transaction',
            refNo: refNo || '-',
            withdrawal,
            deposit,
            amount: Number(amount.toFixed(2)),
            type: type || (withdrawal > 0 ? 'Withdrawal' : 'Deposit'),
            balance: balance > 0 ? Number(balance.toFixed(2)) : null,
            source: 'Excel'
          });
        }

        resolve({
          sheetName: firstSheetName,
          headers,
          totalRows: transactions.length,
          transactions
        });
      } catch (err) {
        console.error('Error parsing Excel bank statement:', err);
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Parse PDF Bank Statement
 */
export const parsePdfStatement = async (file) => {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      const allRows = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const items = textContent.items;

        if (!items || items.length === 0) continue;

        // Group items by vertical position 'y' with ~4px tolerance
        const rowsByY = [];
        items.forEach((item) => {
          const text = item.str.trim();
          if (!text) return;
          const y = item.transform[5];
          const x = item.transform[4];

          let row = rowsByY.find(r => Math.abs(r.y - y) <= 4);
          if (!row) {
            row = { y, items: [] };
            rowsByY.push(row);
          }
          row.items.push({ x, text });
        });

        // Sort rows by y descending (top of page first)
        rowsByY.sort((a, b) => b.y - a.y);

        // Sort items within row by x ascending (left to right)
        rowsByY.forEach(r => {
          r.items.sort((a, b) => a.x - b.x);
          const fullRowText = r.items.map(it => it.text).join('  ');
          allRows.push({
            fullText: fullRowText,
            items: r.items
          });
        });
      }

      // Regex patterns for transaction parsing
      const dateRegex = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}[-/\s][A-Za-z]{3}[-/\s]\d{2,4})\b/;
      const amountRegex = /\b(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})\b/g;

      const transactions = [];

      for (let i = 0; i < allRows.length; i++) {
        const { fullText, items } = allRows[i];
        
        // Check for date
        const dateMatch = fullText.match(dateRegex);
        if (!dateMatch) continue;

        const rawDate = dateMatch[0];
        const normalizedDate = normalizeDate(rawDate);
        if (!normalizedDate || normalizedDate.length < 8) continue;

        // Find numbers that look like amounts
        const amountMatches = [...fullText.matchAll(amountRegex)].map(m => m[0]);
        if (amountMatches.length === 0) continue;

        // Identify amounts (last 1-3 numbers are typically withdrawal, deposit, balance)
        const numericAmounts = amountMatches.map(a => parseCleanAmount(a)).filter(a => a > 0);
        if (numericAmounts.length === 0) continue;

        // Check for CR / DR flags in the row
        const upper = fullText.toUpperCase();
        const isDr = upper.includes(' DR') || upper.includes('(DR)') || upper.includes(' DEBIT') || upper.includes('WITHDRAW');
        const isCr = upper.includes(' CR') || upper.includes('(CR)') || upper.includes(' CREDIT') || upper.includes('DEPOSIT');

        let withdrawal = 0;
        let deposit = 0;
        let balance = null;

        if (numericAmounts.length >= 2) {
          // If there are 2+ numbers, usually: [amount, balance] or [withdrawal, deposit, balance]
          if (numericAmounts.length === 2) {
            const amt = numericAmounts[0];
            balance = numericAmounts[1];
            if (isDr) withdrawal = amt;
            else if (isCr) deposit = amt;
            else {
              // Default to withdrawal if unclear or check keywords
              withdrawal = amt;
            }
          } else {
            // 3 numbers: withdrawal, deposit, balance
            withdrawal = numericAmounts[0];
            deposit = numericAmounts[1];
            balance = numericAmounts[2];
          }
        } else {
          const amt = numericAmounts[0];
          if (isDr) withdrawal = amt;
          else if (isCr) deposit = amt;
          else withdrawal = amt;
        }

        const amount = withdrawal > 0 ? withdrawal : deposit;
        if (amount <= 0) continue;

        // Extract description (text between date and amounts)
        let desc = fullText
          .replace(rawDate, '')
          .replace(amountRegex, '')
          .replace(/\b(DR|CR|Dr|Cr)\b/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        // Extract potential reference / cheque number (digits of length 6 to 16)
        const refMatch = desc.match(/\b(\d{6,16})\b/);
        const refNo = refMatch ? refMatch[1] : '-';

        transactions.push({
          id: `stmt-${transactions.length + 1}`,
          date: normalizedDate,
          dateDisplay: formatDisplayDate(normalizedDate),
          description: desc || 'Bank Transaction',
          refNo,
          withdrawal,
          deposit,
          amount: Number(amount.toFixed(2)),
          type: withdrawal > 0 ? 'Withdrawal' : 'Deposit',
          balance: balance ? Number(balance.toFixed(2)) : null,
          source: 'PDF'
        });
      }

      if (transactions.length === 0) {
        throw new Error('No transaction rows could be extracted from the uploaded PDF statement. Please try exporting your statement from net-banking as Excel / CSV, or verify the PDF format.');
      }

      resolve({
        totalRows: transactions.length,
        transactions
      });
    } catch (err) {
      console.error('Error parsing PDF bank statement:', err);
      reject(err);
    }
  });
};

/**
 * Difference in days between two YYYY-MM-DD dates
 */
export const dateDiffDays = (date1, date2) => {
  if (!date1 || !date2) return 9999;
  const d1 = new Date(date1.split('T')[0]);
  const d2 = new Date(date2.split('T')[0]);
  const diffTime = Math.abs(d2 - d1);
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Reconciliation Engine
 * Pairs Bank Statement entries with Books (Vouchers)
 */
export const reconcileEntries = (statementRows = [], bookVouchers = [], options = {}) => {
  const {
    dateToleranceDays = 3,
    matchByRefNo = true,
    invertDrCr = false
  } = options;

  // Prepare normalized vouchers for comparison
  const availableVouchers = bookVouchers.map((v, idx) => {
    const vDate = v.VoucherDate ? v.VoucherDate.split('T')[0] : '';
    const vAmt = Number(parseFloat(v.Amount || 0).toFixed(2));
    
    // In Books on Bank Ledger:
    // Debit = Deposit into bank (Inflow)
    // Credit = Withdrawal from bank (Outflow)
    let bookType = v.Mode === 'Debit' ? 'Deposit' : 'Withdrawal';
    if (invertDrCr) {
      bookType = v.Mode === 'Debit' ? 'Withdrawal' : 'Deposit';
    }

    return {
      id: `book-${v.VoucherNo}-${idx}`,
      voucherNo: v.VoucherNo,
      date: vDate,
      dateDisplay: formatDisplayDate(vDate),
      mode: v.Mode,
      voucherType: v.VoucherType === 'General' ? 'Journal' : (v.VoucherType || 'Journal'),
      amount: vAmt,
      bookType, // 'Deposit' or 'Withdrawal'
      through: v.Through || '',
      remark: v.Remark || '',
      bill: v.Bill,
      ledgerName: v.LedgerName || '',
      matched: false,
      raw: v
    };
  });

  const matchedPairs = [];
  const unmatchedStatements = [];

  // Clone statement rows for tracking
  const statementItems = statementRows.map(s => ({
    ...s,
    amount: Number(parseFloat(s.amount || 0).toFixed(2)),
    matched: false
  }));

  // Step 1: Exact Match (Amount + Direction + Exact Cheque/Ref No)
  if (matchByRefNo) {
    for (const stmt of statementItems) {
      if (stmt.matched) continue;
      if (!stmt.refNo || stmt.refNo === '-') continue;

      const cleanStmtRef = String(stmt.refNo).trim().toLowerCase();
      const matchIdx = availableVouchers.findIndex(v => {
        if (v.matched) return false;
        if (v.bookType !== stmt.type) return false;
        if (Math.abs(v.amount - stmt.amount) > 0.01) return false;

        const vRemark = String(v.remark || '').toLowerCase();
        const vThrough = String(v.through || '').toLowerCase();
        const vNo = String(v.voucherNo);

        return vRemark.includes(cleanStmtRef) || vThrough.includes(cleanStmtRef) || vNo === cleanStmtRef;
      });

      if (matchIdx !== -1) {
        const v = availableVouchers[matchIdx];
        v.matched = true;
        stmt.matched = true;
        matchedPairs.push({
          id: `match-ref-${matchedPairs.length + 1}`,
          status: 'MATCHED',
          matchConfidence: 'Exact (Ref No & Amount)',
          matchReason: `Cheque/Ref #${stmt.refNo} & Amount ₹${stmt.amount} match`,
          daysDiff: dateDiffDays(stmt.date, v.date),
          statement: stmt,
          book: v
        });
      }
    }
  }

  // Step 2: Exact Match (Amount + Direction + Exact Same Date)
  for (const stmt of statementItems) {
    if (stmt.matched) continue;

    const matchIdx = availableVouchers.findIndex(v => {
      if (v.matched) return false;
      if (v.bookType !== stmt.type) return false;
      if (Math.abs(v.amount - stmt.amount) > 0.01) return false;
      return v.date === stmt.date;
    });

    if (matchIdx !== -1) {
      const v = availableVouchers[matchIdx];
      v.matched = true;
      stmt.matched = true;
      matchedPairs.push({
        id: `match-date-${matchedPairs.length + 1}`,
        status: 'MATCHED',
        matchConfidence: 'Exact (Date & Amount)',
        matchReason: `Date ${stmt.dateDisplay} & Amount ₹${stmt.amount} match`,
        daysDiff: 0,
        statement: stmt,
        book: v
      });
    }
  }

  // Step 3: Date Tolerance Match (Amount + Direction + Date within tolerance)
  for (const stmt of statementItems) {
    if (stmt.matched) continue;

    let bestMatchIdx = -1;
    let minDays = 9999;

    availableVouchers.forEach((v, idx) => {
      if (v.matched) return;
      if (v.bookType !== stmt.type) return false;
      if (Math.abs(v.amount - stmt.amount) > 0.01) return false;

      const diff = dateDiffDays(stmt.date, v.date);
      if (diff <= dateToleranceDays && diff < minDays) {
        minDays = diff;
        bestMatchIdx = idx;
      }
    });

    if (bestMatchIdx !== -1) {
      const v = availableVouchers[bestMatchIdx];
      v.matched = true;
      stmt.matched = true;
      matchedPairs.push({
        id: `match-tol-${matchedPairs.length + 1}`,
        status: 'MATCHED',
        matchConfidence: minDays === 0 ? 'High' : 'Medium (Clearance Lag)',
        matchReason: `Amount ₹${stmt.amount} match with ${minDays} day(s) clearance difference`,
        daysDiff: minDays,
        statement: stmt,
        book: v
      });
    }
  }

  // Collect unmatched statement rows
  for (const stmt of statementItems) {
    if (!stmt.matched) {
      unmatchedStatements.push({
        id: `unmatched-stmt-${unmatchedStatements.length + 1}`,
        status: 'UNMATCHED_STATEMENT',
        matchConfidence: 'None',
        matchReason: 'In Bank Statement Only (Missing or not recorded in Books)',
        statement: stmt,
        book: null
      });
    }
  }

  // Collect unmatched book vouchers
  const unmatchedBooks = availableVouchers
    .filter(v => !v.matched)
    .map((v, idx) => ({
      id: `unmatched-book-${idx + 1}`,
      status: 'UNMATCHED_BOOKS',
      matchConfidence: 'None',
      matchReason: 'In Books Only (Pending clearance or not yet in Bank Statement)',
      statement: null,
      book: v
    }));

  // Combined reconciliation list
  const allReconciliationItems = [
    ...matchedPairs,
    ...unmatchedStatements,
    ...unmatchedBooks
  ];

  // Summary Metrics
  const totalStmtAmount = statementItems.reduce((sum, s) => sum + s.amount, 0);
  const totalBookAmount = availableVouchers.reduce((sum, v) => sum + v.amount, 0);

  const matchedStmtAmount = matchedPairs.reduce((sum, m) => sum + m.statement.amount, 0);
  const unmatchedStmtAmount = unmatchedStatements.reduce((sum, u) => sum + u.statement.amount, 0);
  const unmatchedBookAmount = unmatchedBooks.reduce((sum, u) => sum + u.book.amount, 0);

  // Totals by direction
  const stmtDeposits = statementItems.filter(s => s.type === 'Deposit').reduce((sum, s) => sum + s.amount, 0);
  const stmtWithdrawals = statementItems.filter(s => s.type === 'Withdrawal').reduce((sum, s) => sum + s.amount, 0);
  const netStmtFlow = stmtDeposits - stmtWithdrawals;

  const bookDeposits = availableVouchers.filter(v => v.bookType === 'Deposit').reduce((sum, v) => sum + v.amount, 0);
  const bookWithdrawals = availableVouchers.filter(v => v.bookType === 'Withdrawal').reduce((sum, v) => sum + v.amount, 0);
  const netBookFlow = bookDeposits - bookWithdrawals;

  return {
    matchedPairs,
    unmatchedStatements,
    unmatchedBooks,
    allReconciliationItems,
    summary: {
      totalStatementCount: statementItems.length,
      totalBookCount: availableVouchers.length,
      matchedCount: matchedPairs.length,
      unmatchedStatementCount: unmatchedStatements.length,
      unmatchedBookCount: unmatchedBooks.length,
      totalStmtAmount: Number(totalStmtAmount.toFixed(2)),
      totalBookAmount: Number(totalBookAmount.toFixed(2)),
      matchedStmtAmount: Number(matchedStmtAmount.toFixed(2)),
      unmatchedStmtAmount: Number(unmatchedStmtAmount.toFixed(2)),
      unmatchedBookAmount: Number(unmatchedBookAmount.toFixed(2)),
      stmtDeposits: Number(stmtDeposits.toFixed(2)),
      stmtWithdrawals: Number(stmtWithdrawals.toFixed(2)),
      netStmtFlow: Number(netStmtFlow.toFixed(2)),
      bookDeposits: Number(bookDeposits.toFixed(2)),
      bookWithdrawals: Number(bookWithdrawals.toFixed(2)),
      netBookFlow: Number(netBookFlow.toFixed(2)),
      reconciliationDifference: Number(Math.abs(unmatchedStmtAmount - unmatchedBookAmount).toFixed(2))
    }
  };
};

/**
 * Generate Sample Excel template for user download
 */
export const downloadSampleBankStatement = () => {
  const sampleData = [
    {
      'Date': '01/10/2026',
      'Particulars': 'NEFT/RTGS From Apex Industries',
      'Cheque No': 'CHQ98231',
      'Withdrawal (Debit)': '',
      'Deposit (Credit)': 75000.00,
      'Balance': 175000.00
    },
    {
      'Date': '03/10/2026',
      'Particulars': 'Cheque Issued to Vendor Alpha Corp',
      'Cheque No': '104421',
      'Withdrawal (Debit)': 24500.00,
      'Deposit (Credit)': '',
      'Balance': 150500.00
    },
    {
      'Date': '05/10/2026',
      'Particulars': 'Monthly Bank Charges & GST',
      'Cheque No': 'BANKCHG',
      'Withdrawal (Debit)': 354.00,
      'Deposit (Credit)': '',
      'Balance': 150146.00
    },
    {
      'Date': '08/10/2026',
      'Particulars': 'Direct Customer Deposit - Delta Tools',
      'Cheque No': 'UTR998822',
      'Withdrawal (Debit)': '',
      'Deposit (Credit)': 50000.00,
      'Balance': 200146.00
    },
    {
      'Date': '10/10/2026',
      'Particulars': 'Vendor Payment RTGS - Pioneer Steel',
      'Cheque No': 'RTGS5544',
      'Withdrawal (Debit)': 82000.00,
      'Deposit (Credit)': '',
      'Balance': 118146.00
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  ensureNumericWorksheet(worksheet);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Bank Statement');
  XLSX.writeFile(workbook, 'Sample_Bank_Statement.xlsx');
};
