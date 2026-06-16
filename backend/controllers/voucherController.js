const { sql, connectDB } = require('../config/db');

const getSignature = (username) => {
    const name = username || 'System';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const sig = `${name} - ${dateStr} ${timeStr}`;
    return sig.substring(0, 40);
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
  const { VoucherDate, Mode, LedgerId, Amount, Through, Remark } = req.body;

  if (!VoucherDate || !Mode || !LedgerId || !Amount) {
    return res.status(400).json({ message: 'Date, Mode, Ledger, and Amount are required' });
  }

  try {
    const pool = await connectDB();
    
    // Get next VoucherNo
    const nextNoRes = await pool.request().query('SELECT ISNULL(MAX(VoucherNo), 0) + 1 AS NextVoucherNo FROM VoucherEntry');
    const voucherNo = nextNoRes.recordset[0].NextVoucherNo;

    await pool.request()
      .input('VoucherNo', sql.Numeric(8,0), voucherNo)
      .input('VoucherType', sql.VarChar(10), req.body.VoucherType || 'General')
      .input('VoucherDate', sql.Date, VoucherDate)
      .input('Mode', sql.VarChar(6), Mode)
      .input('LedgerId', sql.Numeric(10,0), LedgerId)
      .input('Amount', sql.Numeric(10,2), Amount)
      .input('Through', sql.VarChar(30), Through || null)
      .input('Remark', sql.VarChar(255), Remark || null)
      .input('CreatedBy', sql.VarChar(255), getSignature(req.body.CreatedBy))
      .input('UpdatedBy', sql.VarChar(255), getSignature(req.body.CreatedBy))
      .query(`
        INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, CreatedBy, UpdatedBy)
        VALUES (@VoucherNo, @VoucherType, @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @CreatedBy, @UpdatedBy)
      `);
      
    res.status(201).json({ message: 'Voucher added successfully' });
  } catch (error) {
    console.error('Error adding voucher:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addVouchersBulk = async (req, res) => {
  const { vouchers } = req.body;
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
        
        const request = new sql.Request(transaction);
        await request
          .input('VoucherNo', sql.Numeric(8,0), voucherNo)
          .input('VoucherType', sql.VarChar(10), v.VoucherType || 'General')
          .input('VoucherDate', sql.Date, v.VoucherDate)
          .input('Mode', sql.VarChar(6), v.Mode)
          .input('LedgerId', sql.Numeric(10,0), v.LedgerId)
          .input('Amount', sql.Numeric(10,2), v.Amount)
          .input('Through', sql.VarChar(30), v.Through || null)
          .input('Remark', sql.VarChar(255), v.Remark || null)
          .input('CreatedBy', sql.VarChar(255), getSignature(v.CreatedBy))
          .input('UpdatedBy', sql.VarChar(255), getSignature(v.CreatedBy))
          .query(`
            INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, CreatedBy, UpdatedBy)
            VALUES (@VoucherNo, @VoucherType, @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @CreatedBy, @UpdatedBy);

            UPDATE LedgerMaster 
            SET ClosingBalance = ISNULL(ClosingBalance, 0) + CASE WHEN @Mode = 'Debit' THEN @Amount ELSE -@Amount END
            WHERE Id = @LedgerId;
          `);
      }
      
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
  const { vouchers } = req.body;

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

      // Reverse existing records for this VoucherNo in LedgerMaster and delete them
      const deleteReq = new sql.Request(transaction);
      await deleteReq
        .input('VoucherNo', sql.Numeric(8,0), voucherNo)
        .query(`
          UPDATE l
          SET l.ClosingBalance = ISNULL(l.ClosingBalance, 0) - CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END
          FROM LedgerMaster l
          INNER JOIN VoucherEntry v ON l.Id = v.LedgerId
          WHERE v.VoucherNo = @VoucherNo;

          DELETE FROM VoucherEntry WHERE VoucherNo = @VoucherNo;
        `);

      // Insert new records with the same VoucherNo
      for (const v of vouchers) {
        if (!v.VoucherDate || !v.Mode || !v.LedgerId || !v.Amount) {
          throw new Error('Date, Mode, Ledger, and Amount are required for each row');
        }
        
        const request = new sql.Request(transaction);
        await request
          .input('VoucherNo', sql.Numeric(8,0), voucherNo)
          .input('VoucherType', sql.VarChar(10), v.VoucherType || 'General')
          .input('VoucherDate', sql.Date, v.VoucherDate)
          .input('Mode', sql.VarChar(6), v.Mode)
          .input('LedgerId', sql.Numeric(10,0), v.LedgerId)
          .input('Amount', sql.Numeric(10,2), v.Amount)
          .input('Through', sql.VarChar(30), v.Through || null)
          .input('Remark', sql.VarChar(255), v.Remark || null)
          .input('CreatedBy', sql.VarChar(255), getSignature(v.CreatedBy))
          .input('UpdatedBy', sql.VarChar(255), getSignature(v.CreatedBy))
          .query(`
            INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, CreatedBy, UpdatedBy)
            VALUES (@VoucherNo, @VoucherType, @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @CreatedBy, @UpdatedBy);

            UPDATE LedgerMaster 
            SET ClosingBalance = ISNULL(ClosingBalance, 0) + CASE WHEN @Mode = 'Debit' THEN @Amount ELSE -@Amount END
            WHERE Id = @LedgerId;
          `);
      }
      
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
  const { VoucherDate, Mode, LedgerId, Amount, Through, Remark } = req.body;

  if (!VoucherDate || !Mode || !LedgerId || !Amount) {
    return res.status(400).json({ message: 'Date, Mode, Ledger, and Amount are required' });
  }

  try {
    const pool = await connectDB();
    await pool.request()
      .input('VoucherId', sql.Numeric(8,0), id)
      .input('VoucherDate', sql.Date, VoucherDate)
      .input('Mode', sql.VarChar(6), Mode)
      .input('LedgerId', sql.Numeric(10,0), LedgerId)
      .input('Amount', sql.Numeric(10,2), Amount)
      .input('Through', sql.VarChar(30), Through || null)
      .input('Remark', sql.VarChar(255), Remark || null)
      .input('UpdatedBy', sql.VarChar(255), getSignature(req.body.UpdatedBy))
      .query(`
        UPDATE VoucherEntry 
        SET VoucherDate = @VoucherDate, Mode = @Mode, LedgerId = @LedgerId, 
            Amount = @Amount, Through = @Through, Remark = @Remark,
            UpdatedBy = @UpdatedBy
        WHERE VoucherId = @VoucherId
      `);
      
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

      const request = new sql.Request(transaction);
      await request
        .input('VoucherNo', sql.Numeric(8,0), id)
        .query(`
          UPDATE l
          SET l.ClosingBalance = ISNULL(l.ClosingBalance, 0) - CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END
          FROM LedgerMaster l
          INNER JOIN VoucherEntry v ON l.Id = v.LedgerId
          WHERE v.VoucherNo = @VoucherNo;

          DELETE FROM VoucherEntry WHERE VoucherNo = @VoucherNo;
        `);
      
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
