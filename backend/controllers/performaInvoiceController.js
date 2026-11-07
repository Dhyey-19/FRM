const { sql, connectDB } = require('../config/db');

const getSignature = (username) => {
  const name = username || 'System';
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const sig = `${name} - ${dateStr} ${timeStr}`;
  return sig.substring(0, 40);
};

// GET /api/performa-invoices/next-no
exports.getNextPINo = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query('SELECT PINO FROM PerformaInvoiceHeader');
    
    let maxNum = 0;
    if (result.recordset && result.recordset.length > 0) {
      for (const row of result.recordset) {
        const str = String(row.PINO || '').trim();
        const match = str.match(/(\d+)(?!.*\d)/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      }
    }
    
    const nextNo = `PI-${maxNum + 1}`;
    res.status(200).json({ nextNo });
  } catch (error) {
    console.error('Error fetching next PI no:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/performa-invoices
exports.getPerformaInvoices = async (req, res) => {
  try {
    const { id, piNo, ledgerId, status, customerPoId } = req.query;
    const pool = await connectDB();
    const headerReq = pool.request();
    let headerQuery = `
      SELECT 
        h.*, 
        l.LedgerName, 
        l.MobileNo, 
        l.City, 
        l.GSTIN,
        (SELECT COUNT(1) FROM PerformaInvoiceDetail d WHERE d.PIID = h.ID) AS TotalItems,
        (SELECT ISNULL(SUM(d.QUANTITY), 0) FROM PerformaInvoiceDetail d WHERE d.PIID = h.ID) AS OrderQtySum,
        (SELECT ISNULL(SUM(d.RECEIVEDQTY), 0) FROM PerformaInvoiceDetail d WHERE d.PIID = h.ID) AS ReceivedQtySum,
        (SELECT ISNULL(SUM(d.PENDINGQTY), 0) FROM PerformaInvoiceDetail d WHERE d.PIID = h.ID) AS PendingQtySum
      FROM PerformaInvoiceHeader h
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      WHERE 1=1
    `;

    if (id) {
      headerQuery += ' AND h.ID = @HeaderId';
      headerReq.input('HeaderId', sql.Numeric(8, 0), id);
    }
    if (piNo) {
      headerQuery += ' AND UPPER(LTRIM(RTRIM(h.PINO))) = UPPER(LTRIM(RTRIM(@PINo)))';
      headerReq.input('PINo', sql.VarChar(50), piNo.trim());
    }
    if (ledgerId) {
      headerQuery += ' AND h.LEDGERID = @LedgerId';
      headerReq.input('LedgerId', sql.Numeric(10, 0), ledgerId);
    }
    if (customerPoId) {
      headerQuery += ' AND h.CUSTOMERPOID = @CustomerPoId';
      headerReq.input('CustomerPoId', sql.Numeric(8, 0), customerPoId);
    }
    if (status) {
      const st = status.trim().toLowerCase();
      if (st === 'draft') {
        headerQuery += " AND UPPER(h.STATUS) = 'DRAFT'";
      } else if (st === 'ordered') {
        headerQuery += " AND UPPER(h.STATUS) = 'ORDERED'";
      } else if (st === 'partially received' || st === 'partial') {
        headerQuery += " AND UPPER(h.STATUS) = 'PARTIALLY RECEIVED'";
      } else if (st === 'completed') {
        headerQuery += " AND UPPER(h.STATUS) = 'COMPLETED'";
      } else if (st === 'active' || st === 'open') {
        headerQuery += " AND UPPER(h.STATUS) IN ('ORDERED', 'PARTIALLY RECEIVED')";
      }
    }

    headerQuery += `
      ORDER BY 
        h.PIDATE DESC, 
        h.ID DESC
    `;

    const headerResult = await headerReq.query(headerQuery);

    // Fetch Details
    const detailResult = await pool.request().query(`
      SELECT 
        d.*, 
        ISNULL(d.SUBCODE, '') AS SUBCODE, 
        i.ItemName,
        i.Category,
        i.Unit AS ItemUnit,
        i.WarehouseNo,
        i.Location,
        ISNULL(i.ClosingStock, 0) AS CurrentStock
      FROM PerformaInvoiceDetail d
      LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode AND ISNULL(d.SUBCODE, '') = ISNULL(i.SubCode, '')
      ORDER BY d.ID ASC
    `);

    // Group details by PIID
    const detailsByPiId = (detailResult.recordset || []).reduce((acc, detail) => {
      if (!acc[detail.PIID]) {
        acc[detail.PIID] = [];
      }
      acc[detail.PIID].push(detail);
      return acc;
    }, {});

    const performaInvoices = headerResult.recordset.map(header => ({
      ...header,
      Details: detailsByPiId[header.ID] || []
    }));

    res.status(200).json(performaInvoices);
  } catch (error) {
    console.error('Error fetching performa invoices:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/performa-invoices
exports.createPerformaInvoice = async (req, res) => {
  const { 
    PINO, 
    PIDATE, 
    LEDGERID, 
    CUSTOMERPOID, 
    CUSTOMERPONO, 
    DELIVERYDATE, 
    REMARK, 
    STATUS, 
    updateStockDirectly,
    CREATEDBY, 
    Details 
  } = req.body;

  if (!PINO || !PIDATE || !LEDGERID || !Details || !Array.isArray(Details) || Details.length === 0) {
    return res.status(400).json({ message: 'PI No, Date, Vendor, and at least one item detail are required.' });
  }

  let pool;
  try {
    pool = await connectDB();

    // Check duplicate PI No
    const duplicateCheck = await pool.request()
      .input('PINO', sql.VarChar(50), PINO.trim())
      .query('SELECT ID FROM PerformaInvoiceHeader WHERE UPPER(LTRIM(RTRIM(PINO))) = UPPER(LTRIM(RTRIM(@PINO)))');

    if (duplicateCheck.recordset.length > 0) {
      return res.status(400).json({ message: `Performa Invoice number '${PINO}' already exists.` });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      let totalQty = 0;
      let totalAmount = 0;

      for (const d of Details) {
        if (!d.ITEMCODE) {
          throw new Error('Item Code is required for all line items.');
        }
        const qty = parseFloat(d.QUANTITY) || 0;
        if (qty <= 0) {
          throw new Error(`Quantity must be greater than 0 for item ${d.ITEMCODE}`);
        }
        const rate = parseFloat(d.RATE) || 0;
        const amt = parseFloat(d.AMOUNT) || (qty * rate);
        totalQty += qty;
        totalAmount += amt;
      }

      // If user toggles direct stock update on ordering
      const isDirectStock = updateStockDirectly === true;
      const initialStatus = isDirectStock ? 'Completed' : (STATUS || 'Ordered');

      // Insert Header
      const headerReq = new sql.Request(transaction);
      const headerRes = await headerReq
        .input('PINO', sql.VarChar(50), PINO.trim())
        .input('PIDATE', sql.Date, PIDATE)
        .input('LEDGERID', sql.Numeric(10, 0), LEDGERID)
        .input('CUSTOMERPOID', sql.Numeric(8, 0), CUSTOMERPOID || null)
        .input('CUSTOMERPONO', sql.VarChar(50), CUSTOMERPONO || null)
        .input('DELIVERYDATE', sql.Date, DELIVERYDATE || null)
        .input('STATUS', sql.VarChar(25), initialStatus)
        .input('TOTALQTY', sql.Numeric(12, 3), totalQty)
        .input('TOTALAMOUNT', sql.Numeric(12, 2), totalAmount)
        .input('REMARK', sql.VarChar(255), REMARK || null)
        .input('CREATEDBY', sql.VarChar(40), getSignature(CREATEDBY))
        .input('UPDATEDBY', sql.VarChar(40), getSignature(CREATEDBY))
        .query(`
          INSERT INTO PerformaInvoiceHeader (PINO, PIDATE, LEDGERID, CUSTOMERPOID, CUSTOMERPONO, DELIVERYDATE, STATUS, TOTALQTY, TOTALAMOUNT, REMARK, CREATEDBY, UPDATEDBY)
          OUTPUT INSERTED.ID
          VALUES (@PINO, @PIDATE, @LEDGERID, @CUSTOMERPOID, @CUSTOMERPONO, @DELIVERYDATE, @STATUS, @TOTALQTY, @TOTALAMOUNT, @REMARK, @CREATEDBY, @UPDATEDBY)
        `);

      const newPiId = headerRes.recordset[0].ID;

      // Insert Details
      for (const d of Details) {
        const qty = parseFloat(d.QUANTITY) || 0;
        const rate = parseFloat(d.RATE) || 0;
        const amt = parseFloat(d.AMOUNT) || (qty * rate);
        const subCodeVal = (d.SUBCODE || d.SubCode || '').trim();

        const receivedQty = isDirectStock ? qty : 0;
        const pendingQty = isDirectStock ? 0 : qty;

        const detailReq = new sql.Request(transaction);
        await detailReq
          .input('PIID', sql.Numeric(8, 0), newPiId)
          .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE.trim())
          .input('SUBCODE', sql.VarChar(50), subCodeVal)
          .input('QUANTITY', sql.Numeric(10, 2), qty)
          .input('RECEIVEDQTY', sql.Numeric(10, 2), receivedQty)
          .input('PENDINGQTY', sql.Numeric(10, 2), pendingQty)
          .input('UNIT', sql.VarChar(10), d.UNIT || 'PCS')
          .input('RATE', sql.Numeric(10, 2), rate)
          .input('AMOUNT', sql.Numeric(12, 2), amt)
          .input('REMARK', sql.VarChar(100), d.REMARK || null)
          .query(`
            INSERT INTO PerformaInvoiceDetail (PIID, ITEMCODE, SUBCODE, QUANTITY, RECEIVEDQTY, PENDINGQTY, UNIT, RATE, AMOUNT, REMARK)
            VALUES (@PIID, @ITEMCODE, @SUBCODE, @QUANTITY, @RECEIVEDQTY, @PENDINGQTY, @UNIT, @RATE, @AMOUNT, @REMARK)
          `);

        // If direct stock update requested on ordering, update ItemMaster ClosingStock immediately
        if (isDirectStock) {
          await new sql.Request(transaction)
            .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE.trim())
            .input('SUBCODE', sql.VarChar(50), subCodeVal)
            .input('ADD_QTY', sql.Numeric(10, 2), qty)
            .query(`
              UPDATE ItemMaster
              SET ClosingStock = ISNULL(ClosingStock, 0) + @ADD_QTY
              WHERE ItemCode = @ITEMCODE AND ISNULL(SubCode, '') = @SUBCODE;
            `);
        }
      }

      await transaction.commit();
      res.status(201).json({ message: 'Performa Invoice created successfully', id: newPiId, status: initialStatus });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error creating performa invoice:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// PUT /api/performa-invoices/:id
exports.updatePerformaInvoice = async (req, res) => {
  const { id } = req.params;
  const { 
    PINO, 
    PIDATE, 
    LEDGERID, 
    CUSTOMERPOID, 
    CUSTOMERPONO, 
    DELIVERYDATE, 
    REMARK, 
    STATUS, 
    UPDATEDBY, 
    Details 
  } = req.body;

  if (!PINO || !PIDATE || !LEDGERID || !Details || !Array.isArray(Details) || Details.length === 0) {
    return res.status(400).json({ message: 'PI No, Date, Vendor, and at least one item detail are required.' });
  }

  let pool;
  try {
    pool = await connectDB();

    // Check duplicate PI No
    const duplicateCheck = await pool.request()
      .input('ID', sql.Numeric(8, 0), id)
      .input('PINO', sql.VarChar(50), PINO.trim())
      .query('SELECT ID FROM PerformaInvoiceHeader WHERE UPPER(LTRIM(RTRIM(PINO))) = UPPER(LTRIM(RTRIM(@PINO))) AND ID <> @ID');

    if (duplicateCheck.recordset.length > 0) {
      return res.status(400).json({ message: `Another Performa Invoice with number '${PINO}' already exists.` });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Fetch existing details to preserve already received quantities
      const existingDetailsRes = await new sql.Request(transaction)
        .input('PIID', sql.Numeric(8, 0), id)
        .query('SELECT ID, ITEMCODE, ISNULL(SUBCODE, \'\') AS SUBCODE, QUANTITY, RECEIVEDQTY, PENDINGQTY FROM PerformaInvoiceDetail WHERE PIID = @PIID');

      const existingMap = {};
      existingDetailsRes.recordset.forEach(row => {
        const key = row.ID || `${row.ITEMCODE}__${row.SUBCODE}`;
        existingMap[key] = row;
      });

      let totalQty = 0;
      let totalAmount = 0;
      let totalReceived = 0;
      let totalPending = 0;

      for (const d of Details) {
        if (!d.ITEMCODE) throw new Error('Item Code is required for all line items.');
        const qty = parseFloat(d.QUANTITY) || 0;
        const rate = parseFloat(d.RATE) || 0;
        const amt = parseFloat(d.AMOUNT) || (qty * rate);
        const subCodeVal = (d.SUBCODE || d.SubCode || '').trim();

        const matchKey = d.ID || `${d.ITEMCODE}__${subCodeVal}`;
        const prev = existingMap[matchKey] || existingMap[`${d.ITEMCODE}__${subCodeVal}`];
        const receivedQty = prev ? (parseFloat(prev.RECEIVEDQTY) || 0) : 0;

        if (qty < receivedQty) {
          throw new Error(`Quantity for item '${d.ITEMCODE}' cannot be less than already received quantity (${receivedQty}).`);
        }

        const pendingQty = Math.max(0, qty - receivedQty);
        totalQty += qty;
        totalAmount += amt;
        totalReceived += receivedQty;
        totalPending += pendingQty;
      }

      // Compute status
      let newStatus = STATUS || 'Ordered';
      if (totalPending <= 0 && totalQty > 0) {
        newStatus = 'Completed';
      } else if (totalReceived > 0) {
        newStatus = 'Partially Received';
      }

      // 1. Delete old details
      await new sql.Request(transaction)
        .input('PIID', sql.Numeric(8, 0), id)
        .query('DELETE FROM PerformaInvoiceDetail WHERE PIID = @PIID');

      // 2. Update Header
      await new sql.Request(transaction)
        .input('ID', sql.Numeric(8, 0), id)
        .input('PINO', sql.VarChar(50), PINO.trim())
        .input('PIDATE', sql.Date, PIDATE)
        .input('LEDGERID', sql.Numeric(10, 0), LEDGERID)
        .input('CUSTOMERPOID', sql.Numeric(8, 0), CUSTOMERPOID || null)
        .input('CUSTOMERPONO', sql.VarChar(50), CUSTOMERPONO || null)
        .input('DELIVERYDATE', sql.Date, DELIVERYDATE || null)
        .input('STATUS', sql.VarChar(25), newStatus)
        .input('TOTALQTY', sql.Numeric(12, 3), totalQty)
        .input('TOTALAMOUNT', sql.Numeric(12, 2), totalAmount)
        .input('REMARK', sql.VarChar(255), REMARK || null)
        .input('UPDATEDBY', sql.VarChar(40), getSignature(UPDATEDBY))
        .query(`
          UPDATE PerformaInvoiceHeader
          SET PINO = @PINO, PIDATE = @PIDATE, LEDGERID = @LEDGERID, CUSTOMERPOID = @CUSTOMERPOID, CUSTOMERPONO = @CUSTOMERPONO,
              DELIVERYDATE = @DELIVERYDATE, STATUS = @STATUS, TOTALQTY = @TOTALQTY, TOTALAMOUNT = @TOTALAMOUNT,
              REMARK = @REMARK, UPDATEDBY = @UPDATEDBY
          WHERE ID = @ID
        `);

      // 3. Insert new details
      for (const d of Details) {
        const qty = parseFloat(d.QUANTITY) || 0;
        const rate = parseFloat(d.RATE) || 0;
        const amt = parseFloat(d.AMOUNT) || (qty * rate);
        const subCodeVal = (d.SUBCODE || d.SubCode || '').trim();

        const matchKey = d.ID || `${d.ITEMCODE}__${subCodeVal}`;
        const prev = existingMap[matchKey] || existingMap[`${d.ITEMCODE}__${subCodeVal}`];
        const receivedQty = prev ? (parseFloat(prev.RECEIVEDQTY) || 0) : 0;
        const pendingQty = Math.max(0, qty - receivedQty);

        await new sql.Request(transaction)
          .input('PIID', sql.Numeric(8, 0), id)
          .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE.trim())
          .input('SUBCODE', sql.VarChar(50), subCodeVal)
          .input('QUANTITY', sql.Numeric(10, 2), qty)
          .input('RECEIVEDQTY', sql.Numeric(10, 2), receivedQty)
          .input('PENDINGQTY', sql.Numeric(10, 2), pendingQty)
          .input('UNIT', sql.VarChar(10), d.UNIT || 'PCS')
          .input('RATE', sql.Numeric(10, 2), rate)
          .input('AMOUNT', sql.Numeric(12, 2), amt)
          .input('REMARK', sql.VarChar(100), d.REMARK || null)
          .query(`
            INSERT INTO PerformaInvoiceDetail (PIID, ITEMCODE, SUBCODE, QUANTITY, RECEIVEDQTY, PENDINGQTY, UNIT, RATE, AMOUNT, REMARK)
            VALUES (@PIID, @ITEMCODE, @SUBCODE, @QUANTITY, @RECEIVEDQTY, @PENDINGQTY, @UNIT, @RATE, @AMOUNT, @REMARK)
          `);
      }

      await transaction.commit();
      res.status(200).json({ message: 'Performa Invoice updated successfully', status: newStatus });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error updating performa invoice:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// DELETE /api/performa-invoices/:id
exports.deletePerformaInvoice = async (req, res) => {
  const { id } = req.params;

  let pool;
  try {
    pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Check if any items have been received
      const checkReceived = await new sql.Request(transaction)
        .input('PIID', sql.Numeric(8, 0), id)
        .query('SELECT ISNULL(SUM(RECEIVEDQTY), 0) AS TotalReceived FROM PerformaInvoiceDetail WHERE PIID = @PIID');

      const received = checkReceived.recordset[0]?.TotalReceived || 0;
      if (received > 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot delete this Performa Invoice because goods have already been received against it in Purchase/Inward. Please delete or modify the linked Purchase entries first.' 
        });
      }

      // Check if any InwardHeader directly references this PIID
      const checkInward = await new sql.Request(transaction)
        .input('PIID', sql.Numeric(8, 0), id)
        .query('SELECT INWARDNO FROM InwardHeader WHERE PIID = @PIID');

      if (checkInward.recordset.length > 0) {
        const inwardNos = checkInward.recordset.map(r => r.INWARDNO).join(', ');
        await transaction.rollback();
        return res.status(400).json({ 
          message: `Cannot delete Performa Invoice because it is linked to Purchase entry(ies): ${inwardNos}. Please remove or re-link the purchase entries first.` 
        });
      }

      await new sql.Request(transaction)
        .input('PIID', sql.Numeric(8, 0), id)
        .query('DELETE FROM PerformaInvoiceDetail WHERE PIID = @PIID');

      await new sql.Request(transaction)
        .input('ID', sql.Numeric(8, 0), id)
        .query('DELETE FROM PerformaInvoiceHeader WHERE ID = @ID');

      await transaction.commit();
      res.status(200).json({ message: 'Performa Invoice deleted successfully' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error deleting performa invoice:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// POST /api/performa-invoices/:id/receive-stock
// Directly updates stock for this PI and marks it received
exports.receiveStockDirectly = async (req, res) => {
  const { id } = req.params;
  const { username } = req.body;

  let pool;
  try {
    pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const detailsRes = await new sql.Request(transaction)
        .input('PIID', sql.Numeric(8, 0), id)
        .query('SELECT ID, ITEMCODE, ISNULL(SUBCODE, \'\') AS SUBCODE, QUANTITY, RECEIVEDQTY, PENDINGQTY FROM PerformaInvoiceDetail WHERE PIID = @PIID');

      for (const d of detailsRes.recordset) {
        const pending = parseFloat(d.PENDINGQTY) || 0;
        if (pending > 0) {
          // Add to stock
          await new sql.Request(transaction)
            .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE)
            .input('SUBCODE', sql.VarChar(50), d.SUBCODE)
            .input('ADD_QTY', sql.Numeric(10, 2), pending)
            .query(`
              UPDATE ItemMaster
              SET ClosingStock = ISNULL(ClosingStock, 0) + @ADD_QTY
              WHERE ItemCode = @ITEMCODE AND ISNULL(SubCode, '') = @SUBCODE;
            `);

          // Update detail
          await new sql.Request(transaction)
            .input('ID', sql.Numeric(8, 0), d.ID)
            .input('QTY', sql.Numeric(10, 2), pending)
            .query(`
              UPDATE PerformaInvoiceDetail
              SET RECEIVEDQTY = RECEIVEDQTY + @QTY,
                  PENDINGQTY = 0
              WHERE ID = @ID;
            `);
        }
      }

      await new sql.Request(transaction)
        .input('ID', sql.Numeric(8, 0), id)
        .input('UPDATEDBY', sql.VarChar(40), getSignature(username))
        .query("UPDATE PerformaInvoiceHeader SET STATUS = 'Completed', UPDATEDBY = @UPDATEDBY WHERE ID = @ID");

      await transaction.commit();
      res.status(200).json({ message: 'Stock updated and Performa Invoice marked as Completed.' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error receiving stock directly for PI:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};
