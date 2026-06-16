const { sql, connectDB } = require('../config/db');

const getSignature = (username) => {
    const name = username || 'System';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const sig = `${name} - ${dateStr} ${timeStr}`;
    return sig.substring(0, 40);
};

exports.getJobworkIns = async (req, res) => {
  try {
    const pool = await connectDB();
    
    // Fetch all headers with LedgerName
    const headerResult = await pool.request().query(`
      SELECT h.*, l.LedgerName 
      FROM JobworkInHeader h
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      ORDER BY h.JWINWARDDATE DESC, h.JWINWARDNO DESC
    `);
    
    // Fetch all details with ItemNames
    const detailResult = await pool.request().query(`
      SELECT d.*, 
             ii.ItemName as InItemName,
             oi.ItemName as OutItemName,
             si.ItemName as ScrapItemName
      FROM JobworkInDetail d
      LEFT JOIN ItemMaster ii ON d.INITEMCODE = ii.ItemCode
      LEFT JOIN ItemMaster oi ON d.OUTITEMCODE = oi.ItemCode
      LEFT JOIN ItemMaster si ON d.SCRAPITEMCODE = si.ItemCode
    `);

    // Group details by JWINWARDID
    const detailsByHeaderId = detailResult.recordset.reduce((acc, detail) => {
      const headerId = detail.JWINWARDID;
      if (!acc[headerId]) {
        acc[headerId] = [];
      }
      acc[headerId].push(detail);
      return acc;
    }, {});

    // Attach details to headers
    const jobworkIns = headerResult.recordset.map(header => ({
      ...header,
      Details: detailsByHeaderId[header.ID] || []
    }));

    res.status(200).json(jobworkIns);
  } catch (error) {
    console.error('Error fetching jobwork ins:', error);
    res.status(500).json({ message: 'Server error fetching jobwork ins' });
  }
};

exports.addJobworkIn = async (req, res) => {
  const { JWINWARDNO, JWINWARDDATE, LEDGERID, JWOUTWARDNO, TOTALAMOUNT, REMARK, CREATEDBY, Details } = req.body;

  if (!JWINWARDNO || !JWINWARDDATE || !LEDGERID || !Details || !Array.isArray(Details) || Details.length === 0) {
    return res.status(400).json({ message: 'JWInwardNo, Date, Ledger, and at least one detail row are required' });
  }

  let pool;
  let transaction;
  try {
    pool = await connectDB();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Insert Header
      const headerReq = new sql.Request(transaction);
      const headerRes = await headerReq
        .input('JWINWARDNO', sql.VarChar(10), JWINWARDNO)
        .input('JWINWARDDATE', sql.Date, JWINWARDDATE)
        .input('LEDGERID', sql.Numeric(10,0), LEDGERID)
        .input('JWOUTWARDNO', sql.VarChar(10), JWOUTWARDNO || null)
        .input('TOTALAMOUNT', sql.Numeric(12,2), TOTALAMOUNT || 0)
        .input('REMARK', sql.VarChar(100), REMARK || null)
        .input('CREATEDBY', sql.VarChar(40), getSignature(CREATEDBY))
        .input('UPDATEDBY', sql.VarChar(40), getSignature(CREATEDBY))
        .query(`
          INSERT INTO JobworkInHeader (JWINWARDNO, JWINWARDDATE, LEDGERID, JWOUTWARDNO, TOTALAMOUNT, REMARK, CREATEDBY, UPDATEDBY)
          OUTPUT INSERTED.ID
          VALUES (@JWINWARDNO, @JWINWARDDATE, @LEDGERID, @JWOUTWARDNO, @TOTALAMOUNT, @REMARK, @CREATEDBY, @UPDATEDBY)
        `);

      const newJwInwardId = headerRes.recordset[0].ID;

      // 2. Insert Details and Update Item Stocks
      for (const d of Details) {
        if (!d.INITEMCODE || !d.OUTITEMCODE) {
          throw new Error('Incoming Item and Outgoing Item are required for all detail rows');
        }
        
        const detailReq = new sql.Request(transaction);
        await detailReq
          .input('JWINWARDID', sql.Numeric(8,0), newJwInwardId)
          .input('OUTITEMCODE', sql.VarChar(10), d.OUTITEMCODE)
          .input('INITEMCODE', sql.VarChar(10), d.INITEMCODE)
          .input('GROSSWT', sql.Numeric(10,3), d.GROSSWT || 0)
          .input('NETWT', sql.Numeric(10,3), d.NETWT || 0)
          .input('SCRAPITEMCODE', sql.VarChar(10), d.SCRAPITEMCODE || null)
          .input('SCRAPPCS', sql.Numeric(5,2), d.SCRAPPCS || 0)
          .input('SCRAPWT', sql.Numeric(10,3), d.SCRAPWT || 0)
          .input('QUANTITY', sql.Numeric(10,2), d.QUANTITY || 0)
          .input('PROCESS', sql.VarChar(20), d.PROCESS || null)
          .input('UNIT', sql.VarChar(10), d.UNIT || null)
          .input('RATE', sql.Numeric(10,2), d.RATE || 0)
          .input('AMOUNT', sql.Numeric(12,2), d.AMOUNT || 0)
          .query(`
            INSERT INTO JobworkInDetail (JWINWARDID, OUTITEMCODE, INITEMCODE, GROSSWT, NETWT, SCRAPITEMCODE, SCRAPPCS, SCRAPWT, QUANTITY, PROCESS, UNIT, RATE, AMOUNT)
            VALUES (@JWINWARDID, @OUTITEMCODE, @INITEMCODE, @GROSSWT, @NETWT, @SCRAPITEMCODE, @SCRAPPCS, @SCRAPWT, @QUANTITY, @PROCESS, @UNIT, @RATE, @AMOUNT);

            -- Increase finished item stock
            UPDATE ItemMaster
            SET ClosingStock = ISNULL(ClosingStock, 0) + 
              CASE 
                WHEN UPPER(@UNIT) IN ('KG', 'KGS') THEN @NETWT
                ELSE @QUANTITY
              END
            WHERE ItemCode = @INITEMCODE;

            -- Increase scrap stock if scrap item is set
            IF @SCRAPITEMCODE IS NOT NULL AND @SCRAPITEMCODE <> ''
            BEGIN
                UPDATE ItemMaster
                SET ClosingStock = ISNULL(ClosingStock, 0) + 
                  CASE 
                    WHEN EXISTS(SELECT 1 FROM ItemMaster WHERE ItemCode = @SCRAPITEMCODE AND UPPER(Unit) IN ('KG', 'KGS')) THEN @SCRAPWT
                    ELSE @SCRAPPCS
                  END
                WHERE ItemCode = @SCRAPITEMCODE;
            END
          `);
      }

      // 3. Generate Voucher and Update Ledgers if TOTALAMOUNT > 0
      if (TOTALAMOUNT > 0) {
        const purchaseLedgerRes = await new sql.Request(transaction).query("SELECT TOP 1 Id FROM LedgerMaster WHERE UPPER(LTRIM(RTRIM(LedgerName))) = 'PURCHASE'");
        let purchaseLedgerId = purchaseLedgerRes.recordset.length > 0 ? purchaseLedgerRes.recordset[0].Id : null;

        if (!purchaseLedgerId) {
          throw new Error('Purchase ledger not found. Please create a ledger named Purchase.');
        }

        const nextNoRes = await new sql.Request(transaction).query('SELECT ISNULL(MAX(VoucherNo), 0) + 1 AS NextVoucherNo FROM VoucherEntry');
        const voucherNo = nextNoRes.recordset[0].NextVoucherNo;

        // Debit Purchase
        await new sql.Request(transaction)
          .input('VoucherNo', sql.Numeric(8,0), voucherNo)
          .input('VoucherDate', sql.Date, JWINWARDDATE)
          .input('Mode', sql.VarChar(6), 'Debit')
          .input('LedgerId', sql.Numeric(10,0), purchaseLedgerId)
          .input('Amount', sql.Numeric(10,2), TOTALAMOUNT)
          .input('Through', sql.VarChar(30), 'Jobwork In')
          .input('Remark', sql.VarChar(255), JWINWARDNO)
          .input('CreatedBy', sql.VarChar(255), getSignature(CREATEDBY))
          .input('UpdatedBy', sql.VarChar(255), getSignature(CREATEDBY))
          .query(`
            INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, CreatedBy, UpdatedBy)
            VALUES (@VoucherNo, 'Purchase', @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @CreatedBy, @UpdatedBy);

            UPDATE LedgerMaster 
            SET ClosingBalance = ISNULL(ClosingBalance, 0) + @Amount
            WHERE Id = @LedgerId;
          `);

        // Credit Vendor
        await new sql.Request(transaction)
          .input('VoucherNo', sql.Numeric(8,0), voucherNo)
          .input('VoucherDate', sql.Date, JWINWARDDATE)
          .input('Mode', sql.VarChar(6), 'Credit')
          .input('LedgerId', sql.Numeric(10,0), LEDGERID)
          .input('Amount', sql.Numeric(10,2), TOTALAMOUNT)
          .input('Through', sql.VarChar(30), 'Jobwork In')
          .input('Remark', sql.VarChar(255), JWINWARDNO)
          .input('CreatedBy', sql.VarChar(255), getSignature(CREATEDBY))
          .input('UpdatedBy', sql.VarChar(255), getSignature(CREATEDBY))
          .query(`
            INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, CreatedBy, UpdatedBy)
            VALUES (@VoucherNo, 'Purchase', @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @CreatedBy, @UpdatedBy);

            UPDATE LedgerMaster 
            SET ClosingBalance = ISNULL(ClosingBalance, 0) - @Amount
            WHERE Id = @LedgerId;
          `);
      }

      await transaction.commit();
      res.status(201).json({ message: 'Job work in added successfully', id: newJwInwardId });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error adding job work in:', error);
    res.status(500).json({ message: error.message || 'Server error adding job work in' });
  }
};

exports.updateJobworkIn = async (req, res) => {
  const { id } = req.params;
  const { JWINWARDNO, JWINWARDDATE, LEDGERID, JWOUTWARDNO, TOTALAMOUNT, REMARK, UPDATEDBY, Details } = req.body;

  if (!JWINWARDNO || !JWINWARDDATE || !LEDGERID || !Details || !Array.isArray(Details) || Details.length === 0) {
    return res.status(400).json({ message: 'JWInwardNo, Date, Ledger, and at least one detail row are required' });
  }

  let pool;
  let transaction;
  try {
    pool = await connectDB();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Revert previous stock updates
      const oldDetailsReq = new sql.Request(transaction);
      const oldDetailsRes = await oldDetailsReq
        .input('JWINWARDID', sql.Numeric(8,0), id)
        .query('SELECT OUTITEMCODE, INITEMCODE, SCRAPITEMCODE, QUANTITY, NETWT, SCRAPPCS, SCRAPWT, UNIT FROM JobworkInDetail WHERE JWINWARDID = @JWINWARDID');
      
      for (const oldD of oldDetailsRes.recordset) {
        const revertStockReq = new sql.Request(transaction);
        await revertStockReq
          .input('OUTITEMCODE', sql.VarChar(10), oldD.OUTITEMCODE)
          .input('INITEMCODE', sql.VarChar(10), oldD.INITEMCODE)
          .input('SCRAPITEMCODE', sql.VarChar(10), oldD.SCRAPITEMCODE || null)
          .input('QUANTITY', sql.Numeric(10,2), oldD.QUANTITY)
          .input('NETWT', sql.Numeric(10,3), oldD.NETWT || 0)
          .input('SCRAPPCS', sql.Numeric(5,2), oldD.SCRAPPCS || 0)
          .input('SCRAPWT', sql.Numeric(10,3), oldD.SCRAPWT || 0)
          .input('UNIT', sql.VarChar(10), oldD.UNIT || '')
          .query(`
            -- Decrease finished item stock (revert increase)
            UPDATE ItemMaster
            SET ClosingStock = ISNULL(ClosingStock, 0) - 
              CASE 
                WHEN UPPER(@UNIT) IN ('KG', 'KGS') THEN @NETWT
                ELSE @QUANTITY
              END
            WHERE ItemCode = @INITEMCODE;

            -- Decrease scrap stock (revert increase)
            IF @SCRAPITEMCODE IS NOT NULL AND @SCRAPITEMCODE <> ''
            BEGIN
                UPDATE ItemMaster
                SET ClosingStock = ISNULL(ClosingStock, 0) - 
                  CASE 
                    WHEN EXISTS(SELECT 1 FROM ItemMaster WHERE ItemCode = @SCRAPITEMCODE AND UPPER(Unit) IN ('KG', 'KGS')) THEN @SCRAPWT
                    ELSE @SCRAPPCS
                  END
                WHERE ItemCode = @SCRAPITEMCODE;
            END
          `);
      }

      // 2. Revert previous vouchers
      const oldHeaderRes = await new sql.Request(transaction)
        .input('ID', sql.Numeric(8,0), id)
        .query('SELECT JWINWARDNO FROM JobworkInHeader WHERE ID = @ID');
      
      if (oldHeaderRes.recordset.length > 0) {
        const oldHeader = oldHeaderRes.recordset[0];
        
        await new sql.Request(transaction)
          .input('Through', sql.VarChar(30), 'Jobwork In')
          .input('Remark', sql.VarChar(255), oldHeader.JWINWARDNO)
          .query(`
            UPDATE l
            SET l.ClosingBalance = ISNULL(l.ClosingBalance, 0) - CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END
            FROM LedgerMaster l
            INNER JOIN VoucherEntry v ON l.Id = v.LedgerId
            WHERE v.Through = @Through AND v.Remark = @Remark;

            DELETE FROM VoucherEntry WHERE Through = @Through AND Remark = @Remark;
          `);
      }

      // 3. Delete old details
      const deleteDetailsReq = new sql.Request(transaction);
      await deleteDetailsReq
        .input('JWINWARDID', sql.Numeric(8,0), id)
        .query('DELETE FROM JobworkInDetail WHERE JWINWARDID = @JWINWARDID');

      // 4. Update Header
      const headerReq = new sql.Request(transaction);
      await headerReq
        .input('ID', sql.Numeric(8,0), id)
        .input('JWINWARDNO', sql.VarChar(10), JWINWARDNO)
        .input('JWINWARDDATE', sql.Date, JWINWARDDATE)
        .input('LEDGERID', sql.Numeric(10,0), LEDGERID)
        .input('JWOUTWARDNO', sql.VarChar(10), JWOUTWARDNO || null)
        .input('TOTALAMOUNT', sql.Numeric(12,2), TOTALAMOUNT || 0)
        .input('REMARK', sql.VarChar(100), REMARK || null)
        .input('UPDATEDBY', sql.VarChar(40), getSignature(UPDATEDBY))
        .query(`
          UPDATE JobworkInHeader 
          SET JWINWARDNO = @JWINWARDNO, JWINWARDDATE = @JWINWARDDATE, 
              LEDGERID = @LEDGERID, JWOUTWARDNO = @JWOUTWARDNO, TOTALAMOUNT = @TOTALAMOUNT, 
              REMARK = @REMARK, UPDATEDBY = @UPDATEDBY
          WHERE ID = @ID
        `);

      // 5. Insert new details and apply stock changes
      for (const d of Details) {
        if (!d.INITEMCODE || !d.OUTITEMCODE) {
          throw new Error('Incoming Item and Outgoing Item are required for all detail rows');
        }
        
        const detailReq = new sql.Request(transaction);
        await detailReq
          .input('JWINWARDID', sql.Numeric(8,0), id)
          .input('OUTITEMCODE', sql.VarChar(10), d.OUTITEMCODE)
          .input('INITEMCODE', sql.VarChar(10), d.INITEMCODE)
          .input('GROSSWT', sql.Numeric(10,3), d.GROSSWT || 0)
          .input('NETWT', sql.Numeric(10,3), d.NETWT || 0)
          .input('SCRAPITEMCODE', sql.VarChar(10), d.SCRAPITEMCODE || null)
          .input('SCRAPPCS', sql.Numeric(5,2), d.SCRAPPCS || 0)
          .input('SCRAPWT', sql.Numeric(10,3), d.SCRAPWT || 0)
          .input('QUANTITY', sql.Numeric(10,2), d.QUANTITY || 0)
          .input('PROCESS', sql.VarChar(20), d.PROCESS || null)
          .input('UNIT', sql.VarChar(10), d.UNIT || null)
          .input('RATE', sql.Numeric(10,2), d.RATE || 0)
          .input('AMOUNT', sql.Numeric(12,2), d.AMOUNT || 0)
          .query(`
            INSERT INTO JobworkInDetail (JWINWARDID, OUTITEMCODE, INITEMCODE, GROSSWT, NETWT, SCRAPITEMCODE, SCRAPPCS, SCRAPWT, QUANTITY, PROCESS, UNIT, RATE, AMOUNT)
            VALUES (@JWINWARDID, @OUTITEMCODE, @INITEMCODE, @GROSSWT, @NETWT, @SCRAPITEMCODE, @SCRAPPCS, @SCRAPWT, @QUANTITY, @PROCESS, @UNIT, @RATE, @AMOUNT);

            -- Increase finished item stock
            UPDATE ItemMaster
            SET ClosingStock = ISNULL(ClosingStock, 0) + 
              CASE 
                WHEN UPPER(@UNIT) IN ('KG', 'KGS') THEN @NETWT
                ELSE @QUANTITY
              END
            WHERE ItemCode = @INITEMCODE;

            -- Increase scrap stock if scrap item is set
            IF @SCRAPITEMCODE IS NOT NULL AND @SCRAPITEMCODE <> ''
            BEGIN
                UPDATE ItemMaster
                SET ClosingStock = ISNULL(ClosingStock, 0) + 
                  CASE 
                    WHEN EXISTS(SELECT 1 FROM ItemMaster WHERE ItemCode = @SCRAPITEMCODE AND UPPER(Unit) IN ('KG', 'KGS')) THEN @SCRAPWT
                    ELSE @SCRAPPCS
                  END
                WHERE ItemCode = @SCRAPITEMCODE;
            END
          `);
      }

      // 6. Generate Voucher and Update Ledgers if TOTALAMOUNT > 0
      if (TOTALAMOUNT > 0) {
        const purchaseLedgerRes = await new sql.Request(transaction).query("SELECT TOP 1 Id FROM LedgerMaster WHERE UPPER(LTRIM(RTRIM(LedgerName))) = 'PURCHASE'");
        let purchaseLedgerId = purchaseLedgerRes.recordset.length > 0 ? purchaseLedgerRes.recordset[0].Id : null;

        if (!purchaseLedgerId) {
          throw new Error('Purchase ledger not found. Please create a ledger named Purchase.');
        }

        const nextNoRes = await new sql.Request(transaction).query('SELECT ISNULL(MAX(VoucherNo), 0) + 1 AS NextVoucherNo FROM VoucherEntry');
        const voucherNo = nextNoRes.recordset[0].NextVoucherNo;

        // Debit Purchase
        await new sql.Request(transaction)
          .input('VoucherNo', sql.Numeric(8,0), voucherNo)
          .input('VoucherDate', sql.Date, JWINWARDDATE)
          .input('Mode', sql.VarChar(6), 'Debit')
          .input('LedgerId', sql.Numeric(10,0), purchaseLedgerId)
          .input('Amount', sql.Numeric(10,2), TOTALAMOUNT)
          .input('Through', sql.VarChar(30), 'Jobwork In')
          .input('Remark', sql.VarChar(255), JWINWARDNO)
          .input('CreatedBy', sql.VarChar(255), getSignature(UPDATEDBY))
          .input('UpdatedBy', sql.VarChar(255), getSignature(UPDATEDBY))
          .query(`
            INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, CreatedBy, UpdatedBy)
            VALUES (@VoucherNo, 'Purchase', @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @CreatedBy, @UpdatedBy);

            UPDATE LedgerMaster 
            SET ClosingBalance = ISNULL(ClosingBalance, 0) + @Amount
            WHERE Id = @LedgerId;
          `);

        // Credit Vendor
        await new sql.Request(transaction)
          .input('VoucherNo', sql.Numeric(8,0), voucherNo)
          .input('VoucherDate', sql.Date, JWINWARDDATE)
          .input('Mode', sql.VarChar(6), 'Credit')
          .input('LedgerId', sql.Numeric(10,0), LEDGERID)
          .input('Amount', sql.Numeric(10,2), TOTALAMOUNT)
          .input('Through', sql.VarChar(30), 'Jobwork In')
          .input('Remark', sql.VarChar(255), JWINWARDNO)
          .input('CreatedBy', sql.VarChar(255), getSignature(UPDATEDBY))
          .input('UpdatedBy', sql.VarChar(255), getSignature(UPDATEDBY))
          .query(`
            INSERT INTO VoucherEntry (VoucherNo, VoucherType, VoucherDate, Mode, LedgerId, Amount, Through, Remark, CreatedBy, UpdatedBy)
            VALUES (@VoucherNo, 'Purchase', @VoucherDate, @Mode, @LedgerId, @Amount, @Through, @Remark, @CreatedBy, @UpdatedBy);

            UPDATE LedgerMaster 
            SET ClosingBalance = ISNULL(ClosingBalance, 0) - @Amount
            WHERE Id = @LedgerId;
          `);
      }

      await transaction.commit();
      res.status(200).json({ message: 'Job work in updated successfully' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error updating job work in:', error);
    res.status(500).json({ message: error.message || 'Server error updating job work in' });
  }
};

exports.deleteJobworkIn = async (req, res) => {
  const { id } = req.params;

  let pool;
  let transaction;
  try {
    pool = await connectDB();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Revert stock updates
      const oldDetailsReq = new sql.Request(transaction);
      const oldDetailsRes = await oldDetailsReq
        .input('JWINWARDID', sql.Numeric(8,0), id)
        .query('SELECT OUTITEMCODE, INITEMCODE, SCRAPITEMCODE, QUANTITY, NETWT, SCRAPPCS, SCRAPWT, UNIT FROM JobworkInDetail WHERE JWINWARDID = @JWINWARDID');
      
      for (const oldD of oldDetailsRes.recordset) {
        const revertStockReq = new sql.Request(transaction);
        await revertStockReq
          .input('OUTITEMCODE', sql.VarChar(10), oldD.OUTITEMCODE)
          .input('INITEMCODE', sql.VarChar(10), oldD.INITEMCODE)
          .input('SCRAPITEMCODE', sql.VarChar(10), oldD.SCRAPITEMCODE || null)
          .input('QUANTITY', sql.Numeric(10,2), oldD.QUANTITY)
          .input('NETWT', sql.Numeric(10,3), oldD.NETWT || 0)
          .input('SCRAPPCS', sql.Numeric(5,2), oldD.SCRAPPCS || 0)
          .input('SCRAPWT', sql.Numeric(10,3), oldD.SCRAPWT || 0)
          .input('UNIT', sql.VarChar(10), oldD.UNIT || '')
          .query(`
            -- Decrease finished item stock (revert increase)
            UPDATE ItemMaster
            SET ClosingStock = ISNULL(ClosingStock, 0) - 
              CASE 
                WHEN UPPER(@UNIT) IN ('KG', 'KGS') THEN @NETWT
                ELSE @QUANTITY
              END
            WHERE ItemCode = @INITEMCODE;

            -- Decrease scrap stock (revert increase)
            IF @SCRAPITEMCODE IS NOT NULL AND @SCRAPITEMCODE <> ''
            BEGIN
                UPDATE ItemMaster
                SET ClosingStock = ISNULL(ClosingStock, 0) - 
                  CASE 
                    WHEN EXISTS(SELECT 1 FROM ItemMaster WHERE ItemCode = @SCRAPITEMCODE AND UPPER(Unit) IN ('KG', 'KGS')) THEN @SCRAPWT
                    ELSE @SCRAPPCS
                  END
                WHERE ItemCode = @SCRAPITEMCODE;
            END
          `);
      }

      // 2. Revert previous vouchers
      const oldHeaderRes = await new sql.Request(transaction)
        .input('ID', sql.Numeric(8,0), id)
        .query('SELECT JWINWARDNO FROM JobworkInHeader WHERE ID = @ID');
      
      if (oldHeaderRes.recordset.length > 0) {
        const oldHeader = oldHeaderRes.recordset[0];
        
        await new sql.Request(transaction)
          .input('Through', sql.VarChar(30), 'Jobwork In')
          .input('Remark', sql.VarChar(255), oldHeader.JWINWARDNO)
          .query(`
            UPDATE l
            SET l.ClosingBalance = ISNULL(l.ClosingBalance, 0) - CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END
            FROM LedgerMaster l
            INNER JOIN VoucherEntry v ON l.Id = v.LedgerId
            WHERE v.Through = @Through AND v.Remark = @Remark;

            DELETE FROM VoucherEntry WHERE Through = @Through AND Remark = @Remark;
          `);
      }

      // 3. Delete details and header
      const deleteReq = new sql.Request(transaction);
      await deleteReq
        .input('ID', sql.Numeric(8,0), id)
        .query(`
          DELETE FROM JobworkInDetail WHERE JWINWARDID = @ID;
          DELETE FROM JobworkInHeader WHERE ID = @ID;
        `);

      await transaction.commit();
      res.status(200).json({ message: 'Job work in deleted successfully' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error deleting job work in:', error);
    res.status(500).json({ message: 'Server error deleting job work in' });
  }
};

exports.getJobworkInReport = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
        d.ID as RowId,
        h.JWINWARDNO, 
        h.JWINWARDDATE, 
        h.JWOUTWARDNO,
        l.LedgerName, 
        d.OUTITEMCODE, 
        oi.ItemName as OutItemName,
        d.INITEMCODE,
        ii.ItemName as InItemName,
        d.GROSSWT, 
        d.NETWT, 
        d.QUANTITY, 
        d.PROCESS,
        d.UNIT, 
        d.SCRAPITEMCODE,
        si.ItemName as ScrapItemName,
        d.SCRAPPCS,
        d.SCRAPWT,
        d.RATE, 
        d.AMOUNT 
      FROM JobworkInDetail d
      INNER JOIN JobworkInHeader h ON d.JWINWARDID = h.ID
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      LEFT JOIN ItemMaster oi ON d.OUTITEMCODE = oi.ItemCode
      LEFT JOIN ItemMaster ii ON d.INITEMCODE = ii.ItemCode
      LEFT JOIN ItemMaster si ON d.SCRAPITEMCODE = si.ItemCode
      ORDER BY h.JWINWARDDATE DESC, h.JWINWARDNO DESC, d.ID ASC
    `);
    
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching jobwork in report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getJobworkStockReport = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
        ROW_NUMBER() OVER(ORDER BY l.LedgerName, i.ItemName) AS RowId,
        l.Id AS LedgerId,
        l.LedgerName,
        i.ItemCode,
        i.ItemName,
        SUM(d.QUANTITY) AS OutQty,
        SUM(d.NETWT) AS OutNetWt,
        ISNULL(inwards.InQty, 0) AS InQty,
        ISNULL(inwards.InNetWt, 0) AS InNetWt,
        (SUM(d.QUANTITY) - ISNULL(inwards.InQty, 0)) AS BalQty,
        (SUM(d.NETWT) - ISNULL(inwards.InNetWt, 0)) AS BalNetWt
      FROM JobworkOutDetail d
      INNER JOIN JobworkOutHeader h ON d.JWOUTWARDID = h.ID
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode
      LEFT JOIN (
        SELECT 
          jwh.LEDGERID,
          jwd.OUTITEMCODE,
          SUM(jwd.QUANTITY) AS InQty,
          SUM(jwd.NETWT) AS InNetWt
        FROM JobworkInDetail jwd
        INNER JOIN JobworkInHeader jwh ON jwd.JWINWARDID = jwh.ID
        GROUP BY jwh.LEDGERID, jwd.OUTITEMCODE
      ) inwards ON l.Id = inwards.LEDGERID AND i.ItemCode = inwards.OUTITEMCODE
      GROUP BY l.Id, l.LedgerName, i.ItemCode, i.ItemName, inwards.InQty, inwards.InNetWt
      HAVING (SUM(d.QUANTITY) - ISNULL(inwards.InQty, 0)) > 0 OR (SUM(d.NETWT) - ISNULL(inwards.InNetWt, 0)) > 0
      ORDER BY l.LedgerName, i.ItemName
    `);
    
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching jobwork stock report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
