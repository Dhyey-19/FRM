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
      SELECT d.*, ISNULL(d.SUBCODE, '') AS SUBCODE, d.PIDETAILID, i.ItemName
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
        h.PIID,
        h.PINO,
        l.LedgerName, 
        d.ITEMCODE, 
        ISNULL(d.SUBCODE, '') AS SUBCODE,
        d.PIDETAILID,
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
  const { Bill, INWARDNO, INWARDDATE, LEDGERID, PIID, PINO, EXPENSE, SGST, CGST, IGST, GSTPER, ROUNDOFF, TOTALAMOUNT, REMARK, CREATEDBY, Details } = req.body;

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
        .input('PIID', sql.Numeric(8,0), PIID || null)
        .input('PINO', sql.VarChar(50), PINO || null)
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
          INSERT INTO InwardHeader (Bill, INWARDNO, INWARDDATE, LEDGERID, PIID, PINO, EXPENSE, SGST, CGST, IGST, GSTPER, ROUNDOFF, TOTALAMOUNT, REMARK, CREATEDBY, UPDATEDBY)
          OUTPUT INSERTED.ID
          VALUES (@Bill, @INWARDNO, @INWARDDATE, @LEDGERID, @PIID, @PINO, @EXPENSE, @SGST, @CGST, @IGST, @GSTPER, @ROUNDOFF, @TOTALAMOUNT, @REMARK, @CREATEDBY, @UPDATEDBY)
        `);

      const newInwardId = headerRes.recordset[0].ID;

      // Insert Details and Update Item Stock
      for (const d of Details) {
        if (!d.ITEMCODE) {
          throw new Error('Item Code is required for all detail rows');
        }
        
        const subCodeVal = (d.SUBCODE || d.SubCode || '').trim();
        let piDetailId = d.PIDETAILID || d.PiDetailId || null;

        // If not specified directly but PIID is given, attempt to match PI detail
        if (!piDetailId && PIID) {
          const matchReq = new sql.Request(transaction);
          const matchRes = await matchReq
            .input('PIID', sql.Numeric(8,0), PIID)
            .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE.trim())
            .input('SUBCODE', sql.VarChar(50), subCodeVal)
            .query(`
              SELECT TOP 1 ID FROM PerformaInvoiceDetail
              WHERE PIID = @PIID AND ITEMCODE = @ITEMCODE AND ISNULL(SUBCODE, '') = @SUBCODE AND PENDINGQTY > 0
            `);
          if (matchRes.recordset.length > 0) {
            piDetailId = matchRes.recordset[0].ID;
          }
        }

        const detailReq = new sql.Request(transaction);
        await detailReq
          .input('INWARDID', sql.Numeric(8,0), newInwardId)
          .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE)
          .input('SUBCODE', sql.VarChar(50), subCodeVal)
          .input('PIDETAILID', sql.Numeric(8,0), piDetailId || null)
          .input('GROSSWT', sql.Numeric(10,3), d.GROSSWT || 0)
          .input('NETWT', sql.Numeric(10,3), d.NETWT || 0)
          .input('TENPCSWT', sql.Numeric(10,3), d.TENPCSWT || null)
          .input('QUANTITY', sql.Numeric(10,2), d.QUANTITY || 0)
          .input('UNIT', sql.VarChar(10), d.UNIT || null)
          .input('RATE', sql.Numeric(10,2), d.RATE || 0)
          .input('AMOUNT', sql.Numeric(12,2), d.AMOUNT || 0)
          .query(`
            INSERT INTO InwardDetail (INWARDID, ITEMCODE, SUBCODE, PIDETAILID, GROSSWT, NETWT, TENPCSWT, QUANTITY, UNIT, RATE, AMOUNT)
            VALUES (@INWARDID, @ITEMCODE, @SUBCODE, @PIDETAILID, @GROSSWT, @NETWT, @TENPCSWT, @QUANTITY, @UNIT, @RATE, @AMOUNT);
          `);

        await new sql.Request(transaction)
          .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE)
          .input('SUBCODE', sql.VarChar(50), subCodeVal)
          .input('NETWT', sql.Numeric(10,3), d.NETWT || 0)
          .input('QUANTITY', sql.Numeric(10,2), d.QUANTITY || 0)
          .query(`
            UPDATE ItemMaster
            SET ClosingStock = ISNULL(ClosingStock, 0) + 
              CASE 
                WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @NETWT
                ELSE @QUANTITY
              END
            WHERE ItemCode = @ITEMCODE AND ISNULL(SubCode, '') = @SUBCODE;
          `);

        // If linked to Performa Invoice Detail, update received/pending quantities
        if (piDetailId) {
          const qtyVal = parseFloat(d.QUANTITY) || 0;
          await new sql.Request(transaction)
            .input('PIDETAILID', sql.Numeric(8,0), piDetailId)
            .input('QTY', sql.Numeric(10,2), qtyVal)
            .query(`
              UPDATE PerformaInvoiceDetail
              SET RECEIVEDQTY = ISNULL(RECEIVEDQTY, 0) + @QTY,
                  PENDINGQTY = CASE WHEN (ISNULL(PENDINGQTY, 0) - @QTY) < 0 THEN 0 ELSE (ISNULL(PENDINGQTY, 0) - @QTY) END
              WHERE ID = @PIDETAILID;
            `);
        }
      }

      // Re-evaluate Performa Invoice status if PIID provided
      if (PIID) {
        const checkPiRes = await new sql.Request(transaction)
          .input('PIID', sql.Numeric(8,0), PIID)
          .query(`
            SELECT ISNULL(SUM(PENDINGQTY), 0) AS TotalPending, ISNULL(SUM(RECEIVEDQTY), 0) AS TotalReceived
            FROM PerformaInvoiceDetail
            WHERE PIID = @PIID
          `);
        if (checkPiRes.recordset.length > 0) {
          const totalPending = parseFloat(checkPiRes.recordset[0].TotalPending) || 0;
          const totalReceived = parseFloat(checkPiRes.recordset[0].TotalReceived) || 0;
          let piStatus = 'Ordered';
          if (totalPending <= 0 && totalReceived > 0) {
            piStatus = 'Completed';
          } else if (totalReceived > 0) {
            piStatus = 'Partially Received';
          }
          await new sql.Request(transaction)
            .input('PIID', sql.Numeric(8,0), PIID)
            .input('STATUS', sql.VarChar(25), piStatus)
            .query('UPDATE PerformaInvoiceHeader SET STATUS = @STATUS WHERE ID = @PIID');
        }
      }

      // 5. Generate Voucher and Update Ledgers
      const purchaseLedgerRes = await new sql.Request(transaction).query("SELECT TOP 1 Id FROM LedgerMaster WHERE UPPER(LTRIM(RTRIM(LedgerName))) = 'PURCHASE'");
      let purchaseLedgerId = purchaseLedgerRes.recordset.length > 0 ? purchaseLedgerRes.recordset[0].Id : null;

      if (!purchaseLedgerId) {
        await new sql.Request(transaction).query(`
          INSERT INTO LedgerMaster (LedgerName, AccountGroupID, OpeningBalance, ClosingBalance)
          VALUES ('Purchase', 9, 0, 0)
        `);
        const fetchPurchase = await new sql.Request(transaction).query("SELECT Id FROM LedgerMaster WHERE UPPER(LTRIM(RTRIM(LedgerName))) = 'PURCHASE'");
        purchaseLedgerId = fetchPurchase.recordset[0]?.Id;
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
        `);

      await new sql.Request(transaction)
        .input('LedgerId', sql.Numeric(10,0), purchaseLedgerId)
        .input('Amount', sql.Numeric(10,2), TOTALAMOUNT || 0)
        .query(`
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
        `);

      await new sql.Request(transaction)
        .input('LedgerId', sql.Numeric(10,0), LEDGERID)
        .input('Amount', sql.Numeric(10,2), TOTALAMOUNT || 0)
        .query(`
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
  const { Bill, INWARDNO, INWARDDATE, LEDGERID, PIID, PINO, EXPENSE, SGST, CGST, IGST, GSTPER, ROUNDOFF, TOTALAMOUNT, REMARK, UPDATEDBY, Details } = req.body;

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
      // 1. Reverse previous ledger and item stock updates, plus revert previous Performa Invoice details
      const oldDataReq = new sql.Request(transaction);
      const oldHeaderRes = await oldDataReq.input('ID', sql.Numeric(8,0), id).query('SELECT LEDGERID, TOTALAMOUNT, INWARDNO, PIID FROM InwardHeader WHERE ID = @ID');
      let oldPiId = null;

      if (oldHeaderRes.recordset.length > 0) {
        const oldHeader = oldHeaderRes.recordset[0];
        oldPiId = oldHeader.PIID;
        
        const revertVoucherReq = new sql.Request(transaction);
        await revertVoucherReq
          .input('Through', sql.VarChar(30), 'Inward')
          .input('Remark', sql.VarChar(255), oldHeader.INWARDNO)
          .query(`
            UPDATE LedgerMaster
            SET ClosingBalance = ISNULL(ClosingBalance, 0) - (
              SELECT ISNULL(SUM(CASE WHEN Mode = 'Debit' THEN Amount ELSE -Amount END), 0)
              FROM VoucherEntry
              WHERE LedgerId = LedgerMaster.Id AND Through = @Through AND Remark = @Remark
            )
            WHERE Id IN (
              SELECT LedgerId FROM VoucherEntry WHERE Through = @Through AND Remark = @Remark
            );

            DELETE FROM VoucherEntry WHERE Through = @Through AND Remark = @Remark;
          `);

        const oldDetailsReq = new sql.Request(transaction);
        const oldDetailsRes = await oldDetailsReq.input('INWARDID', sql.Numeric(8,0), id).query('SELECT ITEMCODE, ISNULL(SUBCODE, \'\') AS SUBCODE, QUANTITY, NETWT, UNIT, PIDETAILID FROM InwardDetail WHERE INWARDID = @INWARDID');
        
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

          // Revert Performa Invoice received quantity if linked
          if (oldD.PIDETAILID) {
            const oldQty = parseFloat(oldD.QUANTITY) || 0;
            await new sql.Request(transaction)
              .input('PIDETAILID', sql.Numeric(8,0), oldD.PIDETAILID)
              .input('QTY', sql.Numeric(10,2), oldQty)
              .query(`
                UPDATE PerformaInvoiceDetail
                SET RECEIVEDQTY = CASE WHEN (ISNULL(RECEIVEDQTY, 0) - @QTY) < 0 THEN 0 ELSE (ISNULL(RECEIVEDQTY, 0) - @QTY) END,
                    PENDINGQTY = ISNULL(PENDINGQTY, 0) + @QTY
                WHERE ID = @PIDETAILID;
              `);
          }
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
        .input('PIID', sql.Numeric(8,0), PIID || null)
        .input('PINO', sql.VarChar(50), PINO || null)
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
              PIID = @PIID, PINO = @PINO,
              EXPENSE = @EXPENSE, SGST = @SGST, CGST = @CGST, IGST = @IGST, GSTPER = @GSTPER, ROUNDOFF = @ROUNDOFF, 
              TOTALAMOUNT = @TOTALAMOUNT, REMARK = @REMARK, UPDATEDBY = @UPDATEDBY
          WHERE ID = @ID
        `);

      // 4. Insert New Details and Update Item Stock
      for (const d of Details) {
        if (!d.ITEMCODE) {
          throw new Error('Item Code is required for all detail rows');
        }
        
        const subCodeVal = (d.SUBCODE || d.SubCode || '').trim();
        let piDetailId = d.PIDETAILID || d.PiDetailId || null;

        if (!piDetailId && PIID) {
          const matchReq = new sql.Request(transaction);
          const matchRes = await matchReq
            .input('PIID', sql.Numeric(8,0), PIID)
            .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE.trim())
            .input('SUBCODE', sql.VarChar(50), subCodeVal)
            .query(`
              SELECT TOP 1 ID FROM PerformaInvoiceDetail
              WHERE PIID = @PIID AND ITEMCODE = @ITEMCODE AND ISNULL(SUBCODE, '') = @SUBCODE AND PENDINGQTY > 0
            `);
          if (matchRes.recordset.length > 0) {
            piDetailId = matchRes.recordset[0].ID;
          }
        }

        const detailReq = new sql.Request(transaction);
        await detailReq
          .input('INWARDID', sql.Numeric(8,0), id)
          .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE)
          .input('SUBCODE', sql.VarChar(50), subCodeVal)
          .input('PIDETAILID', sql.Numeric(8,0), piDetailId || null)
          .input('GROSSWT', sql.Numeric(10,3), d.GROSSWT || 0)
          .input('NETWT', sql.Numeric(10,3), d.NETWT || 0)
          .input('TENPCSWT', sql.Numeric(10,3), d.TENPCSWT || null)
          .input('QUANTITY', sql.Numeric(10,2), d.QUANTITY || 0)
          .input('UNIT', sql.VarChar(10), d.UNIT || null)
          .input('RATE', sql.Numeric(10,2), d.RATE || 0)
          .input('AMOUNT', sql.Numeric(12,2), d.AMOUNT || 0)
          .query(`
            INSERT INTO InwardDetail (INWARDID, ITEMCODE, SUBCODE, PIDETAILID, GROSSWT, NETWT, TENPCSWT, QUANTITY, UNIT, RATE, AMOUNT)
            VALUES (@INWARDID, @ITEMCODE, @SUBCODE, @PIDETAILID, @GROSSWT, @NETWT, @TENPCSWT, @QUANTITY, @UNIT, @RATE, @AMOUNT);

            UPDATE ItemMaster
            SET ClosingStock = ISNULL(ClosingStock, 0) + 
              CASE 
                WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @NETWT
                ELSE @QUANTITY
              END
            WHERE ItemCode = @ITEMCODE AND ISNULL(SubCode, '') = @SUBCODE;
          `);

        if (piDetailId) {
          const qtyVal = parseFloat(d.QUANTITY) || 0;
          await new sql.Request(transaction)
            .input('PIDETAILID', sql.Numeric(8,0), piDetailId)
            .input('QTY', sql.Numeric(10,2), qtyVal)
            .query(`
              UPDATE PerformaInvoiceDetail
              SET RECEIVEDQTY = ISNULL(RECEIVEDQTY, 0) + @QTY,
                  PENDINGQTY = CASE WHEN (ISNULL(PENDINGQTY, 0) - @QTY) < 0 THEN 0 ELSE (ISNULL(PENDINGQTY, 0) - @QTY) END
              WHERE ID = @PIDETAILID;
            `);
        }
      }

      // Re-evaluate affected Performa Invoice statuses
      const affectedPiIds = new Set();
      if (oldPiId) affectedPiIds.add(oldPiId);
      if (PIID) affectedPiIds.add(PIID);

      for (const affectedId of affectedPiIds) {
        const checkPiRes = await new sql.Request(transaction)
          .input('PIID', sql.Numeric(8,0), affectedId)
          .query(`
            SELECT ISNULL(SUM(PENDINGQTY), 0) AS TotalPending, ISNULL(SUM(RECEIVEDQTY), 0) AS TotalReceived
            FROM PerformaInvoiceDetail
            WHERE PIID = @PIID
          `);
        if (checkPiRes.recordset.length > 0) {
          const totalPending = parseFloat(checkPiRes.recordset[0].TotalPending) || 0;
          const totalReceived = parseFloat(checkPiRes.recordset[0].TotalReceived) || 0;
          let piStatus = 'Ordered';
          if (totalPending <= 0 && totalReceived > 0) {
            piStatus = 'Completed';
          } else if (totalReceived > 0) {
            piStatus = 'Partially Received';
          }
          await new sql.Request(transaction)
            .input('PIID', sql.Numeric(8,0), affectedId)
            .input('STATUS', sql.VarChar(25), piStatus)
            .query('UPDATE PerformaInvoiceHeader SET STATUS = @STATUS WHERE ID = @PIID');
        }
      }

      // 5. Generate Voucher and Update Ledgers
      const purchaseLedgerRes = await new sql.Request(transaction).query("SELECT TOP 1 Id FROM LedgerMaster WHERE UPPER(LTRIM(RTRIM(LedgerName))) = 'PURCHASE'");
      let purchaseLedgerId = purchaseLedgerRes.recordset.length > 0 ? purchaseLedgerRes.recordset[0].Id : null;

      if (!purchaseLedgerId) {
        await new sql.Request(transaction).query(`
          INSERT INTO LedgerMaster (LedgerName, AccountGroupID, OpeningBalance, ClosingBalance)
          VALUES ('Purchase', 9, 0, 0)
        `);
        const fetchPurchase = await new sql.Request(transaction).query("SELECT Id FROM LedgerMaster WHERE UPPER(LTRIM(RTRIM(LedgerName))) = 'PURCHASE'");
        purchaseLedgerId = fetchPurchase.recordset[0]?.Id;
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
      // 1. Reverse previous ledger and item stock updates, plus revert Performa Invoice quantities
      const oldDataReq = new sql.Request(transaction);
      const oldHeaderRes = await oldDataReq.input('ID', sql.Numeric(8,0), id).query('SELECT LEDGERID, TOTALAMOUNT, INWARDNO, PIID FROM InwardHeader WHERE ID = @ID');
      let oldPiId = null;

      if (oldHeaderRes.recordset.length > 0) {
        const oldHeader = oldHeaderRes.recordset[0];
        oldPiId = oldHeader.PIID;
        
        const revertVoucherReq = new sql.Request(transaction);
        await revertVoucherReq
          .input('Through', sql.VarChar(30), 'Inward')
          .input('Remark', sql.VarChar(255), oldHeader.INWARDNO)
          .query(`
            UPDATE LedgerMaster
            SET ClosingBalance = ISNULL(ClosingBalance, 0) - (
              SELECT ISNULL(SUM(CASE WHEN Mode = 'Debit' THEN Amount ELSE -Amount END), 0)
              FROM VoucherEntry
              WHERE LedgerId = LedgerMaster.Id AND Through = @Through AND Remark = @Remark
            )
            WHERE Id IN (
              SELECT LedgerId FROM VoucherEntry WHERE Through = @Through AND Remark = @Remark
            );

            DELETE FROM VoucherEntry WHERE Through = @Through AND Remark = @Remark;
          `);

        const oldDetailsReq = new sql.Request(transaction);
        const oldDetailsRes = await oldDetailsReq.input('INWARDID', sql.Numeric(8,0), id).query('SELECT ITEMCODE, ISNULL(SUBCODE, \'\') AS SUBCODE, QUANTITY, NETWT, UNIT, PIDETAILID FROM InwardDetail WHERE INWARDID = @INWARDID');
        
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

          // Revert Performa Invoice detail received quantity
          if (oldD.PIDETAILID) {
            const oldQty = parseFloat(oldD.QUANTITY) || 0;
            await new sql.Request(transaction)
              .input('PIDETAILID', sql.Numeric(8,0), oldD.PIDETAILID)
              .input('QTY', sql.Numeric(10,2), oldQty)
              .query(`
                UPDATE PerformaInvoiceDetail
                SET RECEIVEDQTY = CASE WHEN (ISNULL(RECEIVEDQTY, 0) - @QTY) < 0 THEN 0 ELSE (ISNULL(RECEIVEDQTY, 0) - @QTY) END,
                    PENDINGQTY = ISNULL(PENDINGQTY, 0) + @QTY
                WHERE ID = @PIDETAILID;
              `);
          }
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

      // Re-evaluate Performa Invoice status if old PI existed
      if (oldPiId) {
        const checkPiRes = await new sql.Request(transaction)
          .input('PIID', sql.Numeric(8,0), oldPiId)
          .query(`
            SELECT ISNULL(SUM(PENDINGQTY), 0) AS TotalPending, ISNULL(SUM(RECEIVEDQTY), 0) AS TotalReceived
            FROM PerformaInvoiceDetail
            WHERE PIID = @PIID
          `);
        if (checkPiRes.recordset.length > 0) {
          const totalPending = parseFloat(checkPiRes.recordset[0].TotalPending) || 0;
          const totalReceived = parseFloat(checkPiRes.recordset[0].TotalReceived) || 0;
          let piStatus = 'Ordered';
          if (totalPending <= 0 && totalReceived > 0) {
            piStatus = 'Completed';
          } else if (totalReceived > 0) {
            piStatus = 'Partially Received';
          }
          await new sql.Request(transaction)
            .input('PIID', sql.Numeric(8,0), oldPiId)
            .input('STATUS', sql.VarChar(25), piStatus)
            .query('UPDATE PerformaInvoiceHeader SET STATUS = @STATUS WHERE ID = @PIID');
        }
      }

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
