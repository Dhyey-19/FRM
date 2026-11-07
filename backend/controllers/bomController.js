const { sql, connectDB } = require('../config/db');

// Helper to calculate BOM shortfall breakup for a single parent item
async function calculateBOMShortfall(pool, parentCode, parentSubCode = '', shortfallQty = 1) {
  const cleanParentCode = String(parentCode || '').trim();
  const cleanParentSubCode = String(parentSubCode || '').trim();
  const targetShortfallQty = parseFloat(shortfallQty) > 0 ? parseFloat(shortfallQty) : 1;

  // 1. Fetch Parent Item details
  const parentReq = pool.request()
    .input('ParentCode', sql.VarChar(50), cleanParentCode)
    .input('ParentSubCode', sql.VarChar(50), cleanParentSubCode);

  let parentSql = `
    SELECT 
      ItemCode, 
      ISNULL(SubCode, '') AS SubCode, 
      ItemName, 
      ISNULL(ItemType, 'FINISHED GOOD') AS ItemType, 
      ISNULL(Category, 'Inhouse') AS Category, 
      Unit, 
      ISNULL(Costing, 0) AS Costing, 
      ISNULL(ClosingStock, 0) AS StockInHand,
      ISNULL(WarehouseNo, '') AS WarehouseNo,
      ISNULL(Location, '') AS Location
    FROM ItemMaster 
    WHERE ItemCode = @ParentCode
  `;

  if (cleanParentSubCode) {
    parentSql += ` AND (SubCode = @ParentSubCode OR SubCode = '' OR SubCode IS NULL)`;
  }
  parentSql += ` ORDER BY CASE WHEN SubCode = @ParentSubCode THEN 0 ELSE 1 END LIMIT 1`;

  const parentRes = await parentReq.query(parentSql);
  const parentItem = parentRes.recordset[0] || {
    ItemCode: cleanParentCode,
    SubCode: cleanParentSubCode,
    ItemName: cleanParentCode,
    ItemType: 'FINISHED GOOD',
    Category: 'Inhouse',
    Unit: 'PCS',
    Costing: 0,
    StockInHand: 0,
    WarehouseNo: '',
    Location: ''
  };

  // 2. Fetch Direct BOM Child Items
  // If specific subcode exists in BOM_Master, use it; otherwise fallback to generic (empty subcode)
  let subCodeToMatch = cleanParentSubCode;
  if (cleanParentSubCode) {
    const checkSub = await pool.request()
      .input('CheckCode', sql.VarChar(50), cleanParentCode)
      .input('CheckSub', sql.VarChar(50), cleanParentSubCode)
      .query("SELECT 1 FROM BOM_Master WHERE ParentItemCode = @CheckCode AND ISNULL(ParentSubCode, '') = @CheckSub LIMIT 1");
    if (checkSub.recordset.length === 0) {
      subCodeToMatch = '';
    }
  }

  const bomReq = pool.request()
    .input('BOMParentCode', sql.VarChar(50), cleanParentCode)
    .input('BOMParentSubCode', sql.VarChar(50), subCodeToMatch);

  const bomSql = `
    SELECT 
      b.ParentItemCode,
      ISNULL(b.ParentSubCode, '') AS ParentSubCode,
      b.ChildItemCode,
      ISNULL(b.ChildSubCode, '') AS ChildSubCode,
      b.Quantity AS BOMRatio,
      c.ItemName AS ChildItemName,
      ISNULL(c.ItemType, 'RAW MATERIAL') AS ChildItemType,
      ISNULL(c.Category, 'Inhouse') AS ChildCategory,
      c.Unit AS ChildUnit,
      ISNULL(c.Costing, 0) AS ChildCosting,
      ISNULL(c.ClosingStock, 0) AS ChildStockInHand,
      ISNULL(c.WarehouseNo, '') AS WarehouseNo,
      ISNULL(c.Location, '') AS Location,
      ISNULL(pi.TotalPIPendingQty, 0) AS ChildPendingPIQty
    FROM BOM_Master b
    INNER JOIN ItemMaster c ON b.ChildItemCode = c.ItemCode AND ISNULL(b.ChildSubCode, '') = ISNULL(c.SubCode, '')
    LEFT JOIN (
      SELECT 
        pid.ITEMCODE,
        ISNULL(pid.SUBCODE, '') AS SUBCODE,
        SUM(pid.PENDINGQTY) AS TotalPIPendingQty
      FROM PerformaInvoiceDetail pid
      INNER JOIN PerformaInvoiceHeader pih ON pid.PIID = pih.ID
      WHERE UPPER(pih.STATUS) IN ('ORDERED', 'PARTIALLY RECEIVED', 'DRAFT') AND pid.PENDINGQTY > 0
      GROUP BY pid.ITEMCODE, ISNULL(pid.SUBCODE, '')
    ) pi ON c.ItemCode = pi.ITEMCODE AND ISNULL(c.SubCode, '') = pi.SUBCODE
    WHERE b.ParentItemCode = @BOMParentCode AND ISNULL(b.ParentSubCode, '') = @BOMParentSubCode
    ORDER BY b.ChildItemCode ASC
  `;

  const bomRes = await bomReq.query(bomSql);
  const rawChildItems = bomRes.recordset || [];

  if (rawChildItems.length === 0) {
    return {
      parentItem: {
        ...parentItem,
        ShortfallQty: targetShortfallQty
      },
      hasBOM: false,
      message: `No Bill of Materials (BOM) configured for item ${cleanParentCode}${cleanParentSubCode ? ` (${cleanParentSubCode})` : ''}.`,
      summary: {
        totalChildParts: 0,
        partsInStock: 0,
        partsWithShortfall: 0,
        criticalPartsCount: 0,
        overallReadinessPct: 0,
        totalShortfallValue: 0
      },
      childParts: []
    };
  }

  // 3. Process Child Items & fetch recursive sub-BOM for semi-finished / assemblies
  const childParts = [];
  let partsInStockCount = 0;
  let partsWithShortfallCount = 0;
  let criticalPartsCount = 0;
  let totalChildShortfallValue = 0;

  for (const row of rawChildItems) {
    const bomRatio = parseFloat(row.BOMRatio) || 1;
    const requiredQty = Math.round(targetShortfallQty * bomRatio * 1000) / 1000;
    const stockInHand = parseFloat(row.ChildStockInHand) || 0;
    const pendingPIQty = parseFloat(row.ChildPendingPIQty) || 0;
    const effectiveStock = stockInHand + pendingPIQty;

    // Shortfall formula: max(0, requiredQty - stockInHand)
    const childShortfallQty = Math.max(0, Math.round((requiredQty - stockInHand) * 1000) / 1000);
    const childShortfallAfterPI = Math.max(0, Math.round((requiredQty - effectiveStock) * 1000) / 1000);
    const costing = parseFloat(row.ChildCosting) || 0;
    const shortfallValue = Math.round(childShortfallQty * costing * 100) / 100;
    const coveragePercent = requiredQty > 0 ? Math.min(100, Math.round((stockInHand / requiredQty) * 100)) : 100;

    let status = 'In Stock';
    if (childShortfallQty > 0) {
      if (stockInHand > 0) {
        status = 'Partial Stock';
      } else {
        status = 'Critical Shortfall';
        criticalPartsCount++;
      }
      partsWithShortfallCount++;
    } else {
      partsInStockCount++;
    }

    totalChildShortfallValue += shortfallValue;

    // Check for Level 2 Sub-BOM
    const subReq = pool.request()
      .input('SubParentCode', sql.VarChar(50), row.ChildItemCode)
      .input('SubParentSubCode', sql.VarChar(50), row.ChildSubCode || '');

    const subSql = `
      SELECT 
        sb.ChildItemCode,
        ISNULL(sb.ChildSubCode, '') AS ChildSubCode,
        sb.Quantity AS SubBOMRatio,
        sc.ItemName AS SubChildItemName,
        ISNULL(sc.ItemType, 'RAW MATERIAL') AS SubChildItemType,
        ISNULL(sc.Category, 'Inhouse') AS SubChildCategory,
        sc.Unit AS SubChildUnit,
        ISNULL(sc.Costing, 0) AS SubChildCosting,
        ISNULL(sc.ClosingStock, 0) AS SubChildStockInHand
      FROM BOM_Master sb
      INNER JOIN ItemMaster sc ON sb.ChildItemCode = sc.ItemCode AND ISNULL(sb.ChildSubCode, '') = ISNULL(sc.SubCode, '')
      WHERE sb.ParentItemCode = @SubParentCode
    `;
    const subRes = await subReq.query(subSql);
    const rawSubItems = subRes.recordset || [];

    const subBOM = rawSubItems.map(sub => {
      const subRatio = parseFloat(sub.SubBOMRatio) || 1;
      const subReqQty = Math.round(requiredQty * subRatio * 1000) / 1000;
      const subStock = parseFloat(sub.SubChildStockInHand) || 0;
      const subShortfall = Math.max(0, Math.round((subReqQty - subStock) * 1000) / 1000);
      const subCost = parseFloat(sub.SubChildCosting) || 0;

      return {
        childItemCode: sub.ChildItemCode,
        childSubCode: sub.ChildSubCode,
        childItemName: sub.SubChildItemName,
        itemType: sub.SubChildItemType,
        category: sub.SubChildCategory,
        unit: sub.SubChildUnit,
        bomRatio: subRatio,
        requiredQty: subReqQty,
        stockInHand: subStock,
        childShortfallQty: subShortfall,
        costing: subCost,
        shortfallValue: Math.round(subShortfall * subCost * 100) / 100,
        status: subShortfall === 0 ? 'In Stock' : subStock > 0 ? 'Partial Stock' : 'Critical Shortfall'
      };
    });

    childParts.push({
      childItemCode: row.ChildItemCode,
      childSubCode: row.ChildSubCode || '',
      childItemName: row.ChildItemName,
      category: row.ChildCategory,
      itemType: row.ChildItemType,
      unit: row.ChildUnit,
      warehouseNo: row.WarehouseNo,
      location: row.Location,
      bomRatio,
      requiredQty,
      stockInHand,
      pendingPIQty,
      effectiveStock,
      childShortfallQty,
      childShortfallAfterPI,
      costing,
      shortfallValue,
      coveragePercent,
      status,
      hasSubBOM: subBOM.length > 0,
      subBOM
    });
  }

  const totalChildParts = childParts.length;
  const overallReadinessPct = totalChildParts > 0 ? Math.round((partsInStockCount / totalChildParts) * 100) : 100;

  return {
    parentItem: {
      ...parentItem,
      ShortfallQty: targetShortfallQty
    },
    hasBOM: true,
    summary: {
      totalChildParts,
      partsInStock: partsInStockCount,
      partsWithShortfall: partsWithShortfallCount,
      criticalPartsCount,
      overallReadinessPct,
      totalShortfallValue: Math.round(totalChildShortfallValue * 100) / 100
    },
    childParts
  };
}

// GET /api/bom/shortfall-breakup/:parentCode
exports.getShortfallBOMBreakup = async (req, res) => {
  const { parentCode } = req.params;
  const parentSubCode = (req.query.parentSubCode || req.query.subCode || '').trim();
  const shortfallQty = req.query.shortfallQty || 1;

  if (!parentCode) {
    return res.status(400).json({ message: 'Parent Item Code is required' });
  }

  try {
    const pool = await connectDB();
    const result = await calculateBOMShortfall(pool, parentCode, parentSubCode, shortfallQty);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error calculating BOM shortfall breakup:', error);
    res.status(500).json({ message: 'Server error calculating BOM shortfall breakup', error: error.message });
  }
};

// POST /api/bom/shortfall-breakup/batch
exports.getBatchShortfallBOMBreakup = async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Items array is required' });
  }

  try {
    const pool = await connectDB();
    const results = {};

    for (const it of items) {
      const code = String(it.itemCode || it.ItemCode || '').trim();
      const sub = String(it.subCode || it.SubCode || '').trim();
      const shortfall = parseFloat(it.shortfallQty || it.MissingQty || it.shortfall || 1);
      const key = `${code}___${sub}`;

      if (code) {
        results[key] = await calculateBOMShortfall(pool, code, sub, shortfall);
      }
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('Error calculating batch BOM shortfall breakup:', error);
    res.status(500).json({ message: 'Server error calculating batch BOM shortfall', error: error.message });
  }
};

// GET /api/bom/report
exports.getAllBOMReport = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
        b.ParentItemCode,
        ISNULL(b.ParentSubCode, '') AS ParentSubCode,
        p.ItemName AS ParentItemName,
        p.Series AS ParentBrandName,
        b.ChildItemCode,
        ISNULL(b.ChildSubCode, '') AS ChildSubCode,
        c.ItemName AS ChildItemName,
        b.Quantity,
        ISNULL(c.Costing, 0) AS ChildCosting,
        CAST((b.Quantity * ISNULL(c.Costing, 0)) AS NUMERIC(15,2)) AS TotalChildCost
      FROM BOM_Master b
      INNER JOIN ItemMaster p ON b.ParentItemCode = p.ItemCode AND ISNULL(b.ParentSubCode, '') = ISNULL(p.SubCode, '')
      INNER JOIN ItemMaster c ON b.ChildItemCode = c.ItemCode AND ISNULL(b.ChildSubCode, '') = ISNULL(c.SubCode, '')
      ORDER BY b.ParentItemCode ASC, b.ParentSubCode ASC, b.ChildItemCode ASC
    `);
    
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching BOM Report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/bom/:parentCode
exports.getBOMByParent = async (req, res) => {
  const { parentCode } = req.params;
  const parentSubCode = (req.query.parentSubCode || req.query.subCode || '').trim();

  try {
    const pool = await connectDB();
    const request = pool.request()
      .input('ParentItemCode', sql.VarChar(50), parentCode)
      .input('ParentSubCode', sql.VarChar(50), parentSubCode);

    let query = `
      SELECT b.ChildItemCode, ISNULL(b.ChildSubCode, '') AS ChildSubCode, i.ItemName, i.Unit, b.Quantity
      FROM BOM_Master b
      INNER JOIN ItemMaster i ON b.ChildItemCode = i.ItemCode AND ISNULL(b.ChildSubCode, '') = ISNULL(i.SubCode, '')
      WHERE b.ParentItemCode = @ParentItemCode
    `;

    if (parentSubCode) {
      // Check if subcode-specific BOM exists, otherwise fallback to generic (empty subcode)
      const checkSub = await pool.request()
        .input('CheckParent', sql.VarChar(50), parentCode)
        .input('CheckSub', sql.VarChar(50), parentSubCode)
        .query("SELECT 1 FROM BOM_Master WHERE ParentItemCode = @CheckParent AND ISNULL(ParentSubCode, '') = @CheckSub LIMIT 1");

      if (checkSub.recordset.length > 0) {
        query += ` AND ISNULL(b.ParentSubCode, '') = @ParentSubCode`;
      } else {
        query += ` AND ISNULL(b.ParentSubCode, '') = ''`;
      }
    } else {
      query += ` AND ISNULL(b.ParentSubCode, '') = ''`;
    }

    query += ` ORDER BY b.ChildItemCode ASC`;

    const result = await request.query(query);
      
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching BOM:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/bom
exports.saveBOM = async (req, res) => {
  const { ParentItemCode, ParentSubCode = '', items } = req.body;

  if (!ParentItemCode || !Array.isArray(items)) {
    return res.status(400).json({ message: 'ParentItemCode and an array of items are required' });
  }

  const cleanParentCode = String(ParentItemCode).trim();
  const cleanParentSubCode = String(ParentSubCode || '').trim();

  try {
    const pool = await connectDB();
    
    // Start a transaction for deleting existing and inserting new
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);

      // 1. Delete existing BOM for this parent
      await request
        .input('ParentItemCode', sql.VarChar(50), cleanParentCode)
        .input('ParentSubCode', sql.VarChar(50), cleanParentSubCode)
        .query('DELETE FROM BOM_Master WHERE ParentItemCode = @ParentItemCode AND ISNULL(ParentSubCode, \'\') = @ParentSubCode');

      // 2. Insert new child items
      for (const item of items) {
        if (!item.ChildItemCode || item.Quantity === undefined) continue;
        
        const cleanChildCode = String(item.ChildItemCode).trim();
        const cleanChildSubCode = String(item.ChildSubCode || '').trim();

        const insertReq = new sql.Request(transaction);
        await insertReq
          .input('ParentItemCode', sql.VarChar(50), cleanParentCode)
          .input('ParentSubCode', sql.VarChar(50), cleanParentSubCode)
          .input('ChildItemCode', sql.VarChar(50), cleanChildCode)
          .input('ChildSubCode', sql.VarChar(50), cleanChildSubCode)
          .input('Quantity', sql.Numeric(5, 3), parseFloat(item.Quantity) || 0)
          .query(`
            INSERT INTO BOM_Master (ParentItemCode, ParentSubCode, ChildItemCode, ChildSubCode, Quantity)
            VALUES (@ParentItemCode, @ParentSubCode, @ChildItemCode, @ChildSubCode, @Quantity)
          `);
      }

      await transaction.commit();
      res.status(200).json({ message: 'BOM saved successfully' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error saving BOM:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/bom/:parentCode
exports.deleteBOM = async (req, res) => {
  const { parentCode } = req.params;
  const parentSubCode = (req.query.parentSubCode || req.query.subCode || '').trim();

  try {
    const pool = await connectDB();
    const request = pool.request()
      .input('ParentItemCode', sql.VarChar(50), parentCode)
      .input('ParentSubCode', sql.VarChar(50), parentSubCode);

    let query = 'DELETE FROM BOM_Master WHERE ParentItemCode = @ParentItemCode';
    if (parentSubCode) {
      query += ' AND ISNULL(ParentSubCode, \'\') = @ParentSubCode';
    }

    const result = await request.query(query);

    if (result.rowsAffected && result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'BOM not found for this item' });
    }

    res.status(200).json({ message: 'BOM deleted successfully' });
  } catch (error) {
    console.error('Error deleting BOM:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/bom/bulk
exports.bulkCreateBOM = async (req, res) => {
  const boms = req.body;
  if (!Array.isArray(boms) || boms.length === 0) {
    return res.status(400).json({ message: 'BOM array is required' });
  }

  const results = {
    added: [],
    updated: [],
    failed: []
  };

  try {
    const pool = await connectDB();
    const request = new sql.Request(pool);

    for (const bom of boms) {
      const { ParentItemCode, ChildItemCode, Quantity } = bom;

      if (!ParentItemCode || !ChildItemCode || Quantity === undefined) {
        results.failed.push({ item: bom, reason: 'ParentItemCode, ChildItemCode, and Quantity are required' });
        continue;
      }

      try {
        const checkBOM = await request
          .input('CheckParent', sql.VarChar(10), ParentItemCode)
          .input('CheckChild', sql.VarChar(10), ChildItemCode)
          .query('SELECT ParentItemCode FROM BOM_Master WHERE ParentItemCode = @CheckParent AND ChildItemCode = @CheckChild');
        
        request.parameters = {};

        if (checkBOM.recordset.length > 0) {
          // Update
          await request
            .input('UpdParent', sql.VarChar(10), ParentItemCode)
            .input('UpdChild', sql.VarChar(10), ChildItemCode)
            .input('UpdQty', sql.Numeric(10, 3), parseFloat(Quantity) || 0)
            .query('UPDATE BOM_Master SET Quantity = @UpdQty WHERE ParentItemCode = @UpdParent AND ChildItemCode = @UpdChild');
          request.parameters = {};
          results.updated.push(bom);
        } else {
          // Insert
          await request
            .input('InsParent', sql.VarChar(10), ParentItemCode)
            .input('InsChild', sql.VarChar(10), ChildItemCode)
            .input('InsQty', sql.Numeric(10, 3), parseFloat(Quantity) || 0)
            .query('INSERT INTO BOM_Master (ParentItemCode, ChildItemCode, Quantity) VALUES (@InsParent, @InsChild, @InsQty)');
          request.parameters = {};
          results.added.push(bom);
        }
      } catch (err) {
        request.parameters = {};
        results.failed.push({ item: bom, reason: err.message });
      }
    }
    
    res.status(200).json(results);
  } catch (error) {
    console.error('Error in bulk BOM import:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
