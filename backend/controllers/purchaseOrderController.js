const { sql, connectDB } = require('../config/db');

const getSignature = (username) => {
  const name = username || 'System';
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const sig = `${name} - ${dateStr} ${timeStr}`;
  return sig.substring(0, 40);
};

// GET /api/purchase-orders/next-no
exports.getNextPONo = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT PONO FROM PurchaseOrderHeader
    `);
    
    let maxNum = 0;
    if (result.recordset && result.recordset.length > 0) {
      for (const row of result.recordset) {
        const str = String(row.PONO || '').trim();
        // Match numbers, e.g. PO-001 or 123
        const match = str.match(/(\d+)(?!.*\d)/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      }
    }
    
    const nextNo = `PO-${maxNum + 1}`;
    res.status(200).json({ nextNo });
  } catch (error) {
    console.error('Error fetching next PO no:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/purchase-orders/stock-availability
exports.getStockAvailability = async (req, res) => {
  try {
    const { excludePoId } = req.query;
    const pool = await connectDB();
    const reqInstance = pool.request();
    let query = `
      SELECT 
        i.ItemCode,
        ISNULL(i.SubCode, '') AS SubCode,
        i.ItemName,
        i.Category,
        i.Unit,
        ISNULL(i.ClosingStock, 0) AS CurrentStock,
        ISNULL(po.PendingQty, 0) AS CommittedQty,
        (ISNULL(i.ClosingStock, 0) - ISNULL(po.PendingQty, 0)) AS AvailableStock
      FROM ItemMaster i
      LEFT JOIN (
        SELECT 
          d.ITEMCODE,
          ISNULL(d.SUBCODE, '') AS SUBCODE,
          SUM(d.PENDINGQTY) AS PendingQty
        FROM PurchaseOrderDetail d
        INNER JOIN PurchaseOrderHeader h ON d.POID = h.ID
        WHERE UPPER(h.STATUS) IN ('PENDING', 'PARTIALLY FULFILLED')
    `;

    if (excludePoId) {
      query += ' AND h.ID <> @ExcludePoId';
      reqInstance.input('ExcludePoId', sql.Numeric(8, 0), excludePoId);
    }

    query += `
        GROUP BY d.ITEMCODE, ISNULL(d.SUBCODE, '')
      ) po ON i.ItemCode = po.ITEMCODE AND ISNULL(i.SubCode, '') = po.SUBCODE
      ORDER BY i.ItemCode, ISNULL(i.SubCode, '')
    `;

    const result = await reqInstance.query(query);
    res.status(200).json(result.recordset || []);
  } catch (error) {
    console.error('Error fetching stock availability:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/purchase-orders
exports.getPurchaseOrders = async (req, res) => {
  try {
    const { id, poNo, ledgerId, status } = req.query;
    const pool = await connectDB();
    const headerReq = pool.request();
    let headerQuery = `
      SELECT 
        h.*, 
        l.LedgerName, 
        l.MobileNo, 
        l.City, 
        l.GSTIN,
        (SELECT COUNT(1) FROM PurchaseOrderDetail d WHERE d.POID = h.ID) AS TotalItems,
        (SELECT ISNULL(SUM(d.QUANTITY), 0) FROM PurchaseOrderDetail d WHERE d.POID = h.ID) AS OrderQtySum,
        (SELECT ISNULL(SUM(d.DELIVEREDQTY), 0) FROM PurchaseOrderDetail d WHERE d.POID = h.ID) AS DeliveredQtySum,
        (SELECT ISNULL(SUM(d.PENDINGQTY), 0) FROM PurchaseOrderDetail d WHERE d.POID = h.ID) AS PendingQtySum
      FROM PurchaseOrderHeader h
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      WHERE 1=1
    `;

    if (id) {
      headerQuery += ' AND h.ID = @HeaderId';
      headerReq.input('HeaderId', sql.Numeric(8, 0), id);
    }
    if (poNo) {
      headerQuery += ' AND UPPER(LTRIM(RTRIM(h.PONO))) = UPPER(LTRIM(RTRIM(@PONo)))';
      headerReq.input('PONo', sql.VarChar(50), poNo.trim());
    }
    if (ledgerId) {
      headerQuery += ' AND h.LEDGERID = @LedgerId';
      headerReq.input('LedgerId', sql.Numeric(10, 0), ledgerId);
    }
    if (status) {
      const st = status.trim().toLowerCase();
      if (st === 'pending') {
        headerQuery += " AND UPPER(h.STATUS) = 'PENDING'";
      } else if (st === 'partially fulfilled' || st === 'partial') {
        headerQuery += " AND UPPER(h.STATUS) = 'PARTIALLY FULFILLED'";
      } else if (st === 'completed') {
        headerQuery += " AND UPPER(h.STATUS) = 'COMPLETED'";
      } else if (st === 'active' || st === 'open') {
        headerQuery += " AND UPPER(h.STATUS) IN ('PENDING', 'PARTIALLY FULFILLED')";
      }
    }

    headerQuery += `
      ORDER BY 
        h.PODATE DESC, 
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
        i.Location
      FROM PurchaseOrderDetail d
      LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode AND ISNULL(d.SUBCODE, '') = ISNULL(i.SubCode, '')
      ORDER BY d.ID ASC
    `);

    // Group details by POID
    const detailsByPoId = (detailResult.recordset || []).reduce((acc, detail) => {
      if (!acc[detail.POID]) {
        acc[detail.POID] = [];
      }
      acc[detail.POID].push(detail);
      return acc;
    }, {});

    const purchaseOrders = headerResult.recordset.map(header => ({
      ...header,
      Details: detailsByPoId[header.ID] || []
    }));

    res.status(200).json(purchaseOrders);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/purchase-orders/pending-report
exports.getPendingPOReport = async (req, res) => {
  try {
    const { fromDate, toDate, ledgerId, itemCode, subCode, status } = req.query;
    const pool = await connectDB();
    const reqInstance = pool.request();

    let query = `
      SELECT 
        h.ID AS POID,
        h.PONO,
        h.PODATE,
        h.DELIVERYDATE,
        h.STATUS AS OrderStatus,
        h.REMARK AS OrderRemark,
        h.CREATEDBY,
        l.Id AS LEDGERID,
        l.LedgerName,
        l.MobileNo AS VendorMobile,
        l.City AS VendorCity,
        l.State AS VendorState,
        l.GSTIN AS VendorGSTIN,
        d.ID AS DetailId,
        d.ITEMCODE,
        ISNULL(d.SUBCODE, '') AS SUBCODE,
        i.ItemName,
        i.Category AS ItemCategory,
        d.QUANTITY AS OrderedQty,
        d.DELIVEREDQTY AS DeliveredQty,
        d.PENDINGQTY AS PendingQty,
        d.UNIT,
        d.RATE,
        d.AMOUNT AS OrderedAmount,
        (d.PENDINGQTY * d.RATE) AS PendingAmount,
        d.REMARK AS ItemRemark
      FROM PurchaseOrderDetail d
      INNER JOIN PurchaseOrderHeader h ON d.POID = h.ID
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode AND ISNULL(d.SUBCODE, '') = ISNULL(i.SubCode, '')
      WHERE 1=1
    `;

    // Filter status: by default show active (pending + partially fulfilled), or custom
    if (status) {
      const st = status.trim().toLowerCase();
      if (st === 'pending') {
        query += " AND UPPER(h.STATUS) = 'PENDING'";
      } else if (st === 'partially fulfilled' || st === 'partial') {
        query += " AND UPPER(h.STATUS) = 'PARTIALLY FULFILLED'";
      } else if (st === 'completed') {
        query += " AND UPPER(h.STATUS) = 'COMPLETED'";
      } else if (st === 'all') {
        // no status restriction
      } else {
        query += " AND UPPER(h.STATUS) IN ('PENDING', 'PARTIALLY FULFILLED')";
      }
    } else {
      // Default to pending / open items where pending qty > 0
      query += " AND d.PENDINGQTY > 0";
    }

    if (fromDate) {
      query += " AND h.PODATE >= @FromDate";
      reqInstance.input('FromDate', sql.Date, fromDate);
    }
    if (toDate) {
      query += " AND h.PODATE <= @ToDate";
      reqInstance.input('ToDate', sql.Date, toDate);
    }
    if (ledgerId) {
      query += " AND h.LEDGERID = @LedgerId";
      reqInstance.input('LedgerId', sql.Numeric(10, 0), ledgerId);
    }
    if (itemCode) {
      query += " AND d.ITEMCODE = @ItemCode";
      reqInstance.input('ItemCode', sql.VarChar(50), itemCode.trim());
    }
    if (subCode !== undefined && subCode !== null && subCode !== '') {
      query += " AND ISNULL(d.SUBCODE, '') = @SubCode";
      reqInstance.input('SubCode', sql.VarChar(50), subCode.trim());
    }

    query += `
      ORDER BY 
        l.LedgerName ASC, 
        h.PODATE DESC, 
        h.PONO DESC, 
        d.ID ASC
    `;

    const result = await reqInstance.query(query);
    const rows = result.recordset || [];

    // 1. Group vendor-wise
    const vendorMap = {};
    // 2. Group item-wise
    const itemMap = {};

    let totalOrderedQty = 0;
    let totalDeliveredQty = 0;
    let totalPendingQty = 0;
    let totalPendingAmount = 0;
    const uniqueOrders = new Set();

    rows.forEach(row => {
      uniqueOrders.add(row.POID);
      const oQty = parseFloat(row.OrderedQty) || 0;
      const dQty = parseFloat(row.DeliveredQty) || 0;
      const pQty = parseFloat(row.PendingQty) || 0;
      const pAmt = parseFloat(row.PendingAmount) || (pQty * (parseFloat(row.RATE) || 0));

      totalOrderedQty += oQty;
      totalDeliveredQty += dQty;
      totalPendingQty += pQty;
      totalPendingAmount += pAmt;

      // Vendor-wise grouping
      const vKey = row.LEDGERID || 'Unknown';
      if (!vendorMap[vKey]) {
        vendorMap[vKey] = {
          LedgerId: row.LEDGERID,
          LedgerName: row.LedgerName || 'Unknown Vendor / Party',
          MobileNo: row.VendorMobile || '',
          City: row.VendorCity || '',
          State: row.VendorState || '',
          GSTIN: row.VendorGSTIN || '',
          TotalOrderedQty: 0,
          TotalDeliveredQty: 0,
          TotalPendingQty: 0,
          TotalPendingAmount: 0,
          OrdersCount: 0,
          OrderIds: new Set(),
          Items: []
        };
      }
      vendorMap[vKey].TotalOrderedQty += oQty;
      vendorMap[vKey].TotalDeliveredQty += dQty;
      vendorMap[vKey].TotalPendingQty += pQty;
      vendorMap[vKey].TotalPendingAmount += pAmt;
      vendorMap[vKey].OrderIds.add(row.POID);
      vendorMap[vKey].Items.push(row);

      // Item-wise grouping
      const iKey = `${row.ITEMCODE}__${row.SUBCODE || ''}`;
      if (!itemMap[iKey]) {
        itemMap[iKey] = {
          ItemCode: row.ITEMCODE,
          SubCode: row.SUBCODE || '',
          ItemName: row.ItemName || row.ITEMCODE,
          ItemCategory: row.ItemCategory || 'Inhouse',
          Unit: row.UNIT || 'PCS',
          TotalOrderedQty: 0,
          TotalDeliveredQty: 0,
          TotalPendingQty: 0,
          TotalPendingAmount: 0,
          PendingOrdersCount: 0,
          OrderIds: new Set(),
          Orders: []
        };
      }
      itemMap[iKey].TotalOrderedQty += oQty;
      itemMap[iKey].TotalDeliveredQty += dQty;
      itemMap[iKey].TotalPendingQty += pQty;
      itemMap[iKey].TotalPendingAmount += pAmt;
      itemMap[iKey].OrderIds.add(row.POID);
      itemMap[iKey].Orders.push(row);
    });

    const vendorWise = Object.values(vendorMap).map(v => ({
      ...v,
      OrdersCount: v.OrderIds.size,
      OrderIds: undefined
    })).sort((a, b) => b.TotalPendingAmount - a.TotalPendingAmount);

    const itemWise = Object.values(itemMap).map(i => ({
      ...i,
      PendingOrdersCount: i.OrderIds.size,
      OrderIds: undefined
    })).sort((a, b) => b.TotalPendingQty - a.TotalPendingQty);

    res.status(200).json({
      summary: {
        totalOrders: uniqueOrders.size,
        totalItems: rows.length,
        totalOrderedQty,
        totalDeliveredQty,
        totalPendingQty,
        totalPendingAmount: Math.round(totalPendingAmount * 100) / 100
      },
      vendorWise,
      itemWise,
      rawRows: rows
    });
  } catch (error) {
    console.error('Error fetching pending PO report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/purchase-orders
exports.createPurchaseOrder = async (req, res) => {
  const { PONO, PODATE, LEDGERID, DELIVERYDATE, REMARK, CREATEDBY, Details } = req.body;

  if (!PONO || !PODATE || !LEDGERID || !Details || !Array.isArray(Details) || Details.length === 0) {
    return res.status(400).json({ message: 'PO No, PO Date, Ledger, and at least one item detail are required.' });
  }

  let pool;
  try {
    pool = await connectDB();

    // Check duplicate PO No
    const duplicateCheck = await pool.request()
      .input('PONO', sql.VarChar(50), PONO.trim())
      .query('SELECT ID FROM PurchaseOrderHeader WHERE UPPER(LTRIM(RTRIM(PONO))) = UPPER(LTRIM(RTRIM(@PONO)))');

    if (duplicateCheck.recordset.length > 0) {
      return res.status(400).json({ message: `Purchase Order number '${PONO}' already exists.` });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Calculate totals
      let totalQty = 0;
      let totalAmount = 0;

      for (const d of Details) {
        if (!d.ITEMCODE) {
          throw new Error('Item Code is required for all detail items.');
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

      // Insert Header
      const headerReq = new sql.Request(transaction);
      const headerRes = await headerReq
        .input('PONO', sql.VarChar(50), PONO.trim())
        .input('PODATE', sql.Date, PODATE)
        .input('LEDGERID', sql.Numeric(10, 0), LEDGERID)
        .input('DELIVERYDATE', sql.Date, DELIVERYDATE || null)
        .input('STATUS', sql.VarChar(25), 'Pending')
        .input('TOTALQTY', sql.Numeric(12, 3), totalQty)
        .input('TOTALAMOUNT', sql.Numeric(12, 2), totalAmount)
        .input('REMARK', sql.VarChar(255), REMARK || null)
        .input('CREATEDBY', sql.VarChar(40), getSignature(CREATEDBY))
        .input('UPDATEDBY', sql.VarChar(40), getSignature(CREATEDBY))
        .query(`
          INSERT INTO PurchaseOrderHeader (PONO, PODATE, LEDGERID, DELIVERYDATE, STATUS, TOTALQTY, TOTALAMOUNT, REMARK, CREATEDBY, UPDATEDBY)
          OUTPUT INSERTED.ID
          VALUES (@PONO, @PODATE, @LEDGERID, @DELIVERYDATE, @STATUS, @TOTALQTY, @TOTALAMOUNT, @REMARK, @CREATEDBY, @UPDATEDBY)
        `);

      const newPoId = headerRes.recordset[0].ID;

      // Insert Details
      for (const d of Details) {
        const qty = parseFloat(d.QUANTITY) || 0;
        const rate = parseFloat(d.RATE) || 0;
        const amt = parseFloat(d.AMOUNT) || (qty * rate);
        const subCodeVal = (d.SUBCODE || d.SubCode || '').trim();

        const detailReq = new sql.Request(transaction);
        await detailReq
          .input('POID', sql.Numeric(8, 0), newPoId)
          .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE.trim())
          .input('SUBCODE', sql.VarChar(50), subCodeVal)
          .input('QUANTITY', sql.Numeric(10, 2), qty)
          .input('DELIVEREDQTY', sql.Numeric(10, 2), 0)
          .input('PENDINGQTY', sql.Numeric(10, 2), qty)
          .input('UNIT', sql.VarChar(10), d.UNIT || null)
          .input('RATE', sql.Numeric(10, 2), rate)
          .input('AMOUNT', sql.Numeric(12, 2), amt)
          .input('REMARK', sql.VarChar(100), d.REMARK || null)
          .query(`
            INSERT INTO PurchaseOrderDetail (POID, ITEMCODE, SUBCODE, QUANTITY, DELIVEREDQTY, PENDINGQTY, UNIT, RATE, AMOUNT, REMARK)
            VALUES (@POID, @ITEMCODE, @SUBCODE, @QUANTITY, @DELIVEREDQTY, @PENDINGQTY, @UNIT, @RATE, @AMOUNT, @REMARK)
          `);
      }

      await transaction.commit();
      res.status(201).json({ message: 'Purchase Order created successfully', id: newPoId });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// PUT /api/purchase-orders/:id
exports.updatePurchaseOrder = async (req, res) => {
  const { id } = req.params;
  const { PONO, PODATE, LEDGERID, DELIVERYDATE, REMARK, UPDATEDBY, Details } = req.body;

  if (!PONO || !PODATE || !LEDGERID || !Details || !Array.isArray(Details) || Details.length === 0) {
    return res.status(400).json({ message: 'PO No, Date, Ledger, and at least one item detail are required.' });
  }

  let pool;
  try {
    pool = await connectDB();

    // Check duplicate PO No
    const duplicateCheck = await pool.request()
      .input('ID', sql.Numeric(8, 0), id)
      .input('PONO', sql.VarChar(50), PONO.trim())
      .query('SELECT ID FROM PurchaseOrderHeader WHERE UPPER(LTRIM(RTRIM(PONO))) = UPPER(LTRIM(RTRIM(@PONO))) AND ID <> @ID');

    if (duplicateCheck.recordset.length > 0) {
      return res.status(400).json({ message: `Another Purchase Order with number '${PONO}' already exists.` });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Fetch existing details to preserve already delivered quantities
      const existingDetailsRes = await new sql.Request(transaction)
        .input('POID', sql.Numeric(8, 0), id)
        .query('SELECT ID, ITEMCODE, ISNULL(SUBCODE, \'\') AS SUBCODE, QUANTITY, DELIVEREDQTY, PENDINGQTY FROM PurchaseOrderDetail WHERE POID = @POID');

      const existingMap = {};
      existingDetailsRes.recordset.forEach(row => {
        const key = row.ID || `${row.ITEMCODE}__${row.SUBCODE}`;
        existingMap[key] = row;
      });

      // Calculate totals and validate quantities against already delivered
      let totalQty = 0;
      let totalAmount = 0;
      let totalDelivered = 0;
      let totalPending = 0;

      for (const d of Details) {
        if (!d.ITEMCODE) throw new Error('Item Code is required for all detail items.');
        const qty = parseFloat(d.QUANTITY) || 0;
        const rate = parseFloat(d.RATE) || 0;
        const amt = parseFloat(d.AMOUNT) || (qty * rate);
        const subCodeVal = (d.SUBCODE || d.SubCode || '').trim();

        // Check if previously delivered
        const matchKey = d.ID || `${d.ITEMCODE}__${subCodeVal}`;
        const prev = existingMap[matchKey] || existingMap[`${d.ITEMCODE}__${subCodeVal}`];
        const deliveredQty = prev ? (parseFloat(prev.DELIVEREDQTY) || 0) : 0;

        if (qty < deliveredQty) {
          throw new Error(`Ordered quantity for item '${d.ITEMCODE}' cannot be less than already delivered quantity (${deliveredQty}).`);
        }

        const pendingQty = Math.max(0, qty - deliveredQty);
        totalQty += qty;
        totalAmount += amt;
        totalDelivered += deliveredQty;
        totalPending += pendingQty;
      }

      // Determine updated status
      let newStatus = 'Pending';
      if (totalPending <= 0 && totalQty > 0) {
        newStatus = 'Completed';
      } else if (totalDelivered > 0) {
        newStatus = 'Partially Fulfilled';
      }

      // 1. Delete old details
      await new sql.Request(transaction)
        .input('POID', sql.Numeric(8, 0), id)
        .query('DELETE FROM PurchaseOrderDetail WHERE POID = @POID');

      // 2. Update Header
      await new sql.Request(transaction)
        .input('ID', sql.Numeric(8, 0), id)
        .input('PONO', sql.VarChar(50), PONO.trim())
        .input('PODATE', sql.Date, PODATE)
        .input('LEDGERID', sql.Numeric(10, 0), LEDGERID)
        .input('DELIVERYDATE', sql.Date, DELIVERYDATE || null)
        .input('STATUS', sql.VarChar(25), newStatus)
        .input('TOTALQTY', sql.Numeric(12, 3), totalQty)
        .input('TOTALAMOUNT', sql.Numeric(12, 2), totalAmount)
        .input('REMARK', sql.VarChar(255), REMARK || null)
        .input('UPDATEDBY', sql.VarChar(40), getSignature(UPDATEDBY))
        .query(`
          UPDATE PurchaseOrderHeader
          SET PONO = @PONO, PODATE = @PODATE, LEDGERID = @LEDGERID, DELIVERYDATE = @DELIVERYDATE,
              STATUS = @STATUS, TOTALQTY = @TOTALQTY, TOTALAMOUNT = @TOTALAMOUNT, REMARK = @REMARK, UPDATEDBY = @UPDATEDBY
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
        const deliveredQty = prev ? (parseFloat(prev.DELIVEREDQTY) || 0) : 0;
        const pendingQty = Math.max(0, qty - deliveredQty);

        const detailReq = new sql.Request(transaction);
        await detailReq
          .input('POID', sql.Numeric(8, 0), id)
          .input('ITEMCODE', sql.VarChar(50), d.ITEMCODE.trim())
          .input('SUBCODE', sql.VarChar(50), subCodeVal)
          .input('QUANTITY', sql.Numeric(10, 2), qty)
          .input('DELIVEREDQTY', sql.Numeric(10, 2), deliveredQty)
          .input('PENDINGQTY', sql.Numeric(10, 2), pendingQty)
          .input('UNIT', sql.VarChar(10), d.UNIT || null)
          .input('RATE', sql.Numeric(10, 2), rate)
          .input('AMOUNT', sql.Numeric(12, 2), amt)
          .input('REMARK', sql.VarChar(100), d.REMARK || null)
          .query(`
            INSERT INTO PurchaseOrderDetail (POID, ITEMCODE, SUBCODE, QUANTITY, DELIVEREDQTY, PENDINGQTY, UNIT, RATE, AMOUNT, REMARK)
            VALUES (@POID, @ITEMCODE, @SUBCODE, @QUANTITY, @DELIVEREDQTY, @PENDINGQTY, @UNIT, @RATE, @AMOUNT, @REMARK)
          `);
      }

      await transaction.commit();
      res.status(200).json({ message: 'Purchase Order updated successfully' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error updating purchase order:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// DELETE /api/purchase-orders/:id
exports.deletePurchaseOrder = async (req, res) => {
  const { id } = req.params;

  let pool;
  try {
    pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Check if any items have been delivered
      const checkDelivered = await new sql.Request(transaction)
        .input('POID', sql.Numeric(8, 0), id)
        .query('SELECT ISNULL(SUM(DELIVEREDQTY), 0) AS TotalDelivered FROM PurchaseOrderDetail WHERE POID = @POID');

      const delivered = checkDelivered.recordset[0]?.TotalDelivered || 0;
      if (delivered > 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: 'Cannot delete this Purchase Order because sales have already been dispatched against it. Please modify or delete the linked Sales (Outward) first.' 
        });
      }

      // Also check if any OutwardHeader directly references this POID
      const checkOutward = await new sql.Request(transaction)
        .input('POID', sql.Numeric(8, 0), id)
        .query('SELECT OUTWARDNO FROM OutwardHeader WHERE POID = @POID');

      if (checkOutward.recordset.length > 0) {
        const outwardNos = checkOutward.recordset.map(r => r.OUTWARDNO).join(', ');
        await transaction.rollback();
        return res.status(400).json({ 
          message: `Cannot delete Purchase Order because it is linked to Sales invoice(s): ${outwardNos}. Please remove or re-link the sales invoices first.` 
        });
      }

      await new sql.Request(transaction)
        .input('POID', sql.Numeric(8, 0), id)
        .query('DELETE FROM PurchaseOrderDetail WHERE POID = @POID');

      await new sql.Request(transaction)
        .input('ID', sql.Numeric(8, 0), id)
        .query('DELETE FROM PurchaseOrderHeader WHERE ID = @ID');

      await transaction.commit();
      res.status(200).json({ message: 'Purchase Order deleted successfully' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

