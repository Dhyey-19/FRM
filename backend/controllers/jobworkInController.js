const { sql, connectDB } = require('../config/db');

const getSignature = (username) => {
    const name = username || 'System';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const sig = `${name} - ${dateStr} ${timeStr}`;
    return sig.substring(0, 40);
};

exports.getNextJobworkInNo = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT ISNULL(MAX(TRY_CAST(JWINWARDNO AS INT)), 0) + 1 AS NextNo 
      FROM JobworkInHeader
    `);
    
    let nextNo = result.recordset[0]?.NextNo;
    if (!nextNo || isNaN(nextNo)) {
      nextNo = 1;
    }
    res.status(200).json({ nextNo: String(nextNo) });
  } catch (error) {
    console.error('Error fetching next jobwork in no:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getJobworkIns = async (req, res) => {
  try {
    const pool = await connectDB();
    
    // Fetch all headers with LedgerName
    const headerResult = await pool.request().query(`
      SELECT h.*, l.LedgerName 
      FROM JobworkInHeader h
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      ORDER BY 
        h.JWINWARDDATE DESC,
        CASE WHEN TRY_CAST(h.JWINWARDNO AS INT) IS NOT NULL THEN 0 ELSE 1 END,
        TRY_CAST(h.JWINWARDNO AS INT) DESC,
        h.JWINWARDNO DESC
    `);
    
    // Fetch all details with ItemNames
    const detailResult = await pool.request().query(`
      SELECT d.*, 
             ISNULL(d.OUTSUBCODE, '') AS OUTSUBCODE,
             ISNULL(d.INSUBCODE, '') AS INSUBCODE,
             ISNULL(d.SCRAPSUBCODE, '') AS SCRAPSUBCODE,
             ii.ItemName as InItemName,
             oi.ItemName as OutItemName,
             si.ItemName as ScrapItemName
      FROM JobworkInDetail d
      LEFT JOIN ItemMaster ii ON d.INITEMCODE = ii.ItemCode AND ISNULL(d.INSUBCODE, '') = ISNULL(ii.SubCode, '')
      LEFT JOIN ItemMaster oi ON d.OUTITEMCODE = oi.ItemCode AND ISNULL(d.OUTSUBCODE, '') = ISNULL(oi.SubCode, '')
      LEFT JOIN ItemMaster si ON d.SCRAPITEMCODE = si.ItemCode AND ISNULL(d.SCRAPSUBCODE, '') = ISNULL(si.SubCode, '')
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
  const { Bill, JWINWARDNO, JWINWARDDATE, LEDGERID, JWOUTWARDNO, TOTALAMOUNT, REMARK, CREATEDBY, Details } = req.body;

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
        .input('Bill', sql.Bit, Bill !== undefined ? (Bill !== false && Bill !== 0 && Bill !== '0' ? 1 : 0) : 1)
        .input('JWINWARDNO', sql.VarChar(10), JWINWARDNO)
        .input('JWINWARDDATE', sql.Date, JWINWARDDATE)
        .input('LEDGERID', sql.Numeric(10,0), LEDGERID)
        .input('JWOUTWARDNO', sql.VarChar(10), JWOUTWARDNO || null)
        .input('TOTALAMOUNT', sql.Numeric(12,2), TOTALAMOUNT || 0)
        .input('REMARK', sql.VarChar(100), REMARK || null)
        .input('CREATEDBY', sql.VarChar(40), getSignature(CREATEDBY))
        .input('UPDATEDBY', sql.VarChar(40), getSignature(CREATEDBY))
        .query(`
          INSERT INTO JobworkInHeader (Bill, JWINWARDNO, JWINWARDDATE, LEDGERID, JWOUTWARDNO, TOTALAMOUNT, REMARK, CREATEDBY, UPDATEDBY)
          OUTPUT INSERTED.ID
          VALUES (@Bill, @JWINWARDNO, @JWINWARDDATE, @LEDGERID, @JWOUTWARDNO, @TOTALAMOUNT, @REMARK, @CREATEDBY, @UPDATEDBY)
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
          .input('TENPCSWT', sql.Numeric(10,3), d.TENPCSWT || null)
          .input('SCRAPITEMCODE', sql.VarChar(10), d.SCRAPITEMCODE || null)
          .input('SCRAPPCS', sql.Numeric(5,2), d.SCRAPPCS || 0)
          .input('SCRAPWT', sql.Numeric(10,3), d.SCRAPWT || 0)
          .input('QUANTITY', sql.Numeric(10,2), d.QUANTITY || 0)
          .input('PROCESS', sql.VarChar(20), d.PROCESS || null)
          .input('UNIT', sql.VarChar(10), d.UNIT || null)
          .input('RATE', sql.Numeric(10,2), d.RATE || 0)
          .input('AMOUNT', sql.Numeric(12,2), d.AMOUNT || 0)
          .query(`
            INSERT INTO JobworkInDetail (JWINWARDID, OUTITEMCODE, INITEMCODE, GROSSWT, NETWT, TENPCSWT, SCRAPITEMCODE, SCRAPPCS, SCRAPWT, QUANTITY, PROCESS, UNIT, RATE, AMOUNT)
            VALUES (@JWINWARDID, @OUTITEMCODE, @INITEMCODE, @GROSSWT, @NETWT, @TENPCSWT, @SCRAPITEMCODE, @SCRAPPCS, @SCRAPWT, @QUANTITY, @PROCESS, @UNIT, @RATE, @AMOUNT);

            -- Increase finished item stock
            UPDATE ItemMaster
            SET ClosingStock = ISNULL(ClosingStock, 0) + 
              CASE 
                WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @NETWT
                ELSE @QUANTITY
              END
            WHERE ItemCode = @INITEMCODE;

            -- Increase scrap stock if scrap item is set
            IF @SCRAPITEMCODE IS NOT NULL AND @SCRAPITEMCODE <> ''
            BEGIN
                UPDATE ItemMaster
                SET ClosingStock = ISNULL(ClosingStock, 0) + 
                  CASE 
                    WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @SCRAPWT
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

        const isBill = Bill !== undefined ? (Bill !== false && Bill !== 0 && Bill !== '0' ? 1 : 0) : 1;

        // Debit Purchase
        await new sql.Request(transaction)
          .input('VoucherNo', sql.Numeric(8,0), voucherNo)
          .input('VoucherDate', sql.Date, JWINWARDDATE)
          .input('Mode', sql.VarChar(6), 'Debit')
          .input('LedgerId', sql.Numeric(10,0), purchaseLedgerId)
          .input('Amount', sql.Numeric(10,2), TOTALAMOUNT)
          .input('Through', sql.VarChar(30), 'Jobwork In')
          .input('Remark', sql.VarChar(255), JWINWARDNO)
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
          .input('VoucherDate', sql.Date, JWINWARDDATE)
          .input('Mode', sql.VarChar(6), 'Credit')
          .input('LedgerId', sql.Numeric(10,0), LEDGERID)
          .input('Amount', sql.Numeric(10,2), TOTALAMOUNT)
          .input('Through', sql.VarChar(30), 'Jobwork In')
          .input('Remark', sql.VarChar(255), JWINWARDNO)
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
  const { Bill, JWINWARDNO, JWINWARDDATE, LEDGERID, JWOUTWARDNO, TOTALAMOUNT, REMARK, UPDATEDBY, Details } = req.body;

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
        .query('SELECT INITEMCODE, SCRAPITEMCODE, QUANTITY, NETWT, SCRAPPCS, SCRAPWT, UNIT FROM JobworkInDetail WHERE JWINWARDID = @JWINWARDID');
      
      for (const oldD of oldDetailsRes.recordset) {
        await new sql.Request(transaction)
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
                WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @NETWT
                ELSE @QUANTITY
              END
            WHERE ItemCode = @INITEMCODE;

            -- Decrease scrap stock (revert increase)
            IF @SCRAPITEMCODE IS NOT NULL AND @SCRAPITEMCODE <> ''
            BEGIN
                UPDATE ItemMaster
                SET ClosingStock = ISNULL(ClosingStock, 0) - 
                  CASE 
                    WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @SCRAPWT
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
            SET l.ClosingBalance = l.ClosingBalance + CASE WHEN v.Mode = 'Credit' THEN v.Amount ELSE -v.Amount END
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
        .input('Bill', sql.Bit, Bill !== undefined ? (Bill !== false && Bill !== 0 && Bill !== '0' ? 1 : 0) : 1)
        .input('JWINWARDNO', sql.VarChar(10), JWINWARDNO)
        .input('JWINWARDDATE', sql.Date, JWINWARDDATE)
        .input('LEDGERID', sql.Numeric(10,0), LEDGERID)
        .input('JWOUTWARDNO', sql.VarChar(10), JWOUTWARDNO || null)
        .input('TOTALAMOUNT', sql.Numeric(12,2), TOTALAMOUNT || 0)
        .input('REMARK', sql.VarChar(100), REMARK || null)
        .input('UPDATEDBY', sql.VarChar(40), getSignature(UPDATEDBY))
        .query(`
          UPDATE JobworkInHeader 
          SET Bill = @Bill, JWINWARDNO = @JWINWARDNO, JWINWARDDATE = @JWINWARDDATE, 
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
          .input('TENPCSWT', sql.Numeric(10,3), d.TENPCSWT || null)
          .input('SCRAPITEMCODE', sql.VarChar(10), d.SCRAPITEMCODE || null)
          .input('SCRAPPCS', sql.Numeric(5,2), d.SCRAPPCS || 0)
          .input('SCRAPWT', sql.Numeric(10,3), d.SCRAPWT || 0)
          .input('QUANTITY', sql.Numeric(10,2), d.QUANTITY || 0)
          .input('PROCESS', sql.VarChar(20), d.PROCESS || null)
          .input('UNIT', sql.VarChar(10), d.UNIT || null)
          .input('RATE', sql.Numeric(10,2), d.RATE || 0)
          .input('AMOUNT', sql.Numeric(12,2), d.AMOUNT || 0)
          .query(`
            INSERT INTO JobworkInDetail (JWINWARDID, OUTITEMCODE, INITEMCODE, GROSSWT, NETWT, TENPCSWT, SCRAPITEMCODE, SCRAPPCS, SCRAPWT, QUANTITY, PROCESS, UNIT, RATE, AMOUNT)
            VALUES (@JWINWARDID, @OUTITEMCODE, @INITEMCODE, @GROSSWT, @NETWT, @TENPCSWT, @SCRAPITEMCODE, @SCRAPPCS, @SCRAPWT, @QUANTITY, @PROCESS, @UNIT, @RATE, @AMOUNT);

            -- Increase finished item stock
            UPDATE ItemMaster
            SET ClosingStock = ISNULL(ClosingStock, 0) + 
              CASE 
                WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @NETWT
                ELSE @QUANTITY
              END
            WHERE ItemCode = @INITEMCODE;

            -- Increase scrap stock if scrap item is set
            IF @SCRAPITEMCODE IS NOT NULL AND @SCRAPITEMCODE <> ''
            BEGIN
                UPDATE ItemMaster
                SET ClosingStock = ISNULL(ClosingStock, 0) + 
                  CASE 
                    WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @SCRAPWT
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

        const isBill = Bill !== undefined ? (Bill !== false && Bill !== 0 && Bill !== '0' ? 1 : 0) : 1;

        // Debit Purchase
        await new sql.Request(transaction)
          .input('VoucherNo', sql.Numeric(8,0), voucherNo)
          .input('VoucherDate', sql.Date, JWINWARDDATE)
          .input('Mode', sql.VarChar(6), 'Debit')
          .input('LedgerId', sql.Numeric(10,0), purchaseLedgerId)
          .input('Amount', sql.Numeric(10,2), TOTALAMOUNT)
          .input('Through', sql.VarChar(30), 'Jobwork In')
          .input('Remark', sql.VarChar(255), JWINWARDNO)
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
          .input('VoucherDate', sql.Date, JWINWARDDATE)
          .input('Mode', sql.VarChar(6), 'Credit')
          .input('LedgerId', sql.Numeric(10,0), LEDGERID)
          .input('Amount', sql.Numeric(10,2), TOTALAMOUNT)
          .input('Through', sql.VarChar(30), 'Jobwork In')
          .input('Remark', sql.VarChar(255), JWINWARDNO)
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
                WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @NETWT
                ELSE @QUANTITY
              END
            WHERE ItemCode = @INITEMCODE;

            -- Decrease scrap stock (revert increase)
            IF @SCRAPITEMCODE IS NOT NULL AND @SCRAPITEMCODE <> ''
            BEGIN
                UPDATE ItemMaster
                SET ClosingStock = ISNULL(ClosingStock, 0) - 
                  CASE 
                    WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @SCRAPWT
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
        h.Bill,
        l.LedgerName, 
        d.OUTITEMCODE, 
        ISNULL(d.OUTSUBCODE, '') as OUTSUBCODE,
        oi.ItemName as OutItemName,
        d.INITEMCODE, 
        ISNULL(d.INSUBCODE, '') as INSUBCODE,
        ii.ItemName as InItemName,
        d.GROSSWT, 
        d.NETWT, 
        d.QUANTITY, 
        d.PROCESS,
        d.UNIT, 
        d.SCRAPITEMCODE,
        ISNULL(d.SCRAPSUBCODE, '') as SCRAPSUBCODE,
        si.ItemName as ScrapItemName,
        d.SCRAPPCS,
        d.SCRAPWT,
        d.RATE, 
        d.AMOUNT 
      FROM JobworkInDetail d
      INNER JOIN JobworkInHeader h ON d.JWINWARDID = h.ID
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      LEFT JOIN ItemMaster oi ON d.OUTITEMCODE = oi.ItemCode AND ISNULL(d.OUTSUBCODE, '') = ISNULL(oi.SubCode, '')
      LEFT JOIN ItemMaster ii ON d.INITEMCODE = ii.ItemCode AND ISNULL(d.INSUBCODE, '') = ISNULL(ii.SubCode, '')
      LEFT JOIN ItemMaster si ON d.SCRAPITEMCODE = si.ItemCode AND ISNULL(d.SCRAPSUBCODE, '') = ISNULL(si.SubCode, '')
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
        ROW_NUMBER() OVER(ORDER BY l.LedgerName, i.ItemName, d.ITEMCODE, ISNULL(d.SUBCODE, '')) AS RowId,
        l.Id AS LedgerId,
        l.LedgerName,
        d.ITEMCODE AS ItemCode,
        ISNULL(d.SUBCODE, '') AS SubCode,
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
      LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode AND ISNULL(d.SUBCODE, '') = ISNULL(i.SubCode, '')
      LEFT JOIN (
        SELECT 
          jwh.LEDGERID,
          jwd.OUTITEMCODE,
          ISNULL(jwd.OUTSUBCODE, '') AS OUTSUBCODE,
          SUM(jwd.QUANTITY) AS InQty,
          SUM(jwd.NETWT) AS InNetWt
        FROM JobworkInDetail jwd
        INNER JOIN JobworkInHeader jwh ON jwd.JWINWARDID = jwh.ID
        GROUP BY jwh.LEDGERID, jwd.OUTITEMCODE, ISNULL(jwd.OUTSUBCODE, '')
      ) inwards ON l.Id = inwards.LEDGERID AND d.ITEMCODE = inwards.OUTITEMCODE AND ISNULL(d.SUBCODE, '') = inwards.OUTSUBCODE
      GROUP BY l.Id, l.LedgerName, d.ITEMCODE, ISNULL(d.SUBCODE, ''), i.ItemName, inwards.InQty, inwards.InNetWt
      HAVING (SUM(d.QUANTITY) - ISNULL(inwards.InQty, 0)) > 0 OR (SUM(d.NETWT) - ISNULL(inwards.InNetWt, 0)) > 0
      ORDER BY l.LedgerName, i.ItemName, d.ITEMCODE, ISNULL(d.SUBCODE, '')
    `);
    
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching jobwork stock report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper to parse entry timestamp from CreatedBy signature
const parseEntryTimestamp = (sig) => {
  if (!sig || typeof sig !== 'string') return 0;
  const dmyMatch = sig.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  const ymdMatch = sig.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const min = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const sec = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return 0;
};

const extractEntryTime = (sig) => {
  if (!sig || typeof sig !== 'string') return '';
  const match = sig.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
  return match ? match[1] : '';
};

// GET /api/jobwork-ins/movement-report
exports.getJobworkMovementReport = async (req, res) => {
  try {
    const { partyId, ledgerId, itemCode, subCode, startDate, endDate, status = 'all' } = req.query;
    const targetLedgerId = partyId || ledgerId ? Number(partyId || ledgerId) : null;
    const targetItemCode = itemCode && itemCode !== 'all' ? String(itemCode).trim() : null;
    const targetSubCode = subCode !== undefined && subCode !== null && subCode !== 'all' ? String(subCode).trim() : null;

    const pool = await connectDB();

    // Query all relevant Jobwork Out and Jobwork In transactions
    const query = `
      SELECT 
        'OUT' as Direction,
        'Jobwork Out' as MovementType,
        h.ID as HeaderId,
        d.ID as DetailId,
        h.JWOUTWARDNO as DocNo,
        NULL as RefDocNo,
        CONVERT(VARCHAR(10), h.JWOUTWARDDATE, 120) as TxDate,
        h.LEDGERID as LedgerId,
        l.LedgerName as PartyName,
        d.ITEMCODE as ItemCode,
        ISNULL(d.SUBCODE, '') as SubCode,
        i.ItemName,
        ISNULL(i.Unit, d.UNIT) as Unit,
        d.PROCESS as Process,
        ISNULL(d.QUANTITY, 0) as OutQty,
        ISNULL(d.NETWT, 0) as OutWt,
        0 as InQty,
        0 as InWt,
        0 as ScrapPcs,
        0 as ScrapWt,
        ISNULL(d.RATE, 0) as Rate,
        h.Bill,
        h.REMARK as Remark,
        h.CREATEDBY as CreatedBy
      FROM JobworkOutDetail d
      INNER JOIN JobworkOutHeader h ON d.JWOUTWARDID = h.ID
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode AND ISNULL(d.SUBCODE, '') = ISNULL(i.SubCode, '')
      WHERE 1=1
        ${targetLedgerId ? 'AND h.LEDGERID = @TargetLedgerId' : ''}
        ${targetItemCode ? 'AND d.ITEMCODE = @TargetItemCode' : ''}
        ${targetSubCode !== null ? 'AND ISNULL(d.SUBCODE, \'\') = @TargetSubCode' : ''}

      UNION ALL

      SELECT 
        'IN' as Direction,
        'Jobwork In' as MovementType,
        h.ID as HeaderId,
        d.ID as DetailId,
        h.JWINWARDNO as DocNo,
        h.JWOUTWARDNO as RefDocNo,
        CONVERT(VARCHAR(10), h.JWINWARDDATE, 120) as TxDate,
        h.LEDGERID as LedgerId,
        l.LedgerName as PartyName,
        d.OUTITEMCODE as ItemCode,
        ISNULL(d.OUTSUBCODE, '') as SubCode,
        i.ItemName,
        ISNULL(i.Unit, d.UNIT) as Unit,
        d.PROCESS as Process,
        0 as OutQty,
        0 as OutWt,
        ISNULL(d.QUANTITY, 0) as InQty,
        ISNULL(d.NETWT, 0) as InWt,
        ISNULL(d.SCRAPPCS, 0) as ScrapPcs,
        ISNULL(d.SCRAPWT, 0) as ScrapWt,
        ISNULL(d.RATE, 0) as Rate,
        h.Bill,
        h.REMARK as Remark,
        h.CREATEDBY as CreatedBy
      FROM JobworkInDetail d
      INNER JOIN JobworkInHeader h ON d.JWINWARDID = h.ID
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      LEFT JOIN ItemMaster i ON d.OUTITEMCODE = i.ItemCode AND ISNULL(d.OUTSUBCODE, '') = ISNULL(i.SubCode, '')
      WHERE 1=1
        ${targetLedgerId ? 'AND h.LEDGERID = @TargetLedgerId' : ''}
        ${targetItemCode ? 'AND d.OUTITEMCODE = @TargetItemCode' : ''}
        ${targetSubCode !== null ? 'AND ISNULL(d.OUTSUBCODE, \'\') = @TargetSubCode' : ''}
    `;

    const request = pool.request();
    if (targetLedgerId) request.input('TargetLedgerId', sql.Numeric(10, 0), targetLedgerId);
    if (targetItemCode) request.input('TargetItemCode', sql.VarChar(10), targetItemCode);
    if (targetSubCode !== null) request.input('TargetSubCode', sql.VarChar(50), targetSubCode);

    const result = await request.query(query);
    const allRecords = result.recordset || [];

    // Distinct list of parties and items across all jobwork movements (for dropdown filters)
    const partiesMap = new Map();
    const itemsMap = new Map();

    // Also fetch all jobwork parties from LedgerMaster if not populated
    allRecords.forEach(r => {
      if (r.LedgerId && !partiesMap.has(r.LedgerId)) {
        partiesMap.set(r.LedgerId, { id: r.LedgerId, name: r.PartyName || `Party #${r.LedgerId}` });
      }
      const itemKey = `${r.ItemCode}__${r.SubCode || ''}`;
      if (r.ItemCode && !itemsMap.has(itemKey)) {
        itemsMap.set(itemKey, { itemCode: r.ItemCode, subCode: r.SubCode || '', itemName: r.ItemName || r.ItemCode, unit: r.Unit || 'PCS' });
      }
    });

    // If query was filtered, also fetch all available jobwork parties and items for dropdowns
    if (targetLedgerId || targetItemCode || targetSubCode !== null) {
      const pRes = await pool.request().query(`
        SELECT DISTINCT l.Id as id, l.LedgerName as name
        FROM JobworkOutHeader h
        INNER JOIN LedgerMaster l ON h.LEDGERID = l.Id
        UNION
        SELECT DISTINCT l.Id as id, l.LedgerName as name
        FROM JobworkInHeader h
        INNER JOIN LedgerMaster l ON h.LEDGERID = l.Id
        ORDER BY name ASC
      `);
      pRes.recordset.forEach(p => {
        if (!partiesMap.has(p.id)) partiesMap.set(p.id, p);
      });

      const iRes = await pool.request().query(`
        SELECT DISTINCT i.ItemCode as itemCode, ISNULL(i.SubCode, '') as subCode, i.ItemName as itemName, i.Unit as unit
        FROM JobworkOutDetail d
        INNER JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode AND ISNULL(d.SUBCODE, '') = ISNULL(i.SubCode, '')
        UNION
        SELECT DISTINCT i.ItemCode as itemCode, ISNULL(i.SubCode, '') as subCode, i.ItemName as itemName, i.Unit as unit
        FROM JobworkInDetail d
        INNER JOIN ItemMaster i ON d.OUTITEMCODE = i.ItemCode AND ISNULL(d.OUTSUBCODE, '') = ISNULL(i.SubCode, '')
        ORDER BY itemCode ASC
      `);
      iRes.recordset.forEach(i => {
        const key = `${i.itemCode}__${i.subCode || ''}`;
        if (!itemsMap.has(key)) itemsMap.set(key, i);
      });
    }

    const startFilter = startDate ? new Date(startDate) : null;
    const endFilter = endDate ? new Date(endDate) : null;
    if (startFilter) startFilter.setHours(0, 0, 0, 0);
    if (endFilter) endFilter.setHours(23, 59, 59, 999);

    // Group into Party + Item summary
    const summaryMap = new Map();

    for (const tx of allRecords) {
      const key = `${tx.LedgerId}_${tx.ItemCode}`;
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          ledgerId: tx.LedgerId,
          partyName: tx.PartyName || 'Unknown Party',
          itemCode: tx.ItemCode,
          itemName: tx.ItemName || tx.ItemCode,
          unit: tx.Unit || 'PCS',
          openingQty: 0,
          openingWt: 0,
          outQty: 0,
          outWt: 0,
          inQty: 0,
          inWt: 0,
          scrapQty: 0,
          scrapWt: 0,
          balQty: 0,
          balWt: 0,
          lastDate: tx.TxDate,
          movementsCount: 0
        });
      }

      const item = summaryMap.get(key);
      const txDate = tx.TxDate ? new Date(tx.TxDate) : new Date('1970-01-01');

      if (startFilter && txDate < startFilter) {
        // Transactions before startDate form Opening Balance for the period
        item.openingQty += (tx.OutQty - tx.InQty);
        item.openingWt += (tx.OutWt - tx.InWt);
      } else if (!endFilter || txDate <= endFilter) {
        // Within date range
        item.outQty += tx.OutQty;
        item.outWt += tx.OutWt;
        item.inQty += tx.InQty;
        item.inWt += tx.InWt;
        item.scrapQty += tx.ScrapPcs;
        item.scrapWt += tx.ScrapWt;
        item.movementsCount += 1;
        if (tx.TxDate > item.lastDate) item.lastDate = tx.TxDate;
      }
    }

    // Finalize balances
    let totalOutQty = 0;
    let totalOutWt = 0;
    let totalInQty = 0;
    let totalInWt = 0;
    let totalScrapQty = 0;
    let totalScrapWt = 0;
    let totalBalQty = 0;
    let totalBalWt = 0;

    let partyItemSummary = [];
    summaryMap.forEach(item => {
      item.balQty = Number((item.openingQty + item.outQty - item.inQty).toFixed(2));
      item.balWt = Number((item.openingWt + item.outWt - item.inWt).toFixed(3));
      item.openingQty = Number(item.openingQty.toFixed(2));
      item.openingWt = Number(item.openingWt.toFixed(3));
      item.outQty = Number(item.outQty.toFixed(2));
      item.outWt = Number(item.outWt.toFixed(3));
      item.inQty = Number(item.inQty.toFixed(2));
      item.inWt = Number(item.inWt.toFixed(3));
      item.scrapQty = Number(item.scrapQty.toFixed(2));
      item.scrapWt = Number(item.scrapWt.toFixed(3));

      // Filter by status if specified
      if (status === 'pending' && item.balQty <= 0 && item.balWt <= 0) return;
      if (status === 'settled' && (item.balQty > 0 || item.balWt > 0)) return;

      totalOutQty += item.outQty;
      totalOutWt += item.outWt;
      totalInQty += item.inQty;
      totalInWt += item.inWt;
      totalScrapQty += item.scrapQty;
      totalScrapWt += item.scrapWt;
      totalBalQty += item.balQty;
      totalBalWt += item.balWt;

      partyItemSummary.push(item);
    });

    // Sort summary: highest pending balance first, then Party, then Item
    partyItemSummary.sort((a, b) => {
      if (b.balQty !== a.balQty) return b.balQty - a.balQty;
      return (a.partyName || '').localeCompare(b.partyName || '');
    });

    // Detailed chronological movement register
    // Sort all records chronologically: ascending date, then ascending entry timestamp
    allRecords.sort((a, b) => {
      const dateA = new Date(a.TxDate || '1970-01-01').getTime();
      const dateB = new Date(b.TxDate || '1970-01-01').getTime();
      if (dateA !== dateB) return dateA - dateB;

      const timeA = parseEntryTimestamp(a.CreatedBy);
      const timeB = parseEntryTimestamp(b.CreatedBy);
      if (timeA !== timeB) return timeA - timeB;

      return (Number(a.HeaderId) || 0) - (Number(b.HeaderId) || 0);
    });

    // Calculate running balance for each party + item line-by-line
    const runningBalTracker = new Map();
    const movementTransactions = [];

    allRecords.forEach((tx, idx) => {
      const txDate = tx.TxDate ? new Date(tx.TxDate) : new Date('1970-01-01');
      const key = `${tx.LedgerId}_${tx.ItemCode}`;

      if (!runningBalTracker.has(key)) {
        runningBalTracker.set(key, { qty: 0, wt: 0 });
      }
      const tracker = runningBalTracker.get(key);
      tracker.qty += (tx.OutQty - tx.InQty);
      tracker.wt += (tx.OutWt - tx.InWt);

      // Filter by date range for output table
      if (startFilter && txDate < startFilter) return;
      if (endFilter && txDate > endFilter) return;

      // Status filter
      const summaryItem = summaryMap.get(key);
      if (status === 'pending' && summaryItem && summaryItem.balQty <= 0 && summaryItem.balWt <= 0) return;
      if (status === 'settled' && summaryItem && (summaryItem.balQty > 0 || summaryItem.balWt > 0)) return;

      movementTransactions.push({
        id: `jw-${tx.Direction}-${tx.HeaderId}-${tx.DetailId || idx}`,
        headerId: tx.HeaderId,
        date: tx.TxDate,
        entryTime: extractEntryTime(tx.CreatedBy),
        type: tx.MovementType,
        direction: tx.Direction,
        docNo: tx.DocNo,
        refDocNo: tx.RefDocNo,
        ledgerId: tx.LedgerId,
        partyName: tx.PartyName || '',
        itemCode: tx.ItemCode,
        itemName: tx.ItemName || '',
        unit: tx.Unit || 'PCS',
        process: tx.Process || '',
        outQty: Number(tx.OutQty || 0),
        outWt: Number(Number(tx.OutWt || 0).toFixed(3)),
        inQty: Number(tx.InQty || 0),
        inWt: Number(Number(tx.InWt || 0).toFixed(3)),
        scrapQty: Number(tx.ScrapPcs || 0),
        scrapWt: Number(Number(tx.ScrapWt || 0).toFixed(3)),
        runningBalQty: Number(tracker.qty.toFixed(2)),
        runningBalWt: Number(tracker.wt.toFixed(3)),
        rate: Number(tx.Rate || 0),
        bill: Boolean(tx.Bill),
        remark: tx.Remark || '',
        createdBy: tx.CreatedBy || ''
      });
    });

    res.status(200).json({
      parties: Array.from(partiesMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      items: Array.from(itemsMap.values()).sort((a, b) => a.itemCode.localeCompare(b.itemCode)),
      summary: {
        totalOutQty: Number(totalOutQty.toFixed(2)),
        totalOutWt: Number(totalOutWt.toFixed(3)),
        totalInQty: Number(totalInQty.toFixed(2)),
        totalInWt: Number(totalInWt.toFixed(3)),
        totalScrapQty: Number(totalScrapQty.toFixed(2)),
        totalScrapWt: Number(totalScrapWt.toFixed(3)),
        balanceQty: Number(totalBalQty.toFixed(2)),
        balanceWt: Number(totalBalWt.toFixed(3)),
        totalRecords: partyItemSummary.length,
        totalTransactions: movementTransactions.length
      },
      partyItemSummary,
      movementTransactions
    });
  } catch (error) {
    console.error('Error fetching jobwork movement report:', error);
    res.status(500).json({ message: 'Server error generating jobwork movement report' });
  }
};

