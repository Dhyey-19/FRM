const { sql, connectDB } = require('../config/db');

const getSignature = (username) => {
    const name = username || 'System';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const sig = `${name} - ${dateStr} ${timeStr}`;
    return sig.substring(0, 40);
};

exports.getNextOutwardNo = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT ISNULL(MAX(TRY_CAST(OUTWARDNO AS INT)), 0) + 1 AS NextNo 
      FROM OutwardHeader
    `);
    
    let nextNo = result.recordset[0]?.NextNo;
    if (!nextNo || isNaN(nextNo)) {
      nextNo = 1;
    }
    res.status(200).json({ nextNo: String(nextNo) });
  } catch (error) {
    console.error('Error fetching next outward no:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getOutwards = async (req, res) => {
  try {
    const pool = await connectDB();
    // Fetch all OutwardHeaders with LedgerName
    const headerResult = await pool.request().query(`
      SELECT h.*, l.LedgerName 
      FROM OutwardHeader h
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      ORDER BY 
        CASE WHEN TRY_CAST(h.OUTWARDNO AS INT) IS NOT NULL THEN 0 ELSE 1 END,
        TRY_CAST(h.OUTWARDNO AS INT) DESC,
        h.OUTWARDNO DESC
    `);
    
    // Fetch all OutwardDetails
    const detailResult = await pool.request().query(`
      SELECT d.*, i.ItemName
      FROM OutwardDetail d
      LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode
    `);

    // Group details by OutwardId
    const detailsByOutwardId = detailResult.recordset.reduce((acc, detail) => {
      if (!acc[detail.OUTWARDID]) {
        acc[detail.OUTWARDID] = [];
      }
      acc[detail.OUTWARDID].push(detail);
      return acc;
    }, {});

    // Attach details to headers
    const outwards = headerResult.recordset.map(header => ({
      ...header,
      Details: detailsByOutwardId[header.ID] || []
    }));

    res.status(200).json(outwards);
  } catch (error) {
    console.error('Error fetching outwards:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getOutwardReport = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
        d.ID as RowId,
        h.OUTWARDNO, 
        h.OUTWARDDATE, 
        l.LedgerName, 
        d.ITEMCODE, 
        i.ItemName, 
        d.UNIT, 
        d.QUANTITY, 
        d.GROSSWT, 
        d.NETWT, 
        d.RATE, 
        d.DISCOUNT,
        d.AMOUNT 
      FROM OutwardDetail d
      INNER JOIN OutwardHeader h ON d.OUTWARDID = h.ID
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode
      ORDER BY 
        CASE WHEN TRY_CAST(h.OUTWARDNO AS INT) IS NOT NULL THEN 0 ELSE 1 END,
        TRY_CAST(h.OUTWARDNO AS INT) DESC,
        h.OUTWARDNO DESC,
        d.ID ASC
    `);
    
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching outward report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addOutward = async (req, res) => {
  const { Bill, OUTWARDNO, OUTWARDDATE, LEDGERID, EXPENSE, CDPER, CDAMOUNT, SGST, CGST, IGST, GSTPER, ROUNDOFF, TOTALAMOUNT, REMARK, CREATEDBY, Details } = req.body;

  if (!OUTWARDNO || !OUTWARDDATE || !LEDGERID || !Details || !Array.isArray(Details) || Details.length === 0) {
    return res.status(400).json({ message: 'OutwardNo, Date, Ledger, and at least one detail row are required' });
  }

  let pool;
  try {
    pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Insert Header
      const headerReq = new sql.Request(transaction);
      const headerRes = await headerReq
        .input('Bill', sql.Bit, Bill !== false ? 1 : 0)
        .input('OUTWARDNO', sql.VarChar(10), OUTWARDNO)
        .input('OUTWARDDATE', sql.Date, OUTWARDDATE)
        .input('LEDGERID', sql.Numeric(10,0), LEDGERID)
        .input('EXPENSE', sql.Numeric(10,2), EXPENSE || 0)
        .input('CDPER', sql.Numeric(5,2), CDPER || 0)
        .input('CDAMOUNT', sql.Numeric(12,2), CDAMOUNT || 0)
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
          INSERT INTO OutwardHeader (Bill, OUTWARDNO, OUTWARDDATE, LEDGERID, EXPENSE, CDPER, CDAMOUNT, SGST, CGST, IGST, GSTPER, ROUNDOFF, TOTALAMOUNT, REMARK, CREATEDBY, UPDATEDBY)
          OUTPUT INSERTED.ID
          VALUES (@Bill, @OUTWARDNO, @OUTWARDDATE, @LEDGERID, @EXPENSE, @CDPER, @CDAMOUNT, @SGST, @CGST, @IGST, @GSTPER, @ROUNDOFF, @TOTALAMOUNT, @REMARK, @CREATEDBY, @UPDATEDBY)
        `);

      const newOutwardId = headerRes.recordset[0].ID;

      // Insert Details and Update Item Stock
      for (const d of Details) {
        if (!d.ITEMCODE) {
          throw new Error('Item Code is required for all detail rows');
        }
        
        const detailReq = new sql.Request(transaction);
        await detailReq
          .input('OUTWARDID', sql.Numeric(8,0), newOutwardId)
          .input('ITEMCODE', sql.VarChar(10), d.ITEMCODE)
          .input('GROSSWT', sql.Numeric(10,3), d.GROSSWT || 0)
          .input('NETWT', sql.Numeric(10,3), d.NETWT || 0)
          .input('TENPCSWT', sql.Numeric(10,3), d.TENPCSWT || null)
          .input('QUANTITY', sql.Numeric(10,2), d.QUANTITY || 0)
          .input('UNIT', sql.VarChar(10), d.UNIT || null)
          .input('RATE', sql.Numeric(10,2), d.RATE || 0)
          .input('DISCOUNT', sql.Numeric(5,2), d.DISCOUNT || 0)
          .input('AMOUNT', sql.Numeric(12,2), d.AMOUNT || 0)
          .query(`
            INSERT INTO OutwardDetail (OUTWARDID, ITEMCODE, GROSSWT, NETWT, TENPCSWT, QUANTITY, UNIT, RATE, DISCOUNT, AMOUNT)
            VALUES (@OUTWARDID, @ITEMCODE, @GROSSWT, @NETWT, @TENPCSWT, @QUANTITY, @UNIT, @RATE, @DISCOUNT, @AMOUNT);

            UPDATE ItemMaster
            SET ClosingStock = ISNULL(ClosingStock, 0) - 
              CASE 
                WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @NETWT
                ELSE @QUANTITY
              END
            WHERE ItemCode = @ITEMCODE;
          `);
      }

      // 5. Generate Voucher and Update Ledgers
      const salesLedgerRes = await new sql.Request(transaction).query("SELECT TOP 1 Id FROM LedgerMaster WHERE UPPER(LTRIM(RTRIM(LedgerName))) = 'SALES'");
      let salesLedgerId = salesLedgerRes.recordset.length > 0 ? salesLedgerRes.recordset[0].Id : null;

      if (!salesLedgerId) {
        throw new Error('Sales ledger not found. Please create a ledger named Sales.');
      }

      const nextNoRes = await new sql.Request(transaction).query('SELECT ISNULL(MAX(VoucherNo), 0) + 1 AS NextVoucherNo FROM VoucherEntry');
      const voucherNo = nextNoRes.recordset[0].NextVoucherNo;
      const isBill = Bill !== undefined ? (Bill !== false && Bill !== 0 && Bill !== '0' ? 1 : 0) : 1;

      // Debit Party
      await new sql.Request(transaction)
        .input('VoucherNo', sql.Numeric(8,0), voucherNo)
        .input('VoucherDate', sql.Date, OUTWARDDATE)
        .input('Mode', sql.VarChar(6), 'Debit')
        .input('LedgerId', sql.Numeric(10,0), LEDGERID)
        .input('Amount', sql.Numeric(10,2), TOTALAMOUNT || 0)
        .input('Through', sql.VarChar(30), 'Outward')
        .input('Remark', sql.VarChar(255), OUTWARDNO)
        .input('Bill', sql.Bit, isBill)
        .input('CreatedBy', sql.VarChar(255), getSignature(CREATEDBY))
        .input('UpdatedBy', sql.VarChar(255), getSignature(CREATEDBY))
        .query(`
          INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, Bill, CreatedBy, UpdatedBy)
          VALUES (@VoucherNo, 'Sales', @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @Bill, @CreatedBy, @UpdatedBy);

          UPDATE LedgerMaster 
          SET ClosingBalance = ISNULL(ClosingBalance, 0) + @Amount
          WHERE Id = @LedgerId;
        `);

      // Credit Sales
      await new sql.Request(transaction)
        .input('VoucherNo', sql.Numeric(8,0), voucherNo)
        .input('VoucherDate', sql.Date, OUTWARDDATE)
        .input('Mode', sql.VarChar(6), 'Credit')
        .input('LedgerId', sql.Numeric(10,0), salesLedgerId)
        .input('Amount', sql.Numeric(10,2), TOTALAMOUNT || 0)
        .input('Through', sql.VarChar(30), 'Outward')
        .input('Remark', sql.VarChar(255), OUTWARDNO)
        .input('Bill', sql.Bit, isBill)
        .input('CreatedBy', sql.VarChar(255), getSignature(CREATEDBY))
        .input('UpdatedBy', sql.VarChar(255), getSignature(CREATEDBY))
        .query(`
          INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, Bill, CreatedBy, UpdatedBy)
          VALUES (@VoucherNo, 'Sales', @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @Bill, @CreatedBy, @UpdatedBy);

          UPDATE LedgerMaster 
          SET ClosingBalance = ISNULL(ClosingBalance, 0) - @Amount
          WHERE Id = @LedgerId;
        `);

      await transaction.commit();
      res.status(201).json({ message: 'Outward added successfully', outwardId: newOutwardId });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error adding outward:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

exports.updateOutward = async (req, res) => {
  const { id } = req.params;
  const { Bill, OUTWARDNO, OUTWARDDATE, LEDGERID, EXPENSE, CDPER, CDAMOUNT, SGST, CGST, IGST, GSTPER, ROUNDOFF, TOTALAMOUNT, REMARK, UPDATEDBY, Details } = req.body;

  if (!OUTWARDNO || !OUTWARDDATE || !LEDGERID || !Details || !Array.isArray(Details) || Details.length === 0) {
    return res.status(400).json({ message: 'OutwardNo, Date, Ledger, and at least one detail row are required' });
  }

  let pool;
  try {
    pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Reverse previous ledger and item stock updates
      const oldDataReq = new sql.Request(transaction);
      const oldHeaderRes = await oldDataReq.input('ID', sql.Numeric(8,0), id).query('SELECT LEDGERID, TOTALAMOUNT, OUTWARDNO FROM OutwardHeader WHERE ID = @ID');
      
      if (oldHeaderRes.recordset.length > 0) {
        const oldHeader = oldHeaderRes.recordset[0];
        
        const revertVoucherReq = new sql.Request(transaction);
        await revertVoucherReq
          .input('Through', sql.VarChar(30), 'Outward')
          .input('Remark', sql.VarChar(255), oldHeader.OUTWARDNO)
          .query(`
            UPDATE l
            SET l.ClosingBalance = ISNULL(l.ClosingBalance, 0) - CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END
            FROM LedgerMaster l
            INNER JOIN VoucherEntry v ON l.Id = v.LedgerId
            WHERE v.Through = @Through AND v.Remark = @Remark;

            DELETE FROM VoucherEntry WHERE Through = @Through AND Remark = @Remark;
          `);

        const oldDetailsReq = new sql.Request(transaction);
        const oldDetailsRes = await oldDetailsReq.input('OUTWARDID', sql.Numeric(8,0), id).query('SELECT ITEMCODE, QUANTITY, NETWT, UNIT FROM OutwardDetail WHERE OUTWARDID = @OUTWARDID');
        
        for (const oldD of oldDetailsRes.recordset) {
          const revertItemReq = new sql.Request(transaction);
          await revertItemReq
            .input('OLD_ITEMCODE', sql.VarChar(10), oldD.ITEMCODE)
            .input('OLD_QUANTITY', sql.Numeric(10,2), oldD.QUANTITY)
            .input('OLD_NETWT', sql.Numeric(10,3), oldD.NETWT || 0)
            .input('OLD_UNIT', sql.VarChar(10), oldD.UNIT || '')
            .query(`
              UPDATE ItemMaster
              SET ClosingStock = ISNULL(ClosingStock, 0) + 
                CASE 
                  WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @OLD_NETWT
                  ELSE @OLD_QUANTITY
                END
              WHERE ItemCode = @OLD_ITEMCODE;
            `);
        }
      }

      // 2. Delete old details
      const deleteDetailsReq = new sql.Request(transaction);
      await deleteDetailsReq.input('OUTWARDID', sql.Numeric(8,0), id).query('DELETE FROM OutwardDetail WHERE OUTWARDID = @OUTWARDID');

      // 3. Update Header
      const headerReq = new sql.Request(transaction);
      await headerReq
        .input('ID', sql.Numeric(8,0), id)
        .input('Bill', sql.Bit, Bill !== false ? 1 : 0)
        .input('OUTWARDNO', sql.VarChar(10), OUTWARDNO)
        .input('OUTWARDDATE', sql.Date, OUTWARDDATE)
        .input('LEDGERID', sql.Numeric(10,0), LEDGERID)
        .input('EXPENSE', sql.Numeric(10,2), EXPENSE || 0)
        .input('CDPER', sql.Numeric(5,2), CDPER || 0)
        .input('CDAMOUNT', sql.Numeric(12,2), CDAMOUNT || 0)
        .input('SGST', sql.Numeric(10,2), SGST || 0)
        .input('CGST', sql.Numeric(10,2), CGST || 0)
        .input('IGST', sql.Numeric(10,2), IGST || 0)
        .input('GSTPER', sql.Numeric(10,2), GSTPER || 0)
        .input('ROUNDOFF', sql.Numeric(10,2), ROUNDOFF || 0)
        .input('TOTALAMOUNT', sql.Numeric(12,2), TOTALAMOUNT || 0)
        .input('REMARK', sql.VarChar(100), REMARK || null)
        .input('UPDATEDBY', sql.VarChar(40), getSignature(UPDATEDBY))
        .query(`
          UPDATE OutwardHeader 
          SET Bill = @Bill, OUTWARDNO = @OUTWARDNO, OUTWARDDATE = @OUTWARDDATE, LEDGERID = @LEDGERID, 
              EXPENSE = @EXPENSE, CDPER = @CDPER, CDAMOUNT = @CDAMOUNT, SGST = @SGST, CGST = @CGST, IGST = @IGST, 
              GSTPER = @GSTPER, ROUNDOFF = @ROUNDOFF, TOTALAMOUNT = @TOTALAMOUNT, REMARK = @REMARK, UPDATEDBY = @UPDATEDBY
          WHERE ID = @ID
        `);

      // 4. Insert New Details and Update Item Stock
      for (const d of Details) {
        if (!d.ITEMCODE) {
          throw new Error('Item Code is required for all detail rows');
        }
        
        const detailReq = new sql.Request(transaction);
        await detailReq
          .input('OUTWARDID', sql.Numeric(8,0), id)
          .input('ITEMCODE', sql.VarChar(10), d.ITEMCODE)
          .input('GROSSWT', sql.Numeric(10,3), d.GROSSWT || 0)
          .input('NETWT', sql.Numeric(10,3), d.NETWT || 0)
          .input('TENPCSWT', sql.Numeric(10,3), d.TENPCSWT || null)
          .input('QUANTITY', sql.Numeric(10,2), d.QUANTITY || 0)
          .input('UNIT', sql.VarChar(10), d.UNIT || null)
          .input('RATE', sql.Numeric(10,2), d.RATE || 0)
          .input('DISCOUNT', sql.Numeric(5,2), d.DISCOUNT || 0)
          .input('AMOUNT', sql.Numeric(12,2), d.AMOUNT || 0)
          .query(`
            INSERT INTO OutwardDetail (OUTWARDID, ITEMCODE, GROSSWT, NETWT, TENPCSWT, QUANTITY, UNIT, RATE, DISCOUNT, AMOUNT)
            VALUES (@OUTWARDID, @ITEMCODE, @GROSSWT, @NETWT, @TENPCSWT, @QUANTITY, @UNIT, @RATE, @DISCOUNT, @AMOUNT);

            UPDATE ItemMaster
            SET ClosingStock = ISNULL(ClosingStock, 0) - 
              CASE 
                WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @NETWT
                ELSE @QUANTITY
              END
            WHERE ItemCode = @ITEMCODE;
          `);
      }

      // 5. Generate Voucher and Update Ledgers
      const salesLedgerRes = await new sql.Request(transaction).query("SELECT TOP 1 Id FROM LedgerMaster WHERE UPPER(LTRIM(RTRIM(LedgerName))) = 'SALES'");
      let salesLedgerId = salesLedgerRes.recordset.length > 0 ? salesLedgerRes.recordset[0].Id : null;

      if (!salesLedgerId) {
        throw new Error('Sales ledger not found. Please create a ledger named Sales.');
      }

      const nextNoRes = await new sql.Request(transaction).query('SELECT ISNULL(MAX(VoucherNo), 0) + 1 AS NextVoucherNo FROM VoucherEntry');
      const voucherNo = nextNoRes.recordset[0].NextVoucherNo;
      const isBill = Bill !== undefined ? (Bill !== false && Bill !== 0 && Bill !== '0' ? 1 : 0) : 1;

      // Debit Party
      await new sql.Request(transaction)
        .input('VoucherNo', sql.Numeric(8,0), voucherNo)
        .input('VoucherDate', sql.Date, OUTWARDDATE)
        .input('Mode', sql.VarChar(6), 'Debit')
        .input('LedgerId', sql.Numeric(10,0), LEDGERID)
        .input('Amount', sql.Numeric(10,2), TOTALAMOUNT || 0)
        .input('Through', sql.VarChar(30), 'Outward')
        .input('Remark', sql.VarChar(255), OUTWARDNO)
        .input('Bill', sql.Bit, isBill)
        .input('CreatedBy', sql.VarChar(255), getSignature(UPDATEDBY))
        .input('UpdatedBy', sql.VarChar(255), getSignature(UPDATEDBY))
        .query(`
          INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, Bill, CreatedBy, UpdatedBy)
          VALUES (@VoucherNo, 'Sales', @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @Bill, @CreatedBy, @UpdatedBy);

          UPDATE LedgerMaster 
          SET ClosingBalance = ISNULL(ClosingBalance, 0) + @Amount
          WHERE Id = @LedgerId;
        `);

      // Credit Sales
      await new sql.Request(transaction)
        .input('VoucherNo', sql.Numeric(8,0), voucherNo)
        .input('VoucherDate', sql.Date, OUTWARDDATE)
        .input('Mode', sql.VarChar(6), 'Credit')
        .input('LedgerId', sql.Numeric(10,0), salesLedgerId)
        .input('Amount', sql.Numeric(10,2), TOTALAMOUNT || 0)
        .input('Through', sql.VarChar(30), 'Outward')
        .input('Remark', sql.VarChar(255), OUTWARDNO)
        .input('Bill', sql.Bit, isBill)
        .input('CreatedBy', sql.VarChar(255), getSignature(UPDATEDBY))
        .input('UpdatedBy', sql.VarChar(255), getSignature(UPDATEDBY))
        .query(`
          INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, Bill, CreatedBy, UpdatedBy)
          VALUES (@VoucherNo, 'Sales', @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @Bill, @CreatedBy, @UpdatedBy);

          UPDATE LedgerMaster 
          SET ClosingBalance = ISNULL(ClosingBalance, 0) - @Amount
          WHERE Id = @LedgerId;
        `);

      await transaction.commit();
      res.status(200).json({ message: 'Outward updated successfully' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error updating outward:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

exports.deleteOutward = async (req, res) => {
  const { id } = req.params;

  let pool;
  try {
    pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Reverse previous ledger and item stock updates
      const oldDataReq = new sql.Request(transaction);
      const oldHeaderRes = await oldDataReq.input('ID', sql.Numeric(8,0), id).query('SELECT LEDGERID, TOTALAMOUNT, OUTWARDNO FROM OutwardHeader WHERE ID = @ID');
      
      if (oldHeaderRes.recordset.length > 0) {
        const oldHeader = oldHeaderRes.recordset[0];
        
        const revertVoucherReq = new sql.Request(transaction);
        await revertVoucherReq
          .input('Through', sql.VarChar(30), 'Outward')
          .input('Remark', sql.VarChar(255), oldHeader.OUTWARDNO)
          .query(`
            UPDATE l
            SET l.ClosingBalance = ISNULL(l.ClosingBalance, 0) - CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END
            FROM LedgerMaster l
            INNER JOIN VoucherEntry v ON l.Id = v.LedgerId
            WHERE v.Through = @Through AND v.Remark = @Remark;

            DELETE FROM VoucherEntry WHERE Through = @Through AND Remark = @Remark;
          `);

        const oldDetailsReq = new sql.Request(transaction);
        const oldDetailsRes = await oldDetailsReq.input('OUTWARDID', sql.Numeric(8,0), id).query('SELECT ITEMCODE, QUANTITY, NETWT, UNIT FROM OutwardDetail WHERE OUTWARDID = @OUTWARDID');
        
        for (const oldD of oldDetailsRes.recordset) {
          const revertItemReq = new sql.Request(transaction);
          await revertItemReq
            .input('OLD_ITEMCODE', sql.VarChar(10), oldD.ITEMCODE)
            .input('OLD_QUANTITY', sql.Numeric(10,2), oldD.QUANTITY)
            .input('OLD_NETWT', sql.Numeric(10,3), oldD.NETWT || 0)
            .input('OLD_UNIT', sql.VarChar(10), oldD.UNIT || '')
            .query(`
              UPDATE ItemMaster
              SET ClosingStock = ISNULL(ClosingStock, 0) + 
                CASE 
                  WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @OLD_NETWT
                  ELSE @OLD_QUANTITY
                END
              WHERE ItemCode = @OLD_ITEMCODE;
            `);
        }
      }

      // 2. Delete Details and Header
      const deleteReq = new sql.Request(transaction);
      await deleteReq
        .input('ID', sql.Numeric(8,0), id)
        .query(`
          DELETE FROM OutwardDetail WHERE OUTWARDID = @ID;
          DELETE FROM OutwardHeader WHERE ID = @ID;
        `);

      await transaction.commit();
      res.status(200).json({ message: 'Outward deleted successfully' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error deleting outward:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
