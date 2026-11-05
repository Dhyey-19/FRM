const { sql, connectDB } = require('../config/db');

// Ensure PaymentQR table exists in local SQLite
async function ensureTable(pool) {
  await pool.request().query(`
    CREATE TABLE IF NOT EXISTS "PaymentQR" (
      "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "Label" VARCHAR(100) NOT NULL,
      "UpiId" VARCHAR(100) NOT NULL,
      "PayeeName" VARCHAR(100),
      "BankName" VARCHAR(100),
      "AccountNo" VARCHAR(50),
      "IFSC" VARCHAR(20),
      "IsPrimary" INTEGER DEFAULT 0,
      "CreatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// GET /api/payment-qr
// Returns aggregated QR codes:
// 1. Company Profile UPI (if present)
// 2. LedgerMaster bank accounts with UPI (if present)
// 3. User-added custom QRs from PaymentQR table
exports.getAllPaymentQRs = async (req, res) => {
  try {
    const pool = await connectDB();
    await ensureTable(pool);

    const allQRs = [];

    // 1. Fetch Company Profile
    try {
      const cpRes = await pool.request().query('SELECT TOP 1 CompanyName, UPI, BankName, AccountNo, IFSCCode FROM CompanyProfile');
      if (cpRes.recordset.length > 0) {
        const cp = cpRes.recordset[0];
        if (cp.UPI && cp.UPI.trim()) {
          allQRs.push({
            id: 'company_profile',
            label: 'Company Primary (Profile)',
            upiId: cp.UPI.trim(),
            payeeName: cp.CompanyName || 'FRM Precision Manufacturing',
            bankName: cp.BankName || '',
            accountNo: cp.AccountNo || '',
            ifsc: cp.IFSCCode || '',
            isPrimary: true,
            source: 'company',
            canDelete: false
          });
        }
      }
    } catch (err) {
      console.warn('[PaymentQR] Notice checking CompanyProfile:', err.message);
    }

    // 2. Fetch Bank Ledgers with UPI (Only Company Bank Accounts, not Debtors/Creditors)
    try {
      const ledgerRes = await pool.request().query(`
        SELECT Id, LedgerName, UPI, BankName, AccountNo, IFSC
        FROM LedgerMaster
        WHERE AccountGroupID = 6 AND UPI IS NOT NULL AND TRIM(UPI) != ''
        ORDER BY LedgerName ASC
      `);
      for (const row of ledgerRes.recordset) {
        // Skip duplicate if exact same UPI as company profile
        if (allQRs.some(q => q.upiId.toLowerCase() === row.UPI.trim().toLowerCase())) {
          continue;
        }
        allQRs.push({
          id: `ledger_${row.Id}`,
          label: row.LedgerName,
          upiId: row.UPI.trim(),
          payeeName: row.LedgerName,
          bankName: row.BankName || '',
          accountNo: row.AccountNo || '',
          ifsc: row.IFSC || '',
          isPrimary: false,
          source: 'ledger',
          canDelete: false
        });
      }
    } catch (err) {
      console.warn('[PaymentQR] Notice checking LedgerMaster:', err.message);
    }

    // 3. Fetch Custom Saved QRs
    try {
      const customRes = await pool.request().query(`
        SELECT Id, Label, UpiId, PayeeName, BankName, AccountNo, IFSC, IsPrimary, CreatedAt
        FROM PaymentQR
        ORDER BY IsPrimary DESC, Id DESC
      `);
      for (const row of customRes.recordset) {
        allQRs.push({
          id: String(row.Id),
          label: row.Label,
          upiId: row.UpiId,
          payeeName: row.PayeeName || row.Label,
          bankName: row.BankName || '',
          accountNo: row.AccountNo || '',
          ifsc: row.IFSC || '',
          isPrimary: Boolean(row.IsPrimary),
          source: 'custom',
          canDelete: true,
          createdAt: row.CreatedAt
        });
      }
    } catch (err) {
      console.warn('[PaymentQR] Notice checking PaymentQR table:', err.message);
    }

    res.status(200).json(allQRs);
  } catch (error) {
    console.error('[PaymentQR] Error fetching payment QRs:', error);
    res.status(500).json({ message: 'Error retrieving payment QRs: ' + error.message });
  }
};

// POST /api/payment-qr
exports.createPaymentQR = async (req, res) => {
  const { label, upiId, payeeName, bankName, accountNo, ifsc, isPrimary } = req.body;

  if (!label || !label.trim()) {
    return res.status(400).json({ message: 'QR Label is required (e.g. Counter 1, Billing Desk).' });
  }

  if (!upiId || !upiId.trim()) {
    return res.status(400).json({ message: 'UPI ID is required (e.g. merchant@upi, company@sbi).' });
  }

  const cleanUpi = upiId.trim();
  const cleanLabel = label.trim();

  try {
    const pool = await connectDB();
    await ensureTable(pool);

    // If marked primary, unset other custom primary flags
    if (isPrimary) {
      await pool.request().query('UPDATE PaymentQR SET IsPrimary = 0');
    }

    await pool.request()
      .input('Label', sql.VarChar(100), cleanLabel)
      .input('UpiId', sql.VarChar(100), cleanUpi)
      .input('PayeeName', sql.VarChar(100), payeeName ? payeeName.trim() : cleanLabel)
      .input('BankName', sql.VarChar(100), bankName ? bankName.trim() : null)
      .input('AccountNo', sql.VarChar(50), accountNo ? accountNo.trim() : null)
      .input('IFSC', sql.VarChar(20), ifsc ? ifsc.trim() : null)
      .input('IsPrimary', sql.Int, isPrimary ? 1 : 0)
      .query(`
        INSERT INTO PaymentQR (Label, UpiId, PayeeName, BankName, AccountNo, IFSC, IsPrimary)
        VALUES (@Label, @UpiId, @PayeeName, @BankName, @AccountNo, @IFSC, @IsPrimary)
      `);

    const idRes = await pool.request().query('SELECT last_insert_rowid() AS id');
    const newId = idRes.recordset?.[0]?.id;

    res.status(201).json({ message: 'Payment QR added successfully', id: newId });
  } catch (error) {
    console.error('[PaymentQR] Error saving payment QR:', error);
    res.status(500).json({ message: 'Failed to save payment QR: ' + error.message });
  }
};

// PUT /api/payment-qr/:id
exports.updatePaymentQR = async (req, res) => {
  const { id } = req.params;
  const { label, upiId, payeeName, bankName, accountNo, ifsc, isPrimary } = req.body;

  if (!label || !label.trim() || !upiId || !upiId.trim()) {
    return res.status(400).json({ message: 'Label and UPI ID are required.' });
  }

  try {
    const pool = await connectDB();
    await ensureTable(pool);

    if (isPrimary) {
      await pool.request().query('UPDATE PaymentQR SET IsPrimary = 0');
    }

    await pool.request()
      .input('Id', sql.Int, parseInt(id, 10))
      .input('Label', sql.VarChar(100), label.trim())
      .input('UpiId', sql.VarChar(100), upiId.trim())
      .input('PayeeName', sql.VarChar(100), payeeName ? payeeName.trim() : label.trim())
      .input('BankName', sql.VarChar(100), bankName ? bankName.trim() : null)
      .input('AccountNo', sql.VarChar(50), accountNo ? accountNo.trim() : null)
      .input('IFSC', sql.VarChar(20), ifsc ? ifsc.trim() : null)
      .input('IsPrimary', sql.Int, isPrimary ? 1 : 0)
      .query(`
        UPDATE PaymentQR 
        SET Label = @Label,
            UpiId = @UpiId,
            PayeeName = @PayeeName,
            BankName = @BankName,
            AccountNo = @AccountNo,
            IFSC = @IFSC,
            IsPrimary = @IsPrimary
        WHERE Id = @Id
      `);

    res.status(200).json({ message: 'Payment QR updated successfully' });
  } catch (error) {
    console.error('[PaymentQR] Error updating payment QR:', error);
    res.status(500).json({ message: 'Failed to update payment QR: ' + error.message });
  }
};

// DELETE /api/payment-qr/:id
exports.deletePaymentQR = async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await connectDB();
    await ensureTable(pool);

    await pool.request()
      .input('Id', sql.Int, parseInt(id, 10))
      .query('DELETE FROM PaymentQR WHERE Id = @Id');

    res.status(200).json({ message: 'Payment QR deleted successfully' });
  } catch (error) {
    console.error('[PaymentQR] Error deleting payment QR:', error);
    res.status(500).json({ message: 'Failed to delete payment QR: ' + error.message });
  }
};

