const { sql, connectDB } = require('../config/db');

const getSignature = (username) => {
    const name = username || 'System';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const sig = `${name} - ${dateStr} ${timeStr}`;
    return sig.substring(0, 40);
};

exports.getNextInwardNo = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT ISNULL(MAX(TRY_CAST(INWARDNO AS INT)), 0) + 1 AS NextNo 
      FROM InwardHeader
    `);
    
    let nextNo = result.recordset[0]?.NextNo;
    if (!nextNo || isNaN(nextNo)) {
      nextNo = 1;
    }
    res.status(200).json({ nextNo: String(nextNo) });
  } catch (error) {
    console.error('Error fetching next inward no:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getInwards = async (req, res) => {
  try {
    const { inwardNo, id } = req.query;
    const pool = await connectDB();
    const headerReq = pool.request();
    let headerQuery = `
      SELECT h.*, l.LedgerName 
      FROM InwardHeader h
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
    `;

    if (inwardNo) {
      headerQuery += ' WHERE h.INWARDNO = @InwardNo';
      headerReq.input('InwardNo', sql.VarChar(50), inwardNo.trim());
    } else if (id) {
      headerQuery += ' WHERE h.ID = @HeaderId';
      headerReq.input('HeaderId', sql.Numeric(8, 0), id);
    }

    headerQuery += `
      ORDER BY 
        CASE WHEN TRY_CAST(h.INWARDNO AS INT) IS NOT NULL THEN 0 ELSE 1 END,
        TRY_CAST(h.INWARDNO AS INT) DESC,
        h.INWARDNO DESC
    `;

    const headerResult = await headerReq.query(headerQuery);
    
    // Fetch InwardDetails
    const detailResult = await pool.request().query(`
      SELECT d.*, ISNULL(d.SUBCODE, '') AS SUBCODE, i.ItemName
      FROM InwardDetail d
      LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode AND ISNULL(d.SUBCODE, '') = ISNULL(i.SubCode, '')
    `);

    // Group details by InwardId
    const detailsByInwardId = detailResult.recordset.reduce((acc, detail) => {
      if (!acc[detail.INWARDID]) {
        acc[detail.INWARDID] = [];
      }
      acc[detail.INWARDID].push(detail);
      return acc;
    }, {});

    // Attach details to headers
    const inwards = headerResult.recordset.map(header => ({
      ...header,
      Details: detailsByInwardId[header.ID] || []
    }));

    res.status(200).json(inwards);
  } catch (error) {
    console.error('Error fetching inwards:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getInwardReport = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
        d.ID as RowId,
        h.INWARDNO, 
        h.INWARDDATE, 
        l.LedgerName, 
        d.ITEMCODE, 
        ISNULL(d.SUBCODE, '') AS SUBCODE,
        i.ItemName, 
        d.UNIT, 
        d.QUANTITY, 
        d.GROSSWT, 
        d.NETWT, 
        d.RATE, 
        d.AMOUNT 
      FROM InwardDetail d
      INNER JOIN InwardHeader h ON d.INWARDID = h.ID
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode AND ISNULL(d.SUBCODE, '') = ISNULL(i.SubCode, '')
      ORDER BY 
        CASE WHEN TRY_CAST(h.INWARDNO AS INT) IS NOT NULL THEN 0 ELSE 1 END,
        TRY_CAST(h.INWARDNO AS INT) DESC,
        h.INWARDNO DESC,
        d.ID ASC
    `);
    
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching inward report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addInward = async (req, res) => {
  const { Bill, INWARDNO, INWARDDATE, LEDGERID, EXPENSE, SGST, CGST, IGST, GSTPER, ROUNDOFF, TOTALAMOUNT, REMARK, CREATEDBY, Details } = req.body;

  if (!INWARDNO || !INWARDDATE || !LEDGERID || !Details || !Array.isArray(Details) || Details.length === 0) {
    return res.status(400).json({ message: 'InwardNo, Date, Ledger, and at least one detail row are required' });
  }

  let pool;
  try {
    pool = await connectDB();

    // Check if INWARDNO is duplicate
    const checkDuplicate = await pool.request()
      .input('INWARDNO', sql.VarChar(10), String(INWARDNO).trim())
      .query('SELECT TOP 1 ID FROM InwardHeader WHERE LOWER(LTRIM(RTRIM(INWARDNO))) = LOWER(@INWARDNO)');
    
    if (checkDuplicate.recordset.length > 0) {
      return res.status(400).json({ message: `Inward No "${INWARDNO}" already exists. It must be unique.` });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Insert Header
      const headerReq = new sql.Request(transaction);
      const headerRes = await headerReq
        .input('Bill', sql.Bit, Bill !== undefined ? Bill : 1)
        .input('INWARDNO', sql.VarChar(10), INWARDNO)
        .input('INWARDDATE', sql.Date, INWARDDATE)
        .input('LEDGERID', sql.Numeric(10,0), LEDGERID)
        .input('EXPENSE', sql.Numeric(10,2), EXPENSE || 0)
        .input('SGST', sql.Numeric(10,2), SGST || 0)
        .input('CGST', sql.Numeric(10,2), CGST || 0)
        .input('IGST', sql.Numeric(10,2), IGST || 0)
        .input('GSTPER', sql.Numeric(10,2), GSTPER || 0)
        .input('ROUNDOFF', sql.Numeric(10,2), ROUNDOFF || 0)
        .input('TOTALAMOUNT', sql.Numeric(12,2), TOTALAMOUNT || 0)
        .input('REMARK', sql.VarChar(100), REMARK || null)
        .input('CREATEDBY', sql.VarChar(40), getSignature(CREATEDBY))
        .input('UPDATEDBY', sql.VarChar(40), getSignature(CREATEDBY))
        .query(`
          INSERT INTO InwardHeader (Bill, INWARDNO, INWARDDATE, LEDGERID, EXPENSE, SGST, CGST, IGST, GSTPER, ROUNDOFF, TOTALAMOUNT, REMARK, CREATEDBY, UPDATEDBY)
          OUTPUT INSERTED.ID
          VALUES (@Bill, @INWARDNO, @INWARDDATE, @LEDGERID, @EXPENSE, @SGST, @CGST, @IGST, @GSTPER, @ROUNDOFF, @TOTALAMOUNT, @REMARK, @CREATEDBY, @UPDATEDBY)
        `);

      const newInwardId = headerRes.recordset[0].ID;

      // Insert Details and Update Item Stock
      for (const d of Details) {
        if (!d.ITEMCODE) {
          throw new Error('Item Code is required for all detail rows');
        }
        
        const detailReq = new sql.Request(transaction);
        const subCodeVal = (d.SUBCODE || d.SubCode || '').trim();
        await detailReq
          .input('INWARDID', sql.Numeric(8,0), newInwardId)
          .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE)
          .input('SUBCODE', sql.VarChar(50), subCodeVal)
          .input('GROSSWT', sql.Numeric(10,3), d.GROSSWT || 0)
          .input('NETWT', sql.Numeric(10,3), d.NETWT || 0)
          .input('TENPCSWT', sql.Numeric(10,3), d.TENPCSWT || null)
          .input('QUANTITY', sql.Numeric(10,2), d.QUANTITY || 0)
          .input('UNIT', sql.VarChar(10), d.UNIT || null)
          .input('RATE', sql.Numeric(10,2), d.RATE || 0)
          .input('AMOUNT', sql.Numeric(12,2), d.AMOUNT || 0)
          .query(`
            INSERT INTO InwardDetail (INWARDID, ITEMCODE, SUBCODE, GROSSWT, NETWT, TENPCSWT, QUANTITY, UNIT, RATE, AMOUNT)
            VALUES (@INWARDID, @ITEMCODE, @SUBCODE, @GROSSWT, @NETWT, @TENPCSWT, @QUANTITY, @UNIT, @RATE, @AMOUNT);

            UPDATE ItemMaster
            SET ClosingStock = ISNULL(ClosingStock, 0) + 
              CASE 
                WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @NETWT
                ELSE @QUANTITY
              END
            WHERE ItemCode = @ITEMCODE AND ISNULL(SubCode, '') = @SUBCODE;
          `);
      }

      // 5. Generate Voucher and Update Ledgers
      const purchaseLedgerRes = await new sql.Request(transaction).query("SELECT TOP 1 Id FROM LedgerMaster WHERE UPPER(LTRIM(RTRIM(LedgerName))) = 'PURCHASE'");
      let purchaseLedgerId = purchaseLedgerRes.recordset.length > 0 ? purchaseLedgerRes.recordset[0].Id : null;

      if (!purchaseLedgerId) {
        throw new Error('Purchase ledger not found. Please create a ledger named Purchase.');
      }

      const nextNoRes = await new sql.Request(transaction).query('SELECT ISNULL(MAX(VoucherNo), 0) + 1 AS NextVoucherNo FROM VoucherEntry');
      const voucherNo = nextNoRes.recordset[0].NextVoucherNo;
      const isBill = Bill !== undefined ? (Bill !== false && Bill !== 0 && Bill !== '0' ? 1 : 0) : 1;

      // Debit Purchase
      await new sql.Request(transaction)
        .input('VoucherNo', sql.Numeric(8,0), voucherNo)
        .input('VoucherDate', sql.Date, INWARDDATE)
        .input('Mode', sql.VarChar(6), 'Debit')
        .input('LedgerId', sql.Numeric(10,0), purchaseLedgerId)
        .input('Amount', sql.Numeric(10,2), TOTALAMOUNT || 0)
        .input('Through', sql.VarChar(30), 'Inward')
        .input('Remark', sql.VarChar(255), INWARDNO)
        .input('Bill', sql.Bit, isBill)
        .input('CreatedBy', sql.VarChar(255), getSignature(CREATEDBY))
        .input('UpdatedBy', sql.VarChar(255), getSignature(CREATEDBY))
        .query(`
          INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, Bill, CreatedBy, UpdatedBy)
          VALUES (@VoucherNo, 'Purchase', @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @Bill, @CreatedBy, @UpdatedBy);

          UPDATE LedgerMaster 
          SET ClosingBalance = ISNULL(ClosingBalance, 0) + @Amount
          WHERE Id = @LedgerId;
        `);

      // Credit Vendor
      await new sql.Request(transaction)
        .input('VoucherNo', sql.Numeric(8,0), voucherNo)
        .input('VoucherDate', sql.Date, INWARDDATE)
        .input('Mode', sql.VarChar(6), 'Credit')
        .input('LedgerId', sql.Numeric(10,0), LEDGERID)
        .input('Amount', sql.Numeric(10,2), TOTALAMOUNT || 0)
        .input('Through', sql.VarChar(30), 'Inward')
        .input('Remark', sql.VarChar(255), INWARDNO)
        .input('Bill', sql.Bit, isBill)
        .input('CreatedBy', sql.VarChar(255), getSignature(CREATEDBY))
        .input('UpdatedBy', sql.VarChar(255), getSignature(CREATEDBY))
        .query(`
          INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, Bill, CreatedBy, UpdatedBy)
          VALUES (@VoucherNo, 'Purchase', @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @Bill, @CreatedBy, @UpdatedBy);

          UPDATE LedgerMaster 
          SET ClosingBalance = ISNULL(ClosingBalance, 0) - @Amount
          WHERE Id = @LedgerId;
        `);

      await transaction.commit();
      res.status(201).json({ message: 'Inward added successfully', inwardId: newInwardId });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error adding inward:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

exports.updateInward = async (req, res) => {
  const { id } = req.params;
  const { Bill, INWARDNO, INWARDDATE, LEDGERID, EXPENSE, SGST, CGST, IGST, GSTPER, ROUNDOFF, TOTALAMOUNT, REMARK, UPDATEDBY, Details } = req.body;

  if (!INWARDNO || !INWARDDATE || !LEDGERID || !Details || !Array.isArray(Details) || Details.length === 0) {
    return res.status(400).json({ message: 'InwardNo, Date, Ledger, and at least one detail row are required' });
  }

  let pool;
  try {
    pool = await connectDB();

    // Check if INWARDNO is duplicate for another entry
    const checkDuplicate = await pool.request()
      .input('INWARDNO', sql.VarChar(10), String(INWARDNO).trim())
      .input('ID', sql.Numeric(8,0), id)
      .query('SELECT TOP 1 ID FROM InwardHeader WHERE LOWER(LTRIM(RTRIM(INWARDNO))) = LOWER(@INWARDNO) AND ID <> @ID');
    
    if (checkDuplicate.recordset.length > 0) {
      return res.status(400).json({ message: `Inward No "${INWARDNO}" already exists. It must be unique.` });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Reverse previous ledger and item stock updates
      const oldDataReq = new sql.Request(transaction);
      const oldHeaderRes = await oldDataReq.input('ID', sql.Numeric(8,0), id).query('SELECT LEDGERID, TOTALAMOUNT, INWARDNO FROM InwardHeader WHERE ID = @ID');
      
      if (oldHeaderRes.recordset.length > 0) {
        const oldHeader = oldHeaderRes.recordset[0];
        
        const revertVoucherReq = new sql.Request(transaction);
        await revertVoucherReq
          .input('Through', sql.VarChar(30), 'Inward')
          .input('Remark', sql.VarChar(255), oldHeader.INWARDNO)
          .query(`
            UPDATE l
            SET l.ClosingBalance = ISNULL(l.ClosingBalance, 0) - CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END
            FROM LedgerMaster l
            INNER JOIN VoucherEntry v ON l.Id = v.LedgerId
            WHERE v.Through = @Through AND v.Remark = @Remark;

            DELETE FROM VoucherEntry WHERE Through = @Through AND Remark = @Remark;
          `);

        const oldDetailsReq = new sql.Request(transaction);
        const oldDetailsRes = await oldDetailsReq.input('INWARDID', sql.Numeric(8,0), id).query('SELECT ITEMCODE, ISNULL(SUBCODE, \'\') AS SUBCODE, QUANTITY, NETWT, UNIT FROM InwardDetail WHERE INWARDID = @INWARDID');
        
        for (const oldD of oldDetailsRes.recordset) {
          const revertItemReq = new sql.Request(transaction);
          await revertItemReq
            .input('OLD_ITEMCODE', sql.VarChar(50), oldD.ITEMCODE)
            .input('OLD_SUBCODE', sql.VarChar(50), (oldD.SUBCODE || '').trim())
            .input('OLD_QUANTITY', sql.Numeric(10,2), oldD.QUANTITY)
            .input('OLD_NETWT', sql.Numeric(10,3), oldD.NETWT || 0)
            .input('OLD_UNIT', sql.VarChar(10), oldD.UNIT || '')
            .query(`
              UPDATE ItemMaster
              SET ClosingStock = ISNULL(ClosingStock, 0) - 
                CASE 
                  WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @OLD_NETWT
                  ELSE @OLD_QUANTITY
                END
              WHERE ItemCode = @OLD_ITEMCODE AND ISNULL(SubCode, '') = @OLD_SUBCODE;
            `);
        }
      }

      // 2. Delete old details
      const deleteDetailsReq = new sql.Request(transaction);
      await deleteDetailsReq.input('INWARDID', sql.Numeric(8,0), id).query('DELETE FROM InwardDetail WHERE INWARDID = @INWARDID');

      // 3. Update Header
      const headerReq = new sql.Request(transaction);
      await headerReq
        .input('ID', sql.Numeric(8,0), id)
        .input('Bill', sql.Bit, Bill !== undefined ? Bill : 1)
        .input('INWARDNO', sql.VarChar(10), INWARDNO)
        .input('INWARDDATE', sql.Date, INWARDDATE)
        .input('LEDGERID', sql.Numeric(10,0), LEDGERID)
        .input('EXPENSE', sql.Numeric(10,2), EXPENSE || 0)
        .input('SGST', sql.Numeric(10,2), SGST || 0)
        .input('CGST', sql.Numeric(10,2), CGST || 0)
        .input('IGST', sql.Numeric(10,2), IGST || 0)
        .input('GSTPER', sql.Numeric(10,2), GSTPER || 0)
        .input('ROUNDOFF', sql.Numeric(10,2), ROUNDOFF || 0)
        .input('TOTALAMOUNT', sql.Numeric(12,2), TOTALAMOUNT || 0)
        .input('REMARK', sql.VarChar(100), REMARK || null)
        .input('UPDATEDBY', sql.VarChar(40), getSignature(UPDATEDBY))
        .query(`
          UPDATE InwardHeader 
          SET Bill = @Bill, INWARDNO = @INWARDNO, INWARDDATE = @INWARDDATE, LEDGERID = @LEDGERID, 
              EXPENSE = @EXPENSE, SGST = @SGST, CGST = @CGST, IGST = @IGST, GSTPER = @GSTPER, ROUNDOFF = @ROUNDOFF, 
              TOTALAMOUNT = @TOTALAMOUNT, REMARK = @REMARK, UPDATEDBY = @UPDATEDBY
          WHERE ID = @ID
        `);

      // 4. Insert New Details and Update Item Stock
      for (const d of Details) {
        if (!d.ITEMCODE) {
          throw new Error('Item Code is required for all detail rows');
        }
        
        const detailReq = new sql.Request(transaction);
        const subCodeVal = (d.SUBCODE || d.SubCode || '').trim();
        await detailReq
          .input('INWARDID', sql.Numeric(8,0), id)
          .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE)
          .input('SUBCODE', sql.VarChar(50), subCodeVal)
          .input('GROSSWT', sql.Numeric(10,3), d.GROSSWT || 0)
          .input('NETWT', sql.Numeric(10,3), d.NETWT || 0)
          .input('TENPCSWT', sql.Numeric(10,3), d.TENPCSWT || null)
          .input('QUANTITY', sql.Numeric(10,2), d.QUANTITY || 0)
          .input('UNIT', sql.VarChar(10), d.UNIT || null)
          .input('RATE', sql.Numeric(10,2), d.RATE || 0)
          .input('AMOUNT', sql.Numeric(12,2), d.AMOUNT || 0)
          .query(`
            INSERT INTO InwardDetail (INWARDID, ITEMCODE, SUBCODE, GROSSWT, NETWT, TENPCSWT, QUANTITY, UNIT, RATE, AMOUNT)
            VALUES (@INWARDID, @ITEMCODE, @SUBCODE, @GROSSWT, @NETWT, @TENPCSWT, @QUANTITY, @UNIT, @RATE, @AMOUNT);

            UPDATE ItemMaster
            SET ClosingStock = ISNULL(ClosingStock, 0) + 
              CASE 
                WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @NETWT
                ELSE @QUANTITY
              END
            WHERE ItemCode = @ITEMCODE AND ISNULL(SubCode, '') = @SUBCODE;
          `);
          `);
      }

      // 5. Generate Voucher and Update Ledgers
      const purchaseLedgerRes = await new sql.Request(transaction).query("SELECT TOP 1 Id FROM LedgerMaster WHERE UPPER(LTRIM(RTRIM(LedgerName))) = 'PURCHASE'");
      let purchaseLedgerId = purchaseLedgerRes.recordset.length > 0 ? purchaseLedgerRes.recordset[0].Id : null;

      if (!purchaseLedgerId) {
        throw new Error('Purchase ledger not found. Please create a ledger named Purchase.');
      }

      const nextNoRes = await new sql.Request(transaction).query('SELECT ISNULL(MAX(VoucherNo), 0) + 1 AS NextVoucherNo FROM VoucherEntry');
      const voucherNo = nextNoRes.recordset[0].NextVoucherNo;
      const isBill = Bill !== undefined ? (Bill !== false && Bill !== 0 && Bill !== '0' ? 1 : 0) : 1;

      // Debit Purchase
      await new sql.Request(transaction)
        .input('VoucherNo', sql.Numeric(8,0), voucherNo)
        .input('VoucherDate', sql.Date, INWARDDATE)
        .input('Mode', sql.VarChar(6), 'Debit')
        .input('LedgerId', sql.Numeric(10,0), purchaseLedgerId)
        .input('Amount', sql.Numeric(10,2), TOTALAMOUNT || 0)
        .input('Through', sql.VarChar(30), 'Inward')
        .input('Remark', sql.VarChar(255), INWARDNO)
        .input('Bill', sql.Bit, isBill)
        .input('CreatedBy', sql.VarChar(255), getSignature(UPDATEDBY))
        .input('UpdatedBy', sql.VarChar(255), getSignature(UPDATEDBY))
        .query(`
          INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, Bill, CreatedBy, UpdatedBy)
          VALUES (@VoucherNo, 'Purchase', @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @Bill, @CreatedBy, @UpdatedBy);

          UPDATE LedgerMaster 
          SET ClosingBalance = ISNULL(ClosingBalance, 0) + @Amount
          WHERE Id = @LedgerId;
        `);

      // Credit Vendor
      await new sql.Request(transaction)
        .input('VoucherNo', sql.Numeric(8,0), voucherNo)
        .input('VoucherDate', sql.Date, INWARDDATE)
        .input('Mode', sql.VarChar(6), 'Credit')
        .input('LedgerId', sql.Numeric(10,0), LEDGERID)
        .input('Amount', sql.Numeric(10,2), TOTALAMOUNT || 0)
        .input('Through', sql.VarChar(30), 'Inward')
        .input('Remark', sql.VarChar(255), INWARDNO)
        .input('Bill', sql.Bit, isBill)
        .input('CreatedBy', sql.VarChar(255), getSignature(UPDATEDBY))
        .input('UpdatedBy', sql.VarChar(255), getSignature(UPDATEDBY))
        .query(`
          INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, Bill, CreatedBy, UpdatedBy)
          VALUES (@VoucherNo, 'Purchase', @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @Bill, @CreatedBy, @UpdatedBy);

          UPDATE LedgerMaster 
          SET ClosingBalance = ISNULL(ClosingBalance, 0) - @Amount
          WHERE Id = @LedgerId;
        `);

      await transaction.commit();
      res.status(200).json({ message: 'Inward updated successfully' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error updating inward:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

exports.deleteInward = async (req, res) => {
  const { id } = req.params;

  let pool;
  try {
    pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Reverse previous ledger and item stock updates
      const oldDataReq = new sql.Request(transaction);
      const oldHeaderRes = await oldDataReq.input('ID', sql.Numeric(8,0), id).query('SELECT LEDGERID, TOTALAMOUNT, INWARDNO FROM InwardHeader WHERE ID = @ID');
      
      if (oldHeaderRes.recordset.length > 0) {
        const oldHeader = oldHeaderRes.recordset[0];
        
        const revertVoucherReq = new sql.Request(transaction);
        await revertVoucherReq
          .input('Through', sql.VarChar(30), 'Inward')
          .input('Remark', sql.VarChar(255), oldHeader.INWARDNO)
          .query(`
            UPDATE l
            SET l.ClosingBalance = ISNULL(l.ClosingBalance, 0) - CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END
            FROM LedgerMaster l
            INNER JOIN VoucherEntry v ON l.Id = v.LedgerId
            WHERE v.Through = @Through AND v.Remark = @Remark;

            DELETE FROM VoucherEntry WHERE Through = @Through AND Remark = @Remark;
          `);

        const oldDetailsReq = new sql.Request(transaction);
        const oldDetailsRes = await oldDetailsReq.input('INWARDID', sql.Numeric(8,0), id).query('SELECT ITEMCODE, ISNULL(SUBCODE, \'\') AS SUBCODE, QUANTITY, NETWT, UNIT FROM InwardDetail WHERE INWARDID = @INWARDID');
        
        for (const oldD of oldDetailsRes.recordset) {
          const revertItemReq = new sql.Request(transaction);
          await revertItemReq
            .input('OLD_ITEMCODE', sql.VarChar(50), oldD.ITEMCODE)
            .input('OLD_SUBCODE', sql.VarChar(50), (oldD.SUBCODE || '').trim())
            .input('OLD_QUANTITY', sql.Numeric(10,2), oldD.QUANTITY)
            .input('OLD_NETWT', sql.Numeric(10,3), oldD.NETWT || 0)
            .input('OLD_UNIT', sql.VarChar(10), oldD.UNIT || '')
            .query(`
              UPDATE ItemMaster
              SET ClosingStock = ISNULL(ClosingStock, 0) - 
                CASE 
                  WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @OLD_NETWT
                  ELSE @OLD_QUANTITY
                END
              WHERE ItemCode = @OLD_ITEMCODE AND ISNULL(SubCode, '') = @OLD_SUBCODE;
            `);
        }
      }

      // 2. Delete Details and Header
      const deleteReq = new sql.Request(transaction);
      await deleteReq
        .input('ID', sql.Numeric(8,0), id)
        .query(`
          DELETE FROM InwardDetail WHERE INWARDID = @ID;
          DELETE FROM InwardHeader WHERE ID = @ID;
        `);

      await transaction.commit();
      res.status(200).json({ message: 'Inward deleted successfully' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error deleting inward:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
