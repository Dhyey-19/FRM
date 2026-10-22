const { sql, connectDB } = require('../config/db');

const getSignature = (username) => {
    const name = username || 'System';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const sig = `${name} - ${dateStr} ${timeStr}`;
    return sig.substring(0, 40);
};

const syncLedgerClosingBalances = async (requestOrPool, ledgerIds) => {
  const ids = [...new Set((ledgerIds || []).map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0))];
  if (ids.length === 0) return;
  await requestOrPool.query(`
    UPDATE l
    SET l.ClosingBalance = ISNULL(l.OpeningBalance, 0) + ISNULL(v.NetVouchers, 0)
    FROM LedgerMaster l
    LEFT JOIN (
      SELECT LedgerId, SUM(CASE WHEN Mode = 'Debit' THEN Amount ELSE -Amount END) AS NetVouchers
      FROM VoucherEntry
      WHERE LedgerId IN (${ids.join(',')})
      GROUP BY LedgerId
    ) v ON l.Id = v.LedgerId
    WHERE l.Id IN (${ids.join(',')});
  `);
};

exports.getVouchers = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT v.*, l.LedgerName 
      FROM VoucherEntry v
      LEFT JOIN LedgerMaster l ON v.LedgerId = l.Id
      ORDER BY v.VoucherDate DESC, v.VoucherNo DESC
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching vouchers:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addVoucher = async (req, res) => {
  const { VoucherDate, Mode, LedgerId, Amount, Through, Remark, Bill } = req.body;

  if (!VoucherDate || !Mode || !LedgerId || !Amount) {
    return res.status(400).json({ message: 'Date, Mode, Ledger, and Amount are required' });
  }

  try {
    const pool = await connectDB();
    
    // Get next VoucherNo
    const nextNoRes = await pool.request().query('SELECT ISNULL(MAX(VoucherNo), 0) + 1 AS NextVoucherNo FROM VoucherEntry');
    const voucherNo = nextNoRes.recordset[0].NextVoucherNo;

    const isBill = Bill !== undefined ? (Bill !== false && Bill !== 0 && Bill !== '0' ? 1 : 0) : 1;

    await pool.request()
      .input('VoucherNo', sql.Numeric(8,0), voucherNo)
      .input('VoucherType', sql.VarChar(10), req.body.VoucherType || 'Journal')
      .input('VoucherDate', sql.Date, VoucherDate)
      .input('Mode', sql.VarChar(6), Mode)
      .input('LedgerId', sql.Numeric(10,0), LedgerId)
      .input('Amount', sql.Numeric(10,2), Amount)
      .input('Through', sql.VarChar(30), Through || null)
      .input('Remark', sql.VarChar(255), Remark || null)
      .input('Bill', sql.Bit, isBill)
      .input('CreatedBy', sql.VarChar(255), getSignature(req.body.CreatedBy))
      .input('UpdatedBy', sql.VarChar(255), getSignature(req.body.CreatedBy))
      .query(`
        INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, Bill, CreatedBy, UpdatedBy)
        VALUES (@VoucherNo, @VoucherType, @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @Bill, @CreatedBy, @UpdatedBy)
      `);
      
    await syncLedgerClosingBalances(pool.request(), [LedgerId]);

    res.status(201).json({ message: 'Voucher added successfully' });
  } catch (error) {
    console.error('Error adding voucher:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addVouchersBulk = async (req, res) => {
  const { vouchers, Bill } = req.body;
  if (!vouchers || !Array.isArray(vouchers) || vouchers.length === 0) {
    return res.status(400).json({ message: 'A non-empty array of vouchers is required' });
  }

  let pool;
  try {
    pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const nextNoReq = new sql.Request(transaction);
      const nextNoRes = await nextNoReq.query('SELECT ISNULL(MAX(VoucherNo), 0) + 1 AS NextVoucherNo FROM VoucherEntry');
      const voucherNo = nextNoRes.recordset[0].NextVoucherNo;

      for (const v of vouchers) {
        if (!v.VoucherDate || !v.Mode || !v.LedgerId || !v.Amount) {
          throw new Error('Date, Mode, Ledger, and Amount are required for each row');
        }
        
        const isBill = v.Bill !== undefined 
          ? (v.Bill !== false && v.Bill !== 0 && v.Bill !== '0' ? 1 : 0)
          : (Bill !== undefined ? (Bill !== false && Bill !== 0 && Bill !== '0' ? 1 : 0) : 1);

        const request = new sql.Request(transaction);
        await request
          .input('VoucherNo', sql.Numeric(8,0), voucherNo)
          .input('VoucherType', sql.VarChar(10), v.VoucherType || 'Journal')
          .input('VoucherDate', sql.Date, v.VoucherDate)
          .input('Mode', sql.VarChar(6), v.Mode)
          .input('LedgerId', sql.Numeric(10,0), v.LedgerId)
          .input('Amount', sql.Numeric(10,2), v.Amount)
          .input('Through', sql.VarChar(30), v.Through || null)
          .input('Remark', sql.VarChar(255), v.Remark || null)
          .input('Bill', sql.Bit, isBill)
          .input('CreatedBy', sql.VarChar(255), getSignature(v.CreatedBy))
          .input('UpdatedBy', sql.VarChar(255), getSignature(v.CreatedBy))
          .query(`
            INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, Bill, CreatedBy, UpdatedBy)
            VALUES (@VoucherNo, @VoucherType, @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @Bill, @CreatedBy, @UpdatedBy);
          `);
      }
      
      const affectedLedgerIds = vouchers.map(v => v.LedgerId);
      await syncLedgerClosingBalances(new sql.Request(transaction), affectedLedgerIds);
      
      await transaction.commit();
      res.status(201).json({ message: 'Bulk vouchers added successfully', voucherNo });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error adding vouchers bulk:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

exports.updateVouchersBulk = async (req, res) => {
  const { voucherNo } = req.params;
  const { vouchers, Bill } = req.body;

  if (!vouchers || !Array.isArray(vouchers) || vouchers.length === 0) {
    return res.status(400).json({ message: 'A non-empty array of vouchers is required' });
  }

  let pool;
  try {
    pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Check if it's an auto-generated voucher
      const checkReq = new sql.Request(transaction);
      const checkRes = await checkReq
        .input('VoucherNo', sql.Numeric(8,0), voucherNo)
        .query('SELECT TOP 1 VoucherType FROM VoucherEntry WHERE VoucherNo = @VoucherNo');
      
      if (checkRes.recordset.length > 0 && ['Purchase', 'Sales'].includes(checkRes.recordset[0].VoucherType)) {
        throw new Error('This voucher was automatically generated by a ' + checkRes.recordset[0].VoucherType + ' transaction and cannot be edited directly. Please edit the corresponding transaction.');
      }

      // Get existing ledger IDs for this VoucherNo before deletion
      const oldLedgerReq = new sql.Request(transaction);
      const oldLedgerRes = await oldLedgerReq
        .input('VoucherNo', sql.Numeric(8,0), voucherNo)
        .query('SELECT DISTINCT LedgerId FROM VoucherEntry WHERE VoucherNo = @VoucherNo');
      const oldLedgerIds = oldLedgerRes.recordset.map(r => r.LedgerId);

      // Delete existing records for this VoucherNo
      const deleteReq = new sql.Request(transaction);
      await deleteReq
        .input('VoucherNo', sql.Numeric(8,0), voucherNo)
        .query(`DELETE FROM VoucherEntry WHERE VoucherNo = @VoucherNo;`);

      // Insert new records with the same VoucherNo
      for (const v of vouchers) {
        if (!v.VoucherDate || !v.Mode || !v.LedgerId || !v.Amount) {
          throw new Error('Date, Mode, Ledger, and Amount are required for each row');
        }
        
        const isBill = v.Bill !== undefined 
          ? (v.Bill !== false && v.Bill !== 0 && v.Bill !== '0' ? 1 : 0)
          : (Bill !== undefined ? (Bill !== false && Bill !== 0 && Bill !== '0' ? 1 : 0) : 1);

        const request = new sql.Request(transaction);
        await request
          .input('VoucherNo', sql.Numeric(8,0), voucherNo)
          .input('VoucherType', sql.VarChar(10), v.VoucherType || 'Journal')
          .input('VoucherDate', sql.Date, v.VoucherDate)
          .input('Mode', sql.VarChar(6), v.Mode)
          .input('LedgerId', sql.Numeric(10,0), v.LedgerId)
          .input('Amount', sql.Numeric(10,2), v.Amount)
          .input('Through', sql.VarChar(30), v.Through || null)
          .input('Remark', sql.VarChar(255), v.Remark || null)
          .input('Bill', sql.Bit, isBill)
          .input('CreatedBy', sql.VarChar(255), getSignature(v.CreatedBy))
          .input('UpdatedBy', sql.VarChar(255), getSignature(v.CreatedBy))
          .query(`
            INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, Bill, CreatedBy, UpdatedBy)
            VALUES (@VoucherNo, @VoucherType, @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @Bill, @CreatedBy, @UpdatedBy);
          `);
      }
      
      const allAffected = [...oldLedgerIds, ...vouchers.map(v => v.LedgerId)];
      await syncLedgerClosingBalances(new sql.Request(transaction), allAffected);
      
      await transaction.commit();
      res.status(200).json({ message: 'Bulk vouchers updated successfully', voucherNo });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error updating vouchers bulk:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

exports.updateVoucher = async (req, res) => {
  const { id } = req.params;
  const { VoucherDate, Mode, LedgerId, Amount, Through, Remark, Bill } = req.body;

  if (!VoucherDate || !Mode || !LedgerId || !Amount) {
    return res.status(400).json({ message: 'Date, Mode, Ledger, and Amount are required' });
  }

  try {
    const pool = await connectDB();
    const isBill = Bill !== undefined ? (Bill !== false && Bill !== 0 && Bill !== '0' ? 1 : 0) : 1;

    const oldRow = await pool.request()
      .input('VoucherId', sql.Numeric(8,0), id)
      .query('SELECT LedgerId FROM VoucherEntry WHERE VoucherId = @VoucherId');
    const oldLedgerId = oldRow.recordset[0]?.LedgerId;

    await pool.request()
      .input('VoucherId', sql.Numeric(8,0), id)
      .input('VoucherDate', sql.Date, VoucherDate)
      .input('Mode', sql.VarChar(6), Mode)
      .input('LedgerId', sql.Numeric(10,0), LedgerId)
      .input('Amount', sql.Numeric(10,2), Amount)
      .input('Through', sql.VarChar(30), Through || null)
      .input('Remark', sql.VarChar(255), Remark || null)
      .input('Bill', sql.Bit, isBill)
      .input('UpdatedBy', sql.VarChar(255), getSignature(req.body.UpdatedBy))
      .query(`
        UPDATE VoucherEntry 
        SET VoucherDate = @VoucherDate, Mode = @Mode, LedgerId = @LedgerId, 
            Amount = @Amount, Through = @Through, Remark = @Remark, Bill = @Bill,
            UpdatedBy = @UpdatedBy
        WHERE VoucherId = @VoucherId
      `);
      
    await syncLedgerClosingBalances(pool.request(), [oldLedgerId, LedgerId]);

    res.status(200).json({ message: 'Voucher updated successfully' });
  } catch (error) {
    console.error('Error updating voucher:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteVoucher = async (req, res) => {
  const { id } = req.params; // this id is now VoucherNo from the frontend

  let pool;
  try {
    pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Check if it's an auto-generated voucher
      const checkReq = new sql.Request(transaction);
      const checkRes = await checkReq
        .input('VoucherNo', sql.Numeric(8,0), id)
        .query('SELECT TOP 1 VoucherType FROM VoucherEntry WHERE VoucherNo = @VoucherNo');
      
      if (checkRes.recordset.length > 0 && ['Purchase', 'Sales'].includes(checkRes.recordset[0].VoucherType)) {
        throw new Error('This voucher was automatically generated by a ' + checkRes.recordset[0].VoucherType + ' transaction and cannot be deleted directly. Please delete the corresponding transaction.');
      }

      const oldLedgerReq = new sql.Request(transaction);
      const oldLedgerRes = await oldLedgerReq
        .input('VoucherNo', sql.Numeric(8,0), id)
        .query('SELECT DISTINCT LedgerId FROM VoucherEntry WHERE VoucherNo = @VoucherNo');
      const oldLedgerIds = oldLedgerRes.recordset.map(r => r.LedgerId);

      const request = new sql.Request(transaction);
      await request
        .input('VoucherNo', sql.Numeric(8,0), id)
        .query(`DELETE FROM VoucherEntry WHERE VoucherNo = @VoucherNo;`);
      
      await syncLedgerClosingBalances(new sql.Request(transaction), oldLedgerIds);
      
      await transaction.commit();
      res.status(200).json({ message: 'Voucher deleted successfully' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error deleting voucher:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
