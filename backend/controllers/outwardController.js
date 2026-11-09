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
    const { outwardNo, id } = req.query;
    const pool = await connectDB();
    const headerReq = pool.request();
    let headerQuery = `
      SELECT h.*, l.LedgerName, l.City, l.State, l.MobileNo,
             ISNULL(l.DeliveryDays, 0) AS DeliveryDays,
             l.Transport AS DefaultTransport
      FROM OutwardHeader h
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
    `;

    if (outwardNo) {
      headerQuery += ' WHERE h.OUTWARDNO = @OutwardNo';
      headerReq.input('OutwardNo', sql.VarChar(50), outwardNo.trim());
    } else if (id) {
      headerQuery += ' WHERE h.ID = @HeaderId';
      headerReq.input('HeaderId', sql.Numeric(8, 0), id);
    }

    headerQuery += `
      ORDER BY 
        CASE WHEN TRY_CAST(h.OUTWARDNO AS INT) IS NOT NULL THEN 0 ELSE 1 END,
        TRY_CAST(h.OUTWARDNO AS INT) DESC,
        h.OUTWARDNO DESC
    `;

    const headerResult = await headerReq.query(headerQuery);
    
    // Fetch OutwardDetails
    const detailResult = await pool.request().query(`
      SELECT d.*, ISNULL(d.SUBCODE, '') AS SUBCODE, d.PODETAILID, i.ItemName, i.HSNCode
      FROM OutwardDetail d
      LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode AND ISNULL(d.SUBCODE, '') = ISNULL(i.SubCode, '')
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
        h.ID as OutwardHeaderId,
        h.OUTWARDNO, 
        h.OUTWARDDATE, 
        h.POID,
        h.PONO,
        h.IRN,
        h.AckNo,
        h.AckDate,
        h.EInvoiceStatus,
        h.CourierCompany,
        h.AwbNo,
        h.TransportMode,
        h.DateOfPod,
        h.PodRemarks,
        l.LedgerName, 
        l.City,
        l.State,
        ISNULL(l.DeliveryDays, 0) AS DeliveryDays,
        d.ITEMCODE, 
        ISNULL(d.SUBCODE, '') AS SUBCODE,
        d.PODETAILID,
        i.ItemName, 
        i.HSNCode,
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
      LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode AND ISNULL(d.SUBCODE, '') = ISNULL(i.SubCode, '')
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
  const { 
    Bill, OUTWARDNO, OUTWARDDATE, LEDGERID, EXPENSE, CDPER, CDAMOUNT, 
    SGST, CGST, IGST, GSTPER, ROUNDOFF, TOTALAMOUNT, REMARK, CREATEDBY, 
    POID, PONO, CourierCompany, AwbNo, TransportMode, DateOfPod, PodRemarks, Details 
  } = req.body;

  if (!OUTWARDNO || !OUTWARDDATE || !LEDGERID || !Details || !Array.isArray(Details) || Details.length === 0) {
    return res.status(400).json({ message: 'OutwardNo, Date, Ledger, and at least one detail row are required' });
  }

  let pool;
  try {
    pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Resolve PONO if POID is provided but PONO is missing
      let resolvedPoId = POID ? parseInt(POID, 10) : null;
      let resolvedPoNo = PONO || null;
      if (resolvedPoId && !resolvedPoNo) {
        const poRes = await new sql.Request(transaction)
          .input('PoId', sql.Numeric(8, 0), resolvedPoId)
          .query('SELECT PONO FROM PurchaseOrderHeader WHERE ID = @PoId');
        if (poRes.recordset.length > 0) {
          resolvedPoNo = poRes.recordset[0].PONO;
        }
      }

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
        .input('POID', sql.Numeric(8, 0), resolvedPoId)
        .input('PONO', sql.VarChar(50), resolvedPoNo)
        .input('CourierCompany', sql.VarChar(100), CourierCompany ? String(CourierCompany).trim() : null)
        .input('AwbNo', sql.VarChar(100), AwbNo ? String(AwbNo).trim() : null)
        .input('TransportMode', sql.VarChar(50), TransportMode ? String(TransportMode).trim() : null)
        .input('DateOfPod', sql.VarChar(20), DateOfPod ? String(DateOfPod).trim() : null)
        .input('PodRemarks', sql.VarChar(255), PodRemarks ? String(PodRemarks).trim() : null)
        .query(`
          INSERT INTO OutwardHeader (
            Bill, OUTWARDNO, OUTWARDDATE, LEDGERID, EXPENSE, CDPER, CDAMOUNT, SGST, CGST, IGST, GSTPER, ROUNDOFF, TOTALAMOUNT, REMARK, CREATEDBY, UPDATEDBY, POID, PONO,
            CourierCompany, AwbNo, TransportMode, DateOfPod, PodRemarks
          )
          OUTPUT INSERTED.ID
          VALUES (
            @Bill, @OUTWARDNO, @OUTWARDDATE, @LEDGERID, @EXPENSE, @CDPER, @CDAMOUNT, @SGST, @CGST, @IGST, @GSTPER, @ROUNDOFF, @TOTALAMOUNT, @REMARK, @CREATEDBY, @UPDATEDBY, @POID, @PONO,
            @CourierCompany, @AwbNo, @TransportMode, @DateOfPod, @PodRemarks
          )
        `);

      const newOutwardId = headerRes.recordset[0].ID;

      // Insert Details and Update Item Stock & Purchase Order
      for (const d of Details) {
        if (!d.ITEMCODE) {
          throw new Error('Item Code is required for all detail rows');
        }
        
        const subCodeVal = (d.SUBCODE || d.SubCode || '').trim();
        const qtyVal = parseFloat(d.QUANTITY) || 0;

        // Determine if linked to PO Detail
        let poDetailId = d.PODETAILID ? parseInt(d.PODETAILID, 10) : null;
        if (!poDetailId && resolvedPoId) {
          const matchPoDetail = await new sql.Request(transaction)
            .input('POID', sql.Numeric(8, 0), resolvedPoId)
            .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE.trim())
            .input('SUBCODE', sql.VarChar(50), subCodeVal)
            .query(`
              SELECT TOP 1 ID FROM PurchaseOrderDetail 
              WHERE POID = @POID AND UPPER(LTRIM(RTRIM(ITEMCODE))) = UPPER(LTRIM(RTRIM(@ITEMCODE))) 
                AND ISNULL(SUBCODE, '') = @SUBCODE AND PENDINGQTY > 0
            `);
          if (matchPoDetail.recordset.length > 0) {
            poDetailId = matchPoDetail.recordset[0].ID;
          }
        }

        const detailReq = new sql.Request(transaction);
        await detailReq
          .input('OUTWARDID', sql.Numeric(8,0), newOutwardId)
          .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE)
          .input('SUBCODE', sql.VarChar(50), subCodeVal)
          .input('GROSSWT', sql.Numeric(10,3), d.GROSSWT || 0)
          .input('NETWT', sql.Numeric(10,3), d.NETWT || 0)
          .input('TENPCSWT', sql.Numeric(10,3), d.TENPCSWT || null)
          .input('QUANTITY', sql.Numeric(10,2), qtyVal)
          .input('UNIT', sql.VarChar(10), d.UNIT || null)
          .input('RATE', sql.Numeric(10,2), d.RATE || 0)
          .input('DISCOUNT', sql.Numeric(5,2), d.DISCOUNT || 0)
          .input('AMOUNT', sql.Numeric(12,2), d.AMOUNT || 0)
          .input('PODETAILID', sql.Numeric(8, 0), poDetailId)
          .query(`
            INSERT INTO OutwardDetail (OUTWARDID, ITEMCODE, SUBCODE, GROSSWT, NETWT, TENPCSWT, QUANTITY, UNIT, RATE, DISCOUNT, AMOUNT, PODETAILID)
            VALUES (@OUTWARDID, @ITEMCODE, @SUBCODE, @GROSSWT, @NETWT, @TENPCSWT, @QUANTITY, @UNIT, @RATE, @DISCOUNT, @AMOUNT, @PODETAILID);

            UPDATE ItemMaster
            SET ClosingStock = ISNULL(ClosingStock, 0) - 
              CASE 
                WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @NETWT
                ELSE @QUANTITY
              END
            WHERE ItemCode = @ITEMCODE AND ISNULL(SubCode, '') = @SUBCODE;
          `);

        // If linked to PO detail, reduce PO pending quantity and increase delivered quantity
        if (poDetailId) {
          await new sql.Request(transaction)
            .input('PODETAILID', sql.Numeric(8, 0), poDetailId)
            .input('DELIVER_QTY', sql.Numeric(10, 2), qtyVal)
            .query(`
              UPDATE PurchaseOrderDetail
              SET DELIVEREDQTY = DELIVEREDQTY + @DELIVER_QTY,
                  PENDINGQTY = CASE WHEN (PENDINGQTY - @DELIVER_QTY) < 0 THEN 0 ELSE (PENDINGQTY - @DELIVER_QTY) END
              WHERE ID = @PODETAILID;
            `);
        }
      }

      // If linked to PO, recalculate PO status
      if (resolvedPoId) {
        await new sql.Request(transaction)
          .input('POID', sql.Numeric(8, 0), resolvedPoId)
          .query(`
            UPDATE PurchaseOrderHeader
            SET STATUS = CASE 
              WHEN (SELECT ISNULL(SUM(PENDINGQTY), 0) FROM PurchaseOrderDetail WHERE POID = @POID) <= 0 THEN 'Completed'
              WHEN (SELECT ISNULL(SUM(DELIVEREDQTY), 0) FROM PurchaseOrderDetail WHERE POID = @POID) > 0 THEN 'Partially Fulfilled'
              ELSE 'Pending'
            END
            WHERE ID = @POID;
          `);
      }

      // 5. Generate Voucher and Update Ledgers
      const salesLedgerRes = await new sql.Request(transaction).query("SELECT TOP 1 Id FROM LedgerMaster WHERE UPPER(LTRIM(RTRIM(LedgerName))) = 'SALES'");
      let salesLedgerId = salesLedgerRes.recordset.length > 0 ? salesLedgerRes.recordset[0].Id : null;

      if (!salesLedgerId) {
        await new sql.Request(transaction).query(`
          INSERT INTO LedgerMaster (LedgerName, AccountGroupID, OpeningBalance, ClosingBalance)
          VALUES ('Sales', 8, 0, 0)
        `);
        const fetchSales = await new sql.Request(transaction).query("SELECT Id FROM LedgerMaster WHERE UPPER(LTRIM(RTRIM(LedgerName))) = 'SALES'");
        salesLedgerId = fetchSales.recordset[0]?.Id;
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
  const { 
    Bill, OUTWARDNO, OUTWARDDATE, LEDGERID, EXPENSE, CDPER, CDAMOUNT, 
    SGST, CGST, IGST, GSTPER, ROUNDOFF, TOTALAMOUNT, REMARK, UPDATEDBY, 
    POID, PONO, CourierCompany, AwbNo, TransportMode, DateOfPod, PodRemarks, Details 
  } = req.body;

  if (!OUTWARDNO || !OUTWARDDATE || !LEDGERID || !Details || !Array.isArray(Details) || Details.length === 0) {
    return res.status(400).json({ message: 'OutwardNo, Date, Ledger, and at least one detail row are required' });
  }

  let pool;
  try {
    pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Reverse previous ledger, item stock, and PO updates
      const oldDataReq = new sql.Request(transaction);
      const oldHeaderRes = await oldDataReq.input('ID', sql.Numeric(8,0), id).query('SELECT LEDGERID, TOTALAMOUNT, OUTWARDNO, POID FROM OutwardHeader WHERE ID = @ID');
      
      let oldPoId = null;
      if (oldHeaderRes.recordset.length > 0) {
        const oldHeader = oldHeaderRes.recordset[0];
        oldPoId = oldHeader.POID ? parseInt(oldHeader.POID, 10) : null;
        
        const revertVoucherReq = new sql.Request(transaction);
        await revertVoucherReq
          .input('Through', sql.VarChar(30), 'Outward')
          .input('Remark', sql.VarChar(255), oldHeader.OUTWARDNO)
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
        const oldDetailsRes = await oldDetailsReq.input('OUTWARDID', sql.Numeric(8,0), id).query('SELECT ITEMCODE, ISNULL(SUBCODE, \'\') AS SUBCODE, QUANTITY, NETWT, UNIT, PODETAILID FROM OutwardDetail WHERE OUTWARDID = @OUTWARDID');
        
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
              SET ClosingStock = ISNULL(ClosingStock, 0) + 
                CASE 
                  WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @OLD_NETWT
                  ELSE @OLD_QUANTITY
                END
              WHERE ItemCode = @OLD_ITEMCODE AND ISNULL(SubCode, '') = @OLD_SUBCODE;
            `);

          // Reverse previous PO detail fulfillment
          if (oldD.PODETAILID) {
            await new sql.Request(transaction)
              .input('PODETAILID', sql.Numeric(8, 0), oldD.PODETAILID)
              .input('OLD_QUANTITY', sql.Numeric(10, 2), oldD.QUANTITY)
              .query(`
                UPDATE PurchaseOrderDetail
                SET DELIVEREDQTY = CASE WHEN (DELIVEREDQTY - @OLD_QUANTITY) < 0 THEN 0 ELSE (DELIVEREDQTY - @OLD_QUANTITY) END,
                    PENDINGQTY = CASE WHEN (PENDINGQTY + @OLD_QUANTITY) > QUANTITY THEN QUANTITY ELSE (PENDINGQTY + @OLD_QUANTITY) END
                WHERE ID = @PODETAILID;
              `);
          }
        }

        // Recompute old PO status if linked
        if (oldPoId) {
          await new sql.Request(transaction)
            .input('POID', sql.Numeric(8, 0), oldPoId)
            .query(`
              UPDATE PurchaseOrderHeader
              SET STATUS = CASE 
                WHEN (SELECT ISNULL(SUM(PENDINGQTY), 0) FROM PurchaseOrderDetail WHERE POID = @POID) <= 0 THEN 'Completed'
                WHEN (SELECT ISNULL(SUM(DELIVEREDQTY), 0) FROM PurchaseOrderDetail WHERE POID = @POID) > 0 THEN 'Partially Fulfilled'
                ELSE 'Pending'
              END
              WHERE ID = @POID;
            `);
        }
      }

      // 2. Delete old details
      const deleteDetailsReq = new sql.Request(transaction);
      await deleteDetailsReq.input('OUTWARDID', sql.Numeric(8,0), id).query('DELETE FROM OutwardDetail WHERE OUTWARDID = @OUTWARDID');

      // Resolve new PO No if POID is provided
      let resolvedPoId = POID ? parseInt(POID, 10) : null;
      let resolvedPoNo = PONO || null;
      if (resolvedPoId && !resolvedPoNo) {
        const poRes = await new sql.Request(transaction)
          .input('PoId', sql.Numeric(8, 0), resolvedPoId)
          .query('SELECT PONO FROM PurchaseOrderHeader WHERE ID = @PoId');
        if (poRes.recordset.length > 0) {
          resolvedPoNo = poRes.recordset[0].PONO;
        }
      }

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
        .input('POID', sql.Numeric(8, 0), resolvedPoId)
        .input('PONO', sql.VarChar(50), resolvedPoNo)
        .input('CourierCompany', sql.VarChar(100), CourierCompany ? String(CourierCompany).trim() : null)
        .input('AwbNo', sql.VarChar(100), AwbNo ? String(AwbNo).trim() : null)
        .input('TransportMode', sql.VarChar(50), TransportMode ? String(TransportMode).trim() : null)
        .input('DateOfPod', sql.VarChar(20), DateOfPod ? String(DateOfPod).trim() : null)
        .input('PodRemarks', sql.VarChar(255), PodRemarks ? String(PodRemarks).trim() : null)
        .query(`
          UPDATE OutwardHeader 
          SET Bill = @Bill, OUTWARDNO = @OUTWARDNO, OUTWARDDATE = @OUTWARDDATE, LEDGERID = @LEDGERID, 
              EXPENSE = @EXPENSE, CDPER = @CDPER, CDAMOUNT = @CDAMOUNT, SGST = @SGST, CGST = @CGST, IGST = @IGST, 
              GSTPER = @GSTPER, ROUNDOFF = @ROUNDOFF, TOTALAMOUNT = @TOTALAMOUNT, REMARK = @REMARK, UPDATEDBY = @UPDATEDBY,
              POID = @POID, PONO = @PONO,
              CourierCompany = @CourierCompany, AwbNo = @AwbNo, TransportMode = @TransportMode,
              DateOfPod = @DateOfPod, PodRemarks = @PodRemarks
          WHERE ID = @ID
        `);

      // 4. Insert New Details and Update Item Stock & PO
      for (const d of Details) {
        if (!d.ITEMCODE) {
          throw new Error('Item Code is required for all detail rows');
        }
        
        const subCodeVal = (d.SUBCODE || d.SubCode || '').trim();
        const qtyVal = parseFloat(d.QUANTITY) || 0;

        // Determine if linked to PO Detail
        let poDetailId = d.PODETAILID ? parseInt(d.PODETAILID, 10) : null;
        if (!poDetailId && resolvedPoId) {
          const matchPoDetail = await new sql.Request(transaction)
            .input('POID', sql.Numeric(8, 0), resolvedPoId)
            .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE.trim())
            .input('SUBCODE', sql.VarChar(50), subCodeVal)
            .query(`
              SELECT TOP 1 ID FROM PurchaseOrderDetail 
              WHERE POID = @POID AND UPPER(LTRIM(RTRIM(ITEMCODE))) = UPPER(LTRIM(RTRIM(@ITEMCODE))) 
                AND ISNULL(SUBCODE, '') = @SUBCODE AND PENDINGQTY > 0
            `);
          if (matchPoDetail.recordset.length > 0) {
            poDetailId = matchPoDetail.recordset[0].ID;
          }
        }

        const detailReq = new sql.Request(transaction);
        await detailReq
          .input('OUTWARDID', sql.Numeric(8,0), id)
          .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE)
          .input('SUBCODE', sql.VarChar(50), subCodeVal)
          .input('GROSSWT', sql.Numeric(10,3), d.GROSSWT || 0)
          .input('NETWT', sql.Numeric(10,3), d.NETWT || 0)
          .input('TENPCSWT', sql.Numeric(10,3), d.TENPCSWT || null)
          .input('QUANTITY', sql.Numeric(10,2), qtyVal)
          .input('UNIT', sql.VarChar(10), d.UNIT || null)
          .input('RATE', sql.Numeric(10,2), d.RATE || 0)
          .input('DISCOUNT', sql.Numeric(5,2), d.DISCOUNT || 0)
          .input('AMOUNT', sql.Numeric(12,2), d.AMOUNT || 0)
          .input('PODETAILID', sql.Numeric(8, 0), poDetailId)
          .query(`
            INSERT INTO OutwardDetail (OUTWARDID, ITEMCODE, SUBCODE, GROSSWT, NETWT, TENPCSWT, QUANTITY, UNIT, RATE, DISCOUNT, AMOUNT, PODETAILID)
            VALUES (@OUTWARDID, @ITEMCODE, @SUBCODE, @GROSSWT, @NETWT, @TENPCSWT, @QUANTITY, @UNIT, @RATE, @DISCOUNT, @AMOUNT, @PODETAILID);

            UPDATE ItemMaster
            SET ClosingStock = ISNULL(ClosingStock, 0) - 
              CASE 
                WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @NETWT
                ELSE @QUANTITY
              END
            WHERE ItemCode = @ITEMCODE AND ISNULL(SubCode, '') = @SUBCODE;
          `);

        if (poDetailId) {
          await new sql.Request(transaction)
            .input('PODETAILID', sql.Numeric(8, 0), poDetailId)
            .input('DELIVER_QTY', sql.Numeric(10, 2), qtyVal)
            .query(`
              UPDATE PurchaseOrderDetail
              SET DELIVEREDQTY = DELIVEREDQTY + @DELIVER_QTY,
                  PENDINGQTY = CASE WHEN (PENDINGQTY - @DELIVER_QTY) < 0 THEN 0 ELSE (PENDINGQTY - @DELIVER_QTY) END
              WHERE ID = @PODETAILID;
            `);
        }
      }

      // Recompute new PO status if linked
      if (resolvedPoId) {
        await new sql.Request(transaction)
          .input('POID', sql.Numeric(8, 0), resolvedPoId)
          .query(`
            UPDATE PurchaseOrderHeader
            SET STATUS = CASE 
              WHEN (SELECT ISNULL(SUM(PENDINGQTY), 0) FROM PurchaseOrderDetail WHERE POID = @POID) <= 0 THEN 'Completed'
              WHEN (SELECT ISNULL(SUM(DELIVEREDQTY), 0) FROM PurchaseOrderDetail WHERE POID = @POID) > 0 THEN 'Partially Fulfilled'
              ELSE 'Pending'
            END
            WHERE ID = @POID;
          `);
      }

      // 5. Generate Voucher and Update Ledgers
      const salesLedgerRes = await new sql.Request(transaction).query("SELECT TOP 1 Id FROM LedgerMaster WHERE UPPER(LTRIM(RTRIM(LedgerName))) = 'SALES'");
      let salesLedgerId = salesLedgerRes.recordset.length > 0 ? salesLedgerRes.recordset[0].Id : null;

      if (!salesLedgerId) {
        await new sql.Request(transaction).query(`
          INSERT INTO LedgerMaster (LedgerName, AccountGroupID, OpeningBalance, ClosingBalance)
          VALUES ('Sales', 8, 0, 0)
        `);
        const fetchSales = await new sql.Request(transaction).query("SELECT Id FROM LedgerMaster WHERE UPPER(LTRIM(RTRIM(LedgerName))) = 'SALES'");
        salesLedgerId = fetchSales.recordset[0]?.Id;
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
      // 1. Reverse previous ledger, item stock, and PO updates
      const oldDataReq = new sql.Request(transaction);
      const oldHeaderRes = await oldDataReq.input('ID', sql.Numeric(8,0), id).query('SELECT LEDGERID, TOTALAMOUNT, OUTWARDNO, POID FROM OutwardHeader WHERE ID = @ID');
      
      if (oldHeaderRes.recordset.length > 0) {
        const oldHeader = oldHeaderRes.recordset[0];
        const oldPoId = oldHeader.POID ? parseInt(oldHeader.POID, 10) : null;
        
        const revertVoucherReq = new sql.Request(transaction);
        await revertVoucherReq
          .input('Through', sql.VarChar(30), 'Outward')
          .input('Remark', sql.VarChar(255), oldHeader.OUTWARDNO)
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
        const oldDetailsRes = await oldDetailsReq.input('OUTWARDID', sql.Numeric(8,0), id).query('SELECT ITEMCODE, ISNULL(SUBCODE, \'\') AS SUBCODE, QUANTITY, NETWT, UNIT, PODETAILID FROM OutwardDetail WHERE OUTWARDID = @OUTWARDID');
        
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
              SET ClosingStock = ISNULL(ClosingStock, 0) + 
                CASE 
                  WHEN UPPER(Unit) IN ('KG', 'KGS') THEN @OLD_NETWT
                  ELSE @OLD_QUANTITY
                END
              WHERE ItemCode = @OLD_ITEMCODE AND ISNULL(SubCode, '') = @OLD_SUBCODE;
            `);

          if (oldD.PODETAILID) {
            await new sql.Request(transaction)
              .input('PODETAILID', sql.Numeric(8, 0), oldD.PODETAILID)
              .input('OLD_QUANTITY', sql.Numeric(10, 2), oldD.QUANTITY)
              .query(`
                UPDATE PurchaseOrderDetail
                SET DELIVEREDQTY = CASE WHEN (DELIVEREDQTY - @OLD_QUANTITY) < 0 THEN 0 ELSE (DELIVEREDQTY - @OLD_QUANTITY) END,
                    PENDINGQTY = CASE WHEN (PENDINGQTY + @OLD_QUANTITY) > QUANTITY THEN QUANTITY ELSE (PENDINGQTY + @OLD_QUANTITY) END
                WHERE ID = @PODETAILID;
              `);
          }
        }

        if (oldPoId) {
          await new sql.Request(transaction)
            .input('POID', sql.Numeric(8, 0), oldPoId)
            .query(`
              UPDATE PurchaseOrderHeader
              SET STATUS = CASE 
                WHEN (SELECT ISNULL(SUM(PENDINGQTY), 0) FROM PurchaseOrderDetail WHERE POID = @POID) <= 0 THEN 'Completed'
                WHEN (SELECT ISNULL(SUM(DELIVEREDQTY), 0) FROM PurchaseOrderDetail WHERE POID = @POID) > 0 THEN 'Partially Fulfilled'
                ELSE 'Pending'
              END
              WHERE ID = @POID;
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

// PATCH /api/outwards/:id/pod
// Quick update for Courier Company, AWB No., Transport Mode, Date of POD, Remarks
exports.updateOutwardPod = async (req, res) => {
  const { id } = req.params;
  const { CourierCompany, AwbNo, TransportMode, DateOfPod, PodRemarks } = req.body;

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('ID', sql.Numeric(8, 0), id)
      .input('CourierCompany', sql.VarChar(100), CourierCompany ? String(CourierCompany).trim() : null)
      .input('AwbNo', sql.VarChar(100), AwbNo ? String(AwbNo).trim() : null)
      .input('TransportMode', sql.VarChar(50), TransportMode ? String(TransportMode).trim() : null)
      .input('DateOfPod', sql.VarChar(20), DateOfPod ? String(DateOfPod).trim() : null)
      .input('PodRemarks', sql.VarChar(255), PodRemarks ? String(PodRemarks).trim() : null)
      .query(`
        UPDATE OutwardHeader
        SET CourierCompany = @CourierCompany,
            AwbNo = @AwbNo,
            TransportMode = @TransportMode,
            DateOfPod = @DateOfPod,
            PodRemarks = @PodRemarks
        WHERE ID = @ID
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Outward record not found' });
    }

    res.status(200).json({ 
      success: true,
      message: 'Dispatch and POD details updated successfully',
      podData: {
        CourierCompany: CourierCompany || null,
        AwbNo: AwbNo || null,
        TransportMode: TransportMode || null,
        DateOfPod: DateOfPod || null,
        PodRemarks: PodRemarks || null
      }
    });
  } catch (error) {
    console.error('Error updating outward POD details:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// GET /api/outwards/pending-pod
// Dedicated report of invoices where Date of POD is NOT entered (pending delivery)
exports.getPendingPodReport = async (req, res) => {
  try {
    const { fromDate, toDate, ledgerId, courierCompany, isOverdue, search } = req.query;
    const pool = await connectDB();
    const request = pool.request();

    let query = `
      SELECT 
        h.ID,
        h.OUTWARDNO,
        h.OUTWARDDATE,
        h.LEDGERID,
        l.LedgerName,
        l.City,
        l.State,
        l.MobileNo,
        l.Transport AS DefaultTransport,
        ISNULL(l.DeliveryDays, 0) AS DeliveryDays,
        h.CourierCompany,
        h.AwbNo,
        h.TransportMode,
        h.DateOfPod,
        h.PodRemarks,
        h.Bill,
        h.TOTALAMOUNT,
        h.REMARK
      FROM OutwardHeader h
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      WHERE (h.DateOfPod IS NULL OR TRIM(h.DateOfPod) = '' OR h.DateOfPod = '-')
    `;

    if (fromDate) {
      query += ' AND h.OUTWARDDATE >= @FromDate';
      request.input('FromDate', sql.Date, fromDate);
    }
    if (toDate) {
      query += ' AND h.OUTWARDDATE <= @ToDate';
      request.input('ToDate', sql.Date, toDate);
    }
    if (ledgerId && ledgerId !== 'ALL') {
      query += ' AND h.LEDGERID = @LedgerId';
      request.input('LedgerId', sql.Numeric(10, 0), ledgerId);
    }
    if (courierCompany && courierCompany !== 'ALL') {
      query += ' AND UPPER(h.CourierCompany) = UPPER(@CourierCompany)';
      request.input('CourierCompany', sql.VarChar(100), courierCompany);
    }
    if (search && search.trim()) {
      query += ' AND (h.OUTWARDNO LIKE @Search OR l.LedgerName LIKE @Search OR h.AwbNo LIKE @Search OR l.City LIKE @Search)';
      request.input('Search', sql.VarChar(100), `%${search.trim()}%`);
    }

    query += `
      ORDER BY 
        h.OUTWARDDATE ASC,
        CASE WHEN TRY_CAST(h.OUTWARDNO AS INT) IS NOT NULL THEN 0 ELSE 1 END,
        TRY_CAST(h.OUTWARDNO AS INT) ASC,
        h.OUTWARDNO ASC
    `;

    const result = await request.query(query);
    const records = result.recordset || [];

    // Helper to safely add days to YYYY-MM-DD string without UTC timezone drift
    const addDaysToDateStr = (dateStr, days) => {
      if (!dateStr) return '';
      const parts = String(dateStr).split('T')[0].split('-');
      if (parts.length < 3) return dateStr;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dt = new Date(y, m, d);
      dt.setDate(dt.getDate() + (parseInt(days, 10) || 0));
      const resY = dt.getFullYear();
      const resM = String(dt.getMonth() + 1).padStart(2, '0');
      const resD = String(dt.getDate()).padStart(2, '0');
      return `${resY}-${resM}-${resD}`;
    };

    // Helper to parse YYYY-MM-DD to local Date at midnight
    const parseLocalDate = (dateStr) => {
      if (!dateStr) return null;
      const parts = String(dateStr).split('T')[0].split('-');
      if (parts.length < 3) return null;
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const enriched = records.map(r => {
      const invDateStr = String(r.OUTWARDDATE || '').split('T')[0];
      const invDate = parseLocalDate(invDateStr);
      const deliveryDays = parseInt(r.DeliveryDays, 10) || 0;

      // Expected Delivery Date: invDateStr + deliveryDays
      const expectedDateStr = invDate ? addDaysToDateStr(invDateStr, deliveryDays) : '';
      const expectedDeliveryDate = parseLocalDate(expectedDateStr);

      // Days Elapsed since Invoice Date
      let daysElapsed = 0;
      if (invDate) {
        const diffTime = today.getTime() - invDate.getTime();
        daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      // Overdue calculation
      let isOverdueBool = false;
      let overdueDays = 0;
      let daysRemaining = 0;

      if (expectedDeliveryDate) {
        const diffExp = today.getTime() - expectedDeliveryDate.getTime();
        const diffDays = Math.floor(diffExp / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          isOverdueBool = true;
          overdueDays = diffDays;
        } else {
          daysRemaining = Math.abs(diffDays);
        }
      }

      let status = 'Pending POD';
      if (!r.AwbNo && !r.CourierCompany) {
        status = 'Not Dispatched';
      } else if (isOverdueBool) {
        status = `Overdue (${overdueDays}d late)`;
      } else if (daysRemaining === 0) {
        status = 'Delivery Due Today';
      } else {
        status = `In Transit (${daysRemaining}d left)`;
      }

      return {
        ...r,
        OUTWARDDATE: invDateStr,
        ExpectedDeliveryDays: deliveryDays,
        ExpectedDeliveryDate: expectedDateStr,
        DaysElapsed: daysElapsed >= 0 ? daysElapsed : 0,
        IsOverdue: isOverdueBool,
        OverdueDays: overdueDays,
        DaysRemaining: daysRemaining,
        DeliveryStatus: status
      };
    });

    // Filter by isOverdue if requested
    const finalRecords = (isOverdue === 'true' || isOverdue === true)
      ? enriched.filter(e => e.IsOverdue)
      : enriched;

    // Compute Summary Stats
    const totalPending = finalRecords.length;
    const overdueCount = finalRecords.filter(r => r.IsOverdue).length;
    const inTransitCount = finalRecords.filter(r => !r.IsOverdue && (r.AwbNo || r.CourierCompany)).length;
    const notDispatchedCount = finalRecords.filter(r => !r.AwbNo && !r.CourierCompany).length;
    const totalPendingAmount = finalRecords.reduce((sum, r) => sum + (parseFloat(r.TOTALAMOUNT) || 0), 0);

    // Distinct Courier Companies for filter dropdown
    const courierList = Array.from(new Set(records.map(r => r.CourierCompany).filter(Boolean))).sort();

    res.status(200).json({
      stats: {
        totalPending,
        overdueCount,
        inTransitCount,
        notDispatchedCount,
        totalPendingAmount: Math.round(totalPendingAmount)
      },
      courierCompanies: courierList,
      records: finalRecords
    });
  } catch (error) {
    console.error('Error fetching pending POD report:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};
