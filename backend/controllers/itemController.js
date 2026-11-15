const { sql, connectDB } = require('../config/db');

// GET /api/items
exports.getItems = async (req, res) => {
  try {
    const { itemCode, subCode, category, search } = req.query;
    const pool = await connectDB();
    const request = pool.request();
    
    let query = `
      SELECT 
        ItemCode, 
        ISNULL(SubCode, '') AS SubCode, 
        ItemName, 
        ItemType, 
        ISNULL(Category, 'Inhouse') AS Category, 
        WarehouseNo, 
        Location, 
        Series, 
        StdWeight, 
        Unit, 
        MRP, 
        Costing, 
        OpeningStock, 
        ClosingStock, 
        HSNCode, 
        ISNULL(ReorderLevel, 0) AS ReorderLevel,
        ISNULL(DeadStockType, 'None') AS DeadStockType,
        ISNULL(DeadStockDays, 0) AS DeadStockDays,
        ISNULL(IsDeadStock, 0) AS IsDeadStock 
      FROM ItemMaster
    `;

    const conditions = [];

    if (itemCode) {
      conditions.push('ItemCode = @ItemCode');
      request.input('ItemCode', sql.VarChar(50), itemCode);
    }

    if (subCode !== undefined && subCode !== null) {
      conditions.push('ISNULL(SubCode, \'\') = @SubCode');
      request.input('SubCode', sql.VarChar(50), subCode.trim());
    }

    if (category && category !== 'All') {
      conditions.push('Category = @Category');
      request.input('Category', sql.VarChar(20), category);
    }

    if (search) {
      conditions.push('(ItemCode LIKE @Search OR SubCode LIKE @Search OR ItemName LIKE @Search OR Series LIKE @Search OR WarehouseNo LIKE @Search OR Location LIKE @Search)');
      request.input('Search', sql.VarChar(100), `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY ItemCode ASC, SubCode ASC';

    const result = await request.query(query);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/items
exports.createItem = async (req, res) => {
  const { 
    ItemCode, 
    SubCode = '', 
    ItemName, 
    ItemType, 
    Category = 'Inhouse', 
    WarehouseNo = '', 
    Location = '', 
    Series, 
    StdWeight, 
    Unit, 
    MRP, 
    Costing, 
    OpeningStock, 
    ClosingStock, 
    HSNCode, 
    ReorderLevel,
    DeadStockType = 'None',
    DeadStockDays = 0,
    IsDeadStock = 0
  } = req.body;

  if (!ItemCode || !ItemName || !Unit) {
    return res.status(400).json({ message: 'ItemCode, ItemName, and Unit are required' });
  }

  const cleanItemCode = String(ItemCode).trim();
  const cleanSubCode = SubCode !== undefined && SubCode !== null ? String(SubCode).trim() : '';
  const validCategory = ['SubContract', 'Inhouse', 'BOP'].includes(Category) ? Category : 'Inhouse';
  const formattedHSN = HSNCode ? String(HSNCode).trim().slice(0, 8).toUpperCase() : null;
  const numReorderLevel = ReorderLevel !== undefined && ReorderLevel !== null && ReorderLevel !== '' ? parseFloat(ReorderLevel) : 0;
  const validDeadStockType = ['None', 'Auto', 'Manual'].includes(DeadStockType) ? DeadStockType : 'None';
  const numDeadStockDays = DeadStockDays !== undefined && DeadStockDays !== null && DeadStockDays !== '' ? parseInt(DeadStockDays, 10) : 0;
  const flagIsDeadStock = (validDeadStockType === 'Manual' || IsDeadStock == 1 || IsDeadStock === true) ? 1 : 0;

  try {
    const pool = await connectDB();
    
    // Check if item already exists with composite key (ItemCode, SubCode)
    const checkItem = await pool.request()
      .input('ItemCode', sql.VarChar(50), cleanItemCode)
      .input('SubCode', sql.VarChar(50), cleanSubCode)
      .query('SELECT ItemCode, SubCode FROM ItemMaster WHERE ItemCode = @ItemCode AND ISNULL(SubCode, \'\') = @SubCode');
      
    if (checkItem.recordset.length > 0) {
      return res.status(400).json({ 
        message: cleanSubCode 
          ? `Item with Code "${cleanItemCode}" and SubCode "${cleanSubCode}" already exists.` 
          : `Item with Code "${cleanItemCode}" already exists.` 
      });
    }

    await pool.request()
      .input('ItemCode', sql.VarChar(50), cleanItemCode)
      .input('SubCode', sql.VarChar(50), cleanSubCode)
      .input('ItemName', sql.VarChar(50), ItemName)
      .input('ItemType', sql.VarChar(15), ItemType || null)
      .input('Category', sql.VarChar(20), validCategory)
      .input('WarehouseNo', sql.VarChar(50), WarehouseNo || '')
      .input('Location', sql.VarChar(100), Location || '')
      .input('Series', sql.VarChar(15), Series || null)
      .input('StdWeight', sql.Numeric(12, 3), StdWeight || null)
      .input('Unit', sql.VarChar(10), Unit || null)
      .input('MRP', sql.Numeric(15, 2), parseFloat(MRP) || 0)
      .input('Costing', sql.Numeric(15, 2), parseFloat(Costing) || 0)
      .input('OpeningStock', sql.Numeric(12, 3), OpeningStock || 0)
      .input('ClosingStock', sql.Numeric(12, 3), ClosingStock !== undefined && ClosingStock !== null && ClosingStock !== '' ? ClosingStock : (OpeningStock || 0))
      .input('HSNCode', sql.VarChar(8), formattedHSN)
      .input('ReorderLevel', sql.Numeric(12, 3), numReorderLevel)
      .input('DeadStockType', sql.VarChar(20), validDeadStockType)
      .input('DeadStockDays', sql.Int, numDeadStockDays)
      .input('IsDeadStock', sql.Int, flagIsDeadStock)
      .query(`
        INSERT INTO ItemMaster (
          ItemCode, SubCode, ItemName, ItemType, Category, WarehouseNo, Location, 
          Series, StdWeight, Unit, MRP, Costing, OpeningStock, ClosingStock, HSNCode, ReorderLevel,
          DeadStockType, DeadStockDays, IsDeadStock
        )
        VALUES (
          @ItemCode, @SubCode, @ItemName, @ItemType, @Category, @WarehouseNo, @Location,
          @Series, @StdWeight, @Unit, @MRP, @Costing, @OpeningStock, @ClosingStock, @HSNCode, @ReorderLevel,
          @DeadStockType, @DeadStockDays, @IsDeadStock
        )
      `);

    res.status(201).json({ message: 'Item created successfully' });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/items/:id
exports.updateItem = async (req, res) => {
  const { id } = req.params;
  const { 
    originalItemCode,
    originalSubCode = '',
    ItemCode, 
    SubCode = '', 
    ItemName, 
    ItemType, 
    Category = 'Inhouse', 
    WarehouseNo = '', 
    Location = '', 
    Series, 
    StdWeight, 
    Unit, 
    MRP, 
    Costing, 
    OpeningStock, 
    ClosingStock, 
    HSNCode, 
    ReorderLevel,
    DeadStockType,
    DeadStockDays,
    IsDeadStock
  } = req.body;

  const targetOldItemCode = (originalItemCode || id || '').trim();
  const targetOldSubCode = (originalSubCode !== undefined && originalSubCode !== null ? String(originalSubCode) : (req.query.subCode || '')).trim();

  const newCleanItemCode = (ItemCode || targetOldItemCode).trim();
  const newCleanSubCode = (SubCode !== undefined && SubCode !== null ? String(SubCode) : '').trim();

  if (!newCleanItemCode || !ItemName || !Unit) {
    return res.status(400).json({ message: 'ItemCode, ItemName, and Unit are required' });
  }

  const validCategory = ['SubContract', 'Inhouse', 'BOP'].includes(Category) ? Category : 'Inhouse';
  const formattedHSN = HSNCode ? String(HSNCode).trim().slice(0, 8).toUpperCase() : null;
  const numReorderLevel = ReorderLevel !== undefined && ReorderLevel !== null && ReorderLevel !== '' ? parseFloat(ReorderLevel) : 0;
  const validDeadStockType = ['None', 'Auto', 'Manual'].includes(DeadStockType) ? DeadStockType : (DeadStockType === undefined ? null : 'None');
  const numDeadStockDays = DeadStockDays !== undefined && DeadStockDays !== null && DeadStockDays !== '' ? parseInt(DeadStockDays, 10) : (DeadStockDays === undefined ? null : 0);
  const flagIsDeadStock = (validDeadStockType === 'Manual' || IsDeadStock == 1 || IsDeadStock === true) ? 1 : (IsDeadStock === undefined ? null : 0);

  try {
    const pool = await connectDB();

    // If changing ItemCode or SubCode, ensure the new composite pair doesn't conflict
    if (targetOldItemCode !== newCleanItemCode || targetOldSubCode !== newCleanSubCode) {
      const checkItem = await pool.request()
        .input('NewItemCode', sql.VarChar(50), newCleanItemCode)
        .input('NewSubCode', sql.VarChar(50), newCleanSubCode)
        .query('SELECT ItemCode, SubCode FROM ItemMaster WHERE ItemCode = @NewItemCode AND ISNULL(SubCode, \'\') = @NewSubCode');
        
      if (checkItem.recordset.length > 0) {
        return res.status(400).json({ 
          message: newCleanSubCode 
            ? `An item with Code "${newCleanItemCode}" and SubCode "${newCleanSubCode}" already exists.` 
            : `An item with Code "${newCleanItemCode}" already exists.` 
        });
      }
    }

    const result = await pool.request()
      .input('OldItemCode', sql.VarChar(50), targetOldItemCode)
      .input('OldSubCode', sql.VarChar(50), targetOldSubCode)
      .input('NewItemCode', sql.VarChar(50), newCleanItemCode)
      .input('NewSubCode', sql.VarChar(50), newCleanSubCode)
      .input('ItemName', sql.VarChar(50), ItemName)
      .input('ItemType', sql.VarChar(15), ItemType || null)
      .input('Category', sql.VarChar(20), validCategory)
      .input('WarehouseNo', sql.VarChar(50), WarehouseNo || '')
      .input('Location', sql.VarChar(100), Location || '')
      .input('Series', sql.VarChar(15), Series || null)
      .input('StdWeight', sql.Numeric(12, 3), StdWeight || null)
      .input('Unit', sql.VarChar(10), Unit || null)
      .input('MRP', sql.Numeric(15, 2), parseFloat(MRP) || 0)
      .input('Costing', sql.Numeric(15, 2), parseFloat(Costing) || 0)
      .input('OpeningStock', sql.Numeric(12, 3), OpeningStock || 0)
      .input('ClosingStock', sql.Numeric(12, 3), ClosingStock !== undefined && ClosingStock !== null && ClosingStock !== '' ? ClosingStock : (OpeningStock || 0))
      .input('HSNCode', sql.VarChar(8), formattedHSN)
      .input('ReorderLevel', sql.Numeric(12, 3), numReorderLevel)
      .input('DeadStockType', sql.VarChar(20), validDeadStockType)
      .input('DeadStockDays', sql.Int, numDeadStockDays)
      .input('IsDeadStock', sql.Int, flagIsDeadStock)
      .query(`
        UPDATE ItemMaster 
        SET ItemCode = @NewItemCode,
            SubCode = @NewSubCode,
            ItemName = @ItemName,
            ItemType = @ItemType,
            Category = @Category,
            WarehouseNo = @WarehouseNo,
            Location = @Location,
            Series = @Series,
            StdWeight = @StdWeight,
            Unit = @Unit,
            MRP = @MRP,
            Costing = @Costing,
            OpeningStock = @OpeningStock,
            ClosingStock = @ClosingStock,
            HSNCode = @HSNCode,
            ReorderLevel = @ReorderLevel,
            DeadStockType = COALESCE(@DeadStockType, DeadStockType),
            DeadStockDays = COALESCE(@DeadStockDays, DeadStockDays),
            IsDeadStock = COALESCE(@IsDeadStock, IsDeadStock)
        WHERE ItemCode = @OldItemCode AND ISNULL(SubCode, '') = @OldSubCode
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.status(200).json({ message: 'Item updated successfully' });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/items/:id
exports.deleteItem = async (req, res) => {
  const { id } = req.params;
  const subCode = (req.query.subCode || req.body?.subCode || '').trim();

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('ItemCode', sql.VarChar(50), id)
      .input('SubCode', sql.VarChar(50), subCode)
      .query(`
        DELETE FROM ItemMaster 
        WHERE ItemCode = @ItemCode AND ISNULL(SubCode, '') = @SubCode
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/items/bulk
exports.bulkCreateItems = async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Items array is required' });
  }

  const results = {
    added: [],
    updated: [],
    failed: []
  };

  try {
    const pool = await connectDB();
    const request = new sql.Request(pool);

    for (const item of items) {
      const { 
        ItemCode, 
        SubCode = '', 
        ItemName, 
        ItemType, 
        Category = 'Inhouse', 
        WarehouseNo = '', 
        Location = '', 
        Series, 
        StdWeight, 
        Unit, 
        MRP, 
        Costing, 
        OpeningStock, 
        ClosingStock 
      } = item;

      if (!ItemCode || !ItemName || !Unit) {
        results.failed.push({ item, reason: `ItemCode, ItemName, and Unit are required` });
        continue;
      }

      const cleanItemCode = String(ItemCode).trim();
      const cleanSubCode = SubCode !== undefined && SubCode !== null ? String(SubCode).trim() : '';
      const validCategory = ['SubContract', 'Inhouse', 'BOP'].includes(Category) ? Category : 'Inhouse';

      try {
        // Check if exists by composite key
        const checkItem = await request
          .input('CheckItemCode', sql.VarChar(50), cleanItemCode)
          .input('CheckSubCode', sql.VarChar(50), cleanSubCode)
          .query('SELECT ItemCode, SubCode FROM ItemMaster WHERE ItemCode = @CheckItemCode AND ISNULL(SubCode, \'\') = @CheckSubCode');

        request.parameters = {}; // Clear parameters

        const formattedHSN = item.HSNCode ? String(item.HSNCode).trim().slice(0, 8).toUpperCase() : null;
        const numReorderLevel = item.ReorderLevel !== undefined && item.ReorderLevel !== null && item.ReorderLevel !== '' ? parseFloat(item.ReorderLevel) : 0;
        const validDeadStockType = ['None', 'Auto', 'Manual'].includes(item.DeadStockType) ? item.DeadStockType : 'None';
        const numDeadStockDays = item.DeadStockDays !== undefined && item.DeadStockDays !== null && item.DeadStockDays !== '' ? parseInt(item.DeadStockDays, 10) : 0;
        const flagIsDeadStock = (validDeadStockType === 'Manual' || item.IsDeadStock == 1 || item.IsDeadStock === true) ? 1 : 0;

        if (checkItem.recordset.length > 0) {
          // Update existing
          await request
            .input('UpdItemCode', sql.VarChar(50), cleanItemCode)
            .input('UpdSubCode', sql.VarChar(50), cleanSubCode)
            .input('UpdItemName', sql.VarChar(50), ItemName)
            .input('UpdItemType', sql.VarChar(15), ItemType || null)
            .input('UpdCategory', sql.VarChar(20), validCategory)
            .input('UpdWarehouseNo', sql.VarChar(50), WarehouseNo || '')
            .input('UpdLocation', sql.VarChar(100), Location || '')
            .input('UpdSeries', sql.VarChar(15), Series || null)
            .input('UpdStdWeight', sql.Numeric(12, 3), StdWeight || null)
            .input('UpdUnit', sql.VarChar(10), Unit || null)
            .input('UpdMRP', sql.Numeric(15, 2), parseFloat(MRP) || 0)
            .input('UpdCosting', sql.Numeric(15, 2), parseFloat(Costing) || 0)
            .input('UpdOpeningStock', sql.Numeric(12, 3), OpeningStock || 0)
            .input('UpdClosingStock', sql.Numeric(12, 3), ClosingStock !== undefined && ClosingStock !== null && ClosingStock !== '' ? ClosingStock : (OpeningStock || 0))
            .input('UpdHSNCode', sql.VarChar(8), formattedHSN)
            .input('UpdReorderLevel', sql.Numeric(12, 3), numReorderLevel)
            .input('UpdDeadStockType', sql.VarChar(20), validDeadStockType)
            .input('UpdDeadStockDays', sql.Int, numDeadStockDays)
            .input('UpdIsDeadStock', sql.Int, flagIsDeadStock)
            .query(`
              UPDATE ItemMaster 
              SET ItemName = @UpdItemName, 
                  ItemType = @UpdItemType, 
                  Category = @UpdCategory,
                  WarehouseNo = @UpdWarehouseNo,
                  Location = @UpdLocation,
                  Series = @UpdSeries, 
                  StdWeight = @UpdStdWeight, 
                  Unit = @UpdUnit,
                  MRP = @UpdMRP, 
                  Costing = @UpdCosting, 
                  OpeningStock = @UpdOpeningStock, 
                  ClosingStock = @UpdClosingStock,
                  HSNCode = @UpdHSNCode, 
                  ReorderLevel = @UpdReorderLevel,
                  DeadStockType = @UpdDeadStockType,
                  DeadStockDays = @UpdDeadStockDays,
                  IsDeadStock = @UpdIsDeadStock
              WHERE ItemCode = @UpdItemCode AND ISNULL(SubCode, '') = @UpdSubCode
            `);
          request.parameters = {};
          results.updated.push(item);
        } else {
          // Insert new
          await request
            .input('InsItemCode', sql.VarChar(50), cleanItemCode)
            .input('InsSubCode', sql.VarChar(50), cleanSubCode)
            .input('InsItemName', sql.VarChar(50), ItemName)
            .input('InsItemType', sql.VarChar(15), ItemType || null)
            .input('InsCategory', sql.VarChar(20), validCategory)
            .input('InsWarehouseNo', sql.VarChar(50), WarehouseNo || '')
            .input('InsLocation', sql.VarChar(100), Location || '')
            .input('InsSeries', sql.VarChar(15), Series || null)
            .input('InsStdWeight', sql.Numeric(12, 3), StdWeight || null)
            .input('InsUnit', sql.VarChar(10), Unit || null)
            .input('InsMRP', sql.Numeric(15, 2), parseFloat(MRP) || 0)
            .input('InsCosting', sql.Numeric(15, 2), parseFloat(Costing) || 0)
            .input('InsOpeningStock', sql.Numeric(12, 3), OpeningStock || 0)
            .input('InsClosingStock', sql.Numeric(12, 3), ClosingStock !== undefined && ClosingStock !== null && ClosingStock !== '' ? ClosingStock : (OpeningStock || 0))
            .input('InsHSNCode', sql.VarChar(8), formattedHSN)
            .input('InsReorderLevel', sql.Numeric(12, 3), numReorderLevel)
            .input('InsDeadStockType', sql.VarChar(20), validDeadStockType)
            .input('InsDeadStockDays', sql.Int, numDeadStockDays)
            .input('InsIsDeadStock', sql.Int, flagIsDeadStock)
            .query(`
              INSERT INTO ItemMaster (
                ItemCode, SubCode, ItemName, ItemType, Category, WarehouseNo, Location,
                Series, StdWeight, Unit, MRP, Costing, OpeningStock, ClosingStock, HSNCode, ReorderLevel,
                DeadStockType, DeadStockDays, IsDeadStock
              )
              VALUES (
                @InsItemCode, @InsSubCode, @InsItemName, @InsItemType, @InsCategory, @InsWarehouseNo, @InsLocation,
                @InsSeries, @InsStdWeight, @InsUnit, @InsMRP, @InsCosting, @InsOpeningStock, @InsClosingStock, @InsHSNCode, @InsReorderLevel,
                @InsDeadStockType, @InsDeadStockDays, @InsIsDeadStock
              )
            `);
          request.parameters = {};
          results.added.push(item);
        }
      } catch (err) {
        request.parameters = {}; // Always clear on error
        results.failed.push({ item, reason: err.message });
      }
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('Error in bulk import:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper to parse entry timestamp from CreatedBy signature (e.g. 'USERNAME - DD/MM/YYYY HH:mm')
const parseEntryTimestamp = (sig) => {
  if (!sig || typeof sig !== 'string') return 0;
  // Match DD/MM/YYYY HH:mm(:ss)?
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
  // Match YYYY-MM-DD HH:mm(:ss)?
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

// Helper to extract time portion (e.g. '10:00') from CreatedBy
const extractEntryTime = (sig) => {
  if (!sig || typeof sig !== 'string') return '';
  const match = sig.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
  return match ? match[1] : '';
};

// GET /api/items/stock-ledger
exports.getItemStockLedger = async (req, res) => {
  try {
    const { itemCode, subCode, startDate, endDate, scope = 'all', deptId } = req.query;

    if (!itemCode) {
      return res.status(400).json({ message: 'itemCode query parameter is required' });
    }

    const pool = await connectDB();

    // 1. Fetch Item Info
    const itemReq = pool.request().input('ItemCode', sql.VarChar(50), itemCode);
    let itemQuery = `
      SELECT ItemCode, ISNULL(SubCode, '') AS SubCode, ItemName, ItemType, Category, WarehouseNo, Location, Series, StdWeight, Unit, MRP, Costing, OpeningStock, ClosingStock
      FROM ItemMaster
      WHERE ItemCode = @ItemCode
    `;
    if (subCode !== undefined && subCode !== null && subCode !== '') {
      itemQuery += ' AND ISNULL(SubCode, \'\') = @SubCode';
      itemReq.input('SubCode', sql.VarChar(50), subCode.trim());
    }
    const itemRes = await itemReq.query(itemQuery);

    if (itemRes.recordset.length === 0) {
      return res.status(404).json({ message: `Item with code "${itemCode}" not found.` });
    }

    const item = itemRes.recordset[0];
    const isWeightBased = ['KG', 'KGS'].includes((item.Unit || '').trim().toUpperCase());

    // 2. Query Inward Transactions
    const inwardReq = pool.request().input('ItemCode', sql.VarChar(10), itemCode);
    const inwardRes = await inwardReq.query(`
      SELECT 
        h.ID as HeaderId,
        h.INWARDNO as DocNo,
        CONVERT(VARCHAR(10), h.INWARDDATE, 120) as TxDate,
        'Inward' as TxType,
        'Inward' as TxCategory,
        'IN' as Direction,
        h.Bill,
        l.LedgerName as PartyName,
        'Supplier: ' + ISNULL(l.LedgerName, 'N/A') as Particulars,
        h.REMARK as Remark,
        NULL as Process,
        d.QUANTITY as Pcs,
        d.NETWT as Weight,
        CASE WHEN ${isWeightBased ? 1 : 0} = 1 THEN ISNULL(d.NETWT, 0) ELSE ISNULL(d.QUANTITY, 0) END as EffectiveQty,
        d.UNIT as Unit,
        d.RATE as Rate,
        d.AMOUNT as Amount,
        h.CREATEDBY as CreatedBy,
        NULL as FromDeptName,
        'Stock' as ToDeptName
      FROM InwardDetail d
      INNER JOIN InwardHeader h ON d.INWARDID = h.ID
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      WHERE d.ITEMCODE = @ItemCode
    `);

    // 3. Query Outward Transactions
    const outwardReq = pool.request().input('ItemCode', sql.VarChar(10), itemCode);
    const outwardRes = await outwardReq.query(`
      SELECT 
        h.ID as HeaderId,
        h.OUTWARDNO as DocNo,
        CONVERT(VARCHAR(10), h.OUTWARDDATE, 120) as TxDate,
        'Outward' as TxType,
        'Outward' as TxCategory,
        'OUT' as Direction,
        h.Bill,
        l.LedgerName as PartyName,
        'Customer: ' + ISNULL(l.LedgerName, 'N/A') as Particulars,
        h.REMARK as Remark,
        NULL as Process,
        d.QUANTITY as Pcs,
        d.NETWT as Weight,
        CASE WHEN ${isWeightBased ? 1 : 0} = 1 THEN ISNULL(d.NETWT, 0) ELSE ISNULL(d.QUANTITY, 0) END as EffectiveQty,
        d.UNIT as Unit,
        d.RATE as Rate,
        d.AMOUNT as Amount,
        h.CREATEDBY as CreatedBy,
        'Stock' as FromDeptName,
        NULL as ToDeptName
      FROM OutwardDetail d
      INNER JOIN OutwardHeader h ON d.OUTWARDID = h.ID
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      WHERE d.ITEMCODE = @ItemCode
    `);

    // 4. Query Jobwork Out Transactions
    const jwOutReq = pool.request().input('ItemCode', sql.VarChar(10), itemCode);
    const jwOutRes = await jwOutReq.query(`
      SELECT 
        h.ID as HeaderId,
        h.JWOUTWARDNO as DocNo,
        CONVERT(VARCHAR(10), h.JWOUTWARDDATE, 120) as TxDate,
        'Jobwork Out' as TxType,
        'Jobwork' as TxCategory,
        'OUT' as Direction,
        h.Bill,
        l.LedgerName as PartyName,
        'Jobwork Sent: ' + ISNULL(l.LedgerName, 'N/A') + 
          CASE WHEN dm.DeptName IS NOT NULL AND dm.DeptName <> 'Stock' THEN ' [From ' + dm.DeptName + ']' ELSE '' END +
          CASE WHEN d.PROCESS IS NOT NULL AND d.PROCESS <> '' THEN ' (' + d.PROCESS + ')' ELSE '' END as Particulars,
        h.REMARK as Remark,
        d.PROCESS as Process,
        d.QUANTITY as Pcs,
        d.NETWT as Weight,
        CASE WHEN ${isWeightBased ? 1 : 0} = 1 THEN ISNULL(d.NETWT, 0) ELSE ISNULL(d.QUANTITY, 0) END as EffectiveQty,
        d.UNIT as Unit,
        d.RATE as Rate,
        ROUND(ISNULL(d.RATE, 0) * (CASE WHEN ${isWeightBased ? 1 : 0} = 1 THEN ISNULL(d.NETWT, 0) ELSE ISNULL(d.QUANTITY, 0) END), 2) as Amount,
        h.CREATEDBY as CreatedBy,
        ISNULL(dm.DeptName, 'Stock') as FromDeptName,
        NULL as ToDeptName
      FROM JobworkOutDetail d
      INNER JOIN JobworkOutHeader h ON d.JWOUTWARDID = h.ID
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      LEFT JOIN DepartmentMaster dm ON h.DeptID = dm.DeptID
      WHERE d.ITEMCODE = @ItemCode
    `);

    // 5. Query Jobwork In (Received finished items)
    const jwInReq = pool.request().input('ItemCode', sql.VarChar(10), itemCode);
    const jwInRes = await jwInReq.query(`
      SELECT 
        h.ID as HeaderId,
        h.JWINWARDNO as DocNo,
        CONVERT(VARCHAR(10), h.JWINWARDDATE, 120) as TxDate,
        'Jobwork In' as TxType,
        'Jobwork' as TxCategory,
        'IN' as Direction,
        h.Bill,
        l.LedgerName as PartyName,
        'Jobwork Received: ' + ISNULL(l.LedgerName, 'N/A') + 
          CASE WHEN d.OUTITEMCODE IS NOT NULL AND d.OUTITEMCODE <> '' THEN ' [From Raw: ' + d.OUTITEMCODE + ']' ELSE '' END +
          CASE WHEN d.PROCESS IS NOT NULL AND d.PROCESS <> '' THEN ' (' + d.PROCESS + ')' ELSE '' END as Particulars,
        h.REMARK as Remark,
        d.PROCESS as Process,
        d.QUANTITY as Pcs,
        d.NETWT as Weight,
        CASE WHEN ${isWeightBased ? 1 : 0} = 1 THEN ISNULL(d.NETWT, 0) ELSE ISNULL(d.QUANTITY, 0) END as EffectiveQty,
        d.UNIT as Unit,
        d.RATE as Rate,
        d.AMOUNT as Amount,
        h.CREATEDBY as CreatedBy,
        NULL as FromDeptName,
        'Stock' as ToDeptName
      FROM JobworkInDetail d
      INNER JOIN JobworkInHeader h ON d.JWINWARDID = h.ID
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      WHERE d.INITEMCODE = @ItemCode
    `);

    // 6. Query Jobwork In (Scrap generated)
    const jwInScrapReq = pool.request().input('ItemCode', sql.VarChar(10), itemCode);
    const jwInScrapRes = await jwInScrapReq.query(`
      SELECT 
        h.ID as HeaderId,
        h.JWINWARDNO as DocNo,
        CONVERT(VARCHAR(10), h.JWINWARDDATE, 120) as TxDate,
        'Jobwork In (Scrap)' as TxType,
        'Jobwork' as TxCategory,
        'IN' as Direction,
        h.Bill,
        l.LedgerName as PartyName,
        'Jobwork Scrap: ' + ISNULL(l.LedgerName, 'N/A') + 
          CASE WHEN d.OUTITEMCODE IS NOT NULL AND d.OUTITEMCODE <> '' THEN ' [From Raw: ' + d.OUTITEMCODE + ']' ELSE '' END as Particulars,
        h.REMARK as Remark,
        NULL as Process,
        d.SCRAPPCS as Pcs,
        d.SCRAPWT as Weight,
        CASE WHEN ${isWeightBased ? 1 : 0} = 1 THEN ISNULL(d.SCRAPWT, 0) ELSE ISNULL(d.SCRAPPCS, 0) END as EffectiveQty,
        d.UNIT as Unit,
        0 as Rate,
        0 as Amount,
        h.CREATEDBY as CreatedBy,
        NULL as FromDeptName,
        'Stock' as ToDeptName
      FROM JobworkInDetail d
      INNER JOIN JobworkInHeader h ON d.JWINWARDID = h.ID
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      WHERE d.SCRAPITEMCODE = @ItemCode
    `);

    // 7. Query Stock Transfers (Out Item)
    const stOutReq = pool.request().input('ItemCode', sql.VarChar(10), itemCode);
    const stOutRes = await stOutReq.query(`
      SELECT 
        st.MoveID as HeaderId,
        CAST(st.TransferID as VARCHAR(20)) as DocNo,
        st.ManualChallanNo as ManualChallanNo,
        CONVERT(VARCHAR(10), st.MoveDate, 120) as TxDate,
        'Stock Transfer Out' as TxType,
        'Stock Transfer' as TxCategory,
        'OUT' as Direction,
        1 as Bill,
        NULL as PartyName,
        'Transfer Out: ' + ISNULL(fd.DeptName, 'Stock') + ' -> ' + ISNULL(td.DeptName, 'Unknown') as Particulars,
        st.Remarks as Remark,
        NULL as Process,
        st.OutPcs as Pcs,
        st.OutWeight as Weight,
        CASE WHEN ${isWeightBased ? 1 : 0} = 1 THEN ISNULL(st.OutWeight, 0) ELSE ISNULL(st.OutPcs, 0) END as EffectiveQty,
        st.Unit as Unit,
        st.Rate as Rate,
        st.Amount as Amount,
        st.CreatedBy as CreatedBy,
        fd.DeptName as FromDeptName,
        td.DeptName as ToDeptName,
        fd.DeptID as FromDeptID,
        td.DeptID as ToDeptID
      FROM StockTransfer st
      LEFT JOIN DepartmentMaster fd ON st.FromDeptID = fd.DeptID
      LEFT JOIN DepartmentMaster td ON st.ToDeptID = td.DeptID
      WHERE st.OutItemCode = @ItemCode
    `);

    // 8. Query Stock Transfers (In Item)
    const stInReq = pool.request().input('ItemCode', sql.VarChar(10), itemCode);
    const stInRes = await stInReq.query(`
      SELECT 
        st.MoveID as HeaderId,
        CAST(st.TransferID as VARCHAR(20)) as DocNo,
        st.ManualChallanNo as ManualChallanNo,
        CONVERT(VARCHAR(10), st.MoveDate, 120) as TxDate,
        'Stock Transfer In' as TxType,
        'Stock Transfer' as TxCategory,
        'IN' as Direction,
        1 as Bill,
        NULL as PartyName,
        'Transfer In: ' + ISNULL(fd.DeptName, 'Unknown') + ' -> ' + ISNULL(td.DeptName, 'Stock') as Particulars,
        st.Remarks as Remark,
        NULL as Process,
        st.InPcs as Pcs,
        st.InWeight as Weight,
        CASE WHEN ${isWeightBased ? 1 : 0} = 1 THEN ISNULL(st.InWeight, 0) ELSE ISNULL(st.InPcs, 0) END as EffectiveQty,
        st.Unit as Unit,
        st.Rate as Rate,
        st.Amount as Amount,
        st.CreatedBy as CreatedBy,
        fd.DeptName as FromDeptName,
        td.DeptName as ToDeptName,
        fd.DeptID as FromDeptID,
        td.DeptID as ToDeptID
      FROM StockTransfer st
      LEFT JOIN DepartmentMaster fd ON st.FromDeptID = fd.DeptID
      LEFT JOIN DepartmentMaster td ON st.ToDeptID = td.DeptID
      WHERE st.InItemCode = @ItemCode
    `);

    // 9. Query Stock Transfers (Scrap Item)
    const stScrapReq = pool.request().input('ItemCode', sql.VarChar(10), itemCode);
    const stScrapRes = await stScrapReq.query(`
      SELECT 
        st.MoveID as HeaderId,
        CAST(st.TransferID as VARCHAR(20)) as DocNo,
        st.ManualChallanNo as ManualChallanNo,
        CONVERT(VARCHAR(10), st.MoveDate, 120) as TxDate,
        'Stock Transfer (Scrap)' as TxType,
        'Stock Transfer' as TxCategory,
        'IN' as Direction,
        1 as Bill,
        NULL as PartyName,
        'Transfer Scrap: ' + ISNULL(fd.DeptName, 'Unknown') + ' -> ' + ISNULL(td.DeptName, 'Stock') as Particulars,
        st.Remarks as Remark,
        NULL as Process,
        st.ScrapPcs as Pcs,
        st.ScrapWeight as Weight,
        CASE WHEN ${isWeightBased ? 1 : 0} = 1 THEN ISNULL(st.ScrapWeight, 0) ELSE ISNULL(st.ScrapPcs, 0) END as EffectiveQty,
        st.Unit as Unit,
        st.Rate as Rate,
        st.Amount as Amount,
        st.CreatedBy as CreatedBy,
        fd.DeptName as FromDeptName,
        td.DeptName as ToDeptName,
        fd.DeptID as FromDeptID,
        td.DeptID as ToDeptID
      FROM StockTransfer st
      LEFT JOIN DepartmentMaster fd ON st.FromDeptID = fd.DeptID
      LEFT JOIN DepartmentMaster td ON st.ToDeptID = td.DeptID
      WHERE st.ScrapItemCode = @ItemCode
    `);

    // 10. Query Stock Journal Entries
    const sjReq = pool.request().input('ItemCode', sql.VarChar(10), itemCode);
    const sjRes = await sjReq.query(`
      SELECT 
        sj.SJID as HeaderId,
        CAST(sj.SJID as VARCHAR(20)) as DocNo,
        CONVERT(VARCHAR(10), sj.SJDate, 120) as TxDate,
        CASE WHEN sj.SJType = 'Production' THEN 'Stock Journal (Production)' ELSE 'Stock Journal (Consumption)' END as TxType,
        'Stock Journal' as TxCategory,
        CASE WHEN sj.SJType = 'Production' THEN 'IN' ELSE 'OUT' END as Direction,
        1 as Bill,
        NULL as PartyName,
        'Stock Journal: ' + sj.SJType as Particulars,
        sj.Remarks as Remark,
        NULL as Process,
        CASE WHEN ${isWeightBased ? 1 : 0} = 1 THEN 0 ELSE sj.Qty END as Pcs,
        CASE WHEN ${isWeightBased ? 1 : 0} = 1 THEN sj.Qty ELSE 0 END as Weight,
        sj.Qty as EffectiveQty,
        '${item.Unit || 'PCS'}' as Unit,
        0 as Rate,
        0 as Amount,
        sj.CreatedBy as CreatedBy,
        CASE WHEN sj.SJType = 'Production' THEN NULL ELSE 'Stock' END as FromDeptName,
        CASE WHEN sj.SJType = 'Production' THEN 'Stock' ELSE NULL END as ToDeptName
      FROM StockJournal sj
      WHERE sj.ItemCode = @ItemCode
    `);

    // 11. Query Assembly Transactions
    const assemProdReq = pool.request().input('ItemCode', sql.VarChar(10), itemCode);
    const assemProdRes = await assemProdReq.query(`
      SELECT 
        a.ID as HeaderId,
        CAST(a.AssemblyNo as VARCHAR(20)) as DocNo,
        CONVERT(VARCHAR(10), a.AssemblyDate, 120) as TxDate,
        'Assembly (Production)' as TxType,
        'Assembly' as TxCategory,
        'IN' as Direction,
        1 as Bill,
        NULL as PartyName,
        'Assembly Produced' as Particulars,
        a.Remark as Remark,
        NULL as Process,
        a.Quantity as Pcs,
        0 as Weight,
        a.Quantity as EffectiveQty,
        '${item.Unit || 'PCS'}' as Unit,
        0 as Rate,
        0 as Amount,
        a.CreatedBy as CreatedBy,
        NULL as FromDeptName,
        'Stock' as ToDeptName
      FROM AssemblyTransactions a
      WHERE a.ItemCode = @ItemCode
    `);

    const assemConsReq = pool.request().input('ItemCode', sql.VarChar(10), itemCode);
    const assemConsRes = await assemConsReq.query(`
      SELECT 
        a.ID as HeaderId,
        CAST(a.AssemblyNo as VARCHAR(20)) as DocNo,
        CONVERT(VARCHAR(10), a.AssemblyDate, 120) as TxDate,
        'Assembly (Consumption)' as TxType,
        'Assembly' as TxCategory,
        'OUT' as Direction,
        1 as Bill,
        NULL as PartyName,
        'Assembly Consumed for: ' + ISNULL(pi.ItemName, a.ItemCode) as Particulars,
        a.Remark as Remark,
        NULL as Process,
        (b.Quantity * a.Quantity) as Pcs,
        0 as Weight,
        (b.Quantity * a.Quantity) as EffectiveQty,
        '${item.Unit || 'PCS'}' as Unit,
        0 as Rate,
        0 as Amount,
        a.CreatedBy as CreatedBy,
        'Stock' as FromDeptName,
        NULL as ToDeptName
      FROM AssemblyTransactions a
      INNER JOIN BOM_Master b ON a.ItemCode = b.ParentItemCode
      LEFT JOIN ItemMaster pi ON a.ItemCode = pi.ItemCode
      WHERE b.ChildItemCode = @ItemCode
    `);

    // Combine all records
    let allTransactions = [
      ...inwardRes.recordset,
      ...outwardRes.recordset,
      ...jwOutRes.recordset,
      ...jwInRes.recordset,
      ...jwInScrapRes.recordset,
      ...stOutRes.recordset,
      ...stInRes.recordset,
      ...stScrapRes.recordset,
      ...sjRes.recordset,
      ...assemProdRes.recordset,
      ...assemConsRes.recordset
    ];

    // Filter by Scope / Department if requested
    if (scope === 'stock') {
      // Only movements that directly affect central warehouse (ItemMaster)
      allTransactions = allTransactions.filter(tx => {
        if (tx.TxCategory === 'Stock Transfer') {
          const fromStock = (tx.FromDeptName || '').toLowerCase() === 'stock';
          const toStock = (tx.ToDeptName || '').toLowerCase() === 'stock';
          return fromStock || toStock || tx.TxType.includes('Scrap');
        }
        return true;
      });
    } else if (deptId && deptId !== 'all') {
      const targetDeptId = Number(deptId);
      allTransactions = allTransactions.filter(tx => {
        if (tx.TxCategory === 'Stock Transfer') {
          return tx.FromDeptID === targetDeptId || tx.ToDeptID === targetDeptId;
        }
        // Central transactions count as Stock department (DeptID 1)
        if (targetDeptId === 1) return true;
        return false;
      });
    }

    // Sort chronologically: ascending order of date, then by entry timestamp (from CreatedBy)
    allTransactions.sort((a, b) => {
      const dateA = new Date(a.TxDate || '1970-01-01').getTime();
      const dateB = new Date(b.TxDate || '1970-01-01').getTime();
      if (dateA !== dateB) return dateA - dateB;

      const timeA = parseEntryTimestamp(a.CreatedBy);
      const timeB = parseEntryTimestamp(b.CreatedBy);
      if (timeA !== timeB) return timeA - timeB;

      return (Number(a.HeaderId) || 0) - (Number(b.HeaderId) || 0);
    });

    // Calculate Opening Stock prior to startDate
    let openingStock = Number(item.OpeningStock || 0);
    let activeTransactions = [];

    const startFilter = startDate ? new Date(startDate) : null;
    const endFilter = endDate ? new Date(endDate) : null;

    if (startFilter) {
      startFilter.setHours(0, 0, 0, 0);
    }
    if (endFilter) {
      endFilter.setHours(23, 59, 59, 999);
    }

    for (const tx of allTransactions) {
      const txDate = tx.TxDate ? new Date(tx.TxDate) : new Date('1970-01-01');
      const qty = Number(tx.EffectiveQty || 0);

      if (startFilter && txDate < startFilter) {
        if (tx.Direction === 'IN') {
          openingStock += qty;
        } else {
          openingStock -= qty;
        }
      } else if (!endFilter || txDate <= endFilter) {
        activeTransactions.push(tx);
      }
    }

    // Compute running balance across in-period active transactions
    let runningBalance = openingStock;
    let totalIn = 0;
    let totalOut = 0;

    const formattedTransactions = activeTransactions.map((tx, idx) => {
      const qty = Number(tx.EffectiveQty || 0);
      if (tx.Direction === 'IN') {
        runningBalance += qty;
        totalIn += qty;
      } else {
        runningBalance -= qty;
        totalOut += qty;
      }

      return {
        id: `${tx.TxCategory}-${tx.HeaderId}-${idx}`,
        headerId: tx.HeaderId,
        date: tx.TxDate,
        docNo: tx.ManualChallanNo ? `${tx.DocNo} (Ch: ${tx.ManualChallanNo})` : tx.DocNo,
        manualChallanNo: tx.ManualChallanNo || null,
        type: tx.TxType,
        category: tx.TxCategory,
        direction: tx.Direction,
        bill: tx.Bill,
        partyName: tx.PartyName,
        particulars: tx.Particulars,
        remark: tx.Remark,
        process: tx.Process,
        pcs: Number(tx.Pcs || 0),
        weight: Number(tx.Weight || 0),
        effectiveQty: qty,
        unit: tx.Unit || item.Unit,
        rate: Number(tx.Rate || 0),
        amount: Number(tx.Amount || 0),
        createdBy: tx.CreatedBy,
        entryTime: extractEntryTime(tx.CreatedBy),
        fromDeptName: tx.FromDeptName,
        toDeptName: tx.ToDeptName,
        runningStock: Number(runningBalance.toFixed(3))
      };
    });

    const netMovement = Number((totalIn - totalOut).toFixed(3));
    const closingStock = Number(runningBalance.toFixed(3));

    // 10. Query Department-wise Stock Bifurcation
    const deptStockRes = await pool.request()
      .input('ItemCode', sql.VarChar(10), itemCode)
      .query(`
        SELECT 
          dm.DeptID,
          dm.DeptName,
          ISNULL(ds.Pcs, 0) as Pcs,
          ISNULL(ds.Weight, 0) as Weight
        FROM DepartmentMaster dm
        LEFT JOIN DepartmentStock ds ON dm.DeptID = ds.DeptID AND ds.ItemCode = @ItemCode
        ORDER BY dm.DeptID ASC
      `);

    const mainDept = deptStockRes.recordset.find(d => d.DeptName.toLowerCase() === 'stock') || { DeptID: 1, DeptName: 'Stock' };
    const otherDepts = deptStockRes.recordset.filter(d => d.DeptName.toLowerCase() !== 'stock');

    const isWeight = ['KG', 'KGS'].includes((item.Unit || '').trim().toUpperCase());
    const mainStockQty = Number(item.ClosingStock || 0);

    const departmentPositions = otherDepts.map(d => {
      const pcs = Number(d.Pcs || 0);
      const weight = Number(d.Weight || 0);
      const qty = isWeight ? weight : pcs;
      return {
        deptId: d.DeptID,
        deptName: d.DeptName,
        pcs,
        weight,
        qty: Number(qty.toFixed(3)),
        unit: item.Unit
      };
    });

    const totalDeptPcs = departmentPositions.reduce((sum, d) => sum + d.pcs, 0);
    const totalDeptWeight = Number(departmentPositions.reduce((sum, d) => sum + d.weight, 0).toFixed(3));
    const totalDeptQty = Number(departmentPositions.reduce((sum, d) => sum + d.qty, 0).toFixed(3));
    const totalCompanyStock = Number((mainStockQty + totalDeptQty).toFixed(3));

    const stockBifurcation = {
      mainStock: {
        deptId: mainDept.DeptID,
        deptName: 'Main Stock (Central Store)',
        qty: mainStockQty,
        unit: item.Unit,
        pcs: isWeight ? null : mainStockQty,
        weight: isWeight ? mainStockQty : null
      },
      departmentStocks: departmentPositions,
      totalDepartmentStock: totalDeptQty,
      totalDepartmentPcs: totalDeptPcs,
      totalDepartmentWeight: totalDeptWeight,
      totalCompanyStock,
      unit: item.Unit,
      isWeightBased: isWeight
    };

    res.status(200).json({
      item,
      summary: {
        openingStock: Number(openingStock.toFixed(3)),
        totalIn: Number(totalIn.toFixed(3)),
        totalOut: Number(totalOut.toFixed(3)),
        netMovement,
        closingStock,
        startDate: startDate || null,
        endDate: endDate || null,
        transactionCount: formattedTransactions.length
      },
      stockBifurcation,
      transactions: formattedTransactions
    });

  } catch (error) {
    console.error('Error fetching item stock ledger:', error);
    res.status(500).json({ message: 'Server error fetching item stock ledger', error: error.message });
  }
};

// GET /api/items/combined-stock
exports.getCombinedStockReport = async (req, res) => {
  try {
    const pool = await connectDB();

    const [itemsRes, deptRes, jwRes] = await Promise.all([
      pool.request().query(`
        SELECT 
          ItemCode, ISNULL(SubCode, '') AS SubCode, ItemName, ItemType, ISNULL(Category, 'Inhouse') AS Category, 
          WarehouseNo, Location, Series, StdWeight, Unit, MRP, Costing, 
          ISNULL(ClosingStock, 0) AS MainStock 
        FROM ItemMaster 
        ORDER BY ItemCode ASC, SubCode ASC
      `),
      pool.request().query(`
        SELECT 
          ds.DeptID, 
          ISNULL(dm.DeptName, 'Unknown Department') AS DeptName, 
          ds.ItemCode, 
          ISNULL(ds.SubCode, '') AS SubCode,
          ISNULL(ds.Pcs, 0) AS Pcs, 
          ISNULL(ds.Weight, 0) AS Weight 
        FROM DepartmentStock ds 
        LEFT JOIN DepartmentMaster dm ON ds.DeptID = dm.DeptID 
        WHERE ISNULL(ds.Pcs, 0) != 0 OR ISNULL(ds.Weight, 0) != 0
      `),
      pool.request().query(`
        SELECT 
          l.Id AS LedgerId,
          ISNULL(l.LedgerName, 'Unknown Job Worker') AS LedgerName,
          d.ITEMCODE AS ItemCode,
          ISNULL(d.SUBCODE, '') AS SubCode,
          (SUM(d.QUANTITY) - ISNULL(inwards.InQty, 0)) AS BalQty,
          (SUM(d.NETWT) - ISNULL(inwards.InNetWt, 0)) AS BalNetWt
        FROM JobworkOutDetail d
        INNER JOIN JobworkOutHeader h ON d.JWOUTWARDID = h.ID
        LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
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
        GROUP BY l.Id, l.LedgerName, d.ITEMCODE, ISNULL(d.SUBCODE, ''), inwards.InQty, inwards.InNetWt
        HAVING (SUM(d.QUANTITY) - ISNULL(inwards.InQty, 0)) > 0 OR (SUM(d.NETWT) - ISNULL(inwards.InNetWt, 0)) > 0
      `)
    ]);

    // Group DepartmentStock by ItemCode and SubCode
    const deptMap = {};
    for (const row of deptRes.recordset) {
      const key = `${row.ItemCode}__${row.SubCode || ''}`;
      if (!deptMap[key]) deptMap[key] = [];
      deptMap[key].push({
        DeptID: row.DeptID,
        DeptName: row.DeptName,
        Pcs: Number(row.Pcs || 0),
        Weight: Number(Number(row.Weight || 0).toFixed(3))
      });
    }

    // Group Jobwork by ItemCode and SubCode
    const jwMap = {};
    for (const row of jwRes.recordset) {
      const key = `${row.ItemCode}__${row.SubCode || ''}`;
      if (!jwMap[key]) jwMap[key] = [];
      jwMap[key].push({
        LedgerId: row.LedgerId,
        LedgerName: row.LedgerName,
        BalQty: Number(row.BalQty || 0),
        BalNetWt: Number(Number(row.BalNetWt || 0).toFixed(3))
      });
    }

    const combined = itemsRes.recordset.map(item => {
      const itemKey = `${item.ItemCode}__${item.SubCode || ''}`;
      const depts = deptMap[itemKey] || [];
      const jws = jwMap[itemKey] || [];

      const mainStock = Number(item.MainStock || 0);
      const deptStock = depts.reduce((sum, d) => sum + d.Pcs, 0);
      const deptWeight = Number(depts.reduce((sum, d) => sum + d.Weight, 0).toFixed(3));
      const jwStock = jws.reduce((sum, j) => sum + j.BalQty, 0);
      const jwWeight = Number(jws.reduce((sum, j) => sum + j.BalNetWt, 0).toFixed(3));

      const totalStock = mainStock + deptStock + jwStock;
      const totalWeight = Number((item.StdWeight ? totalStock * Number(item.StdWeight) : (deptWeight + jwWeight)).toFixed(3));
      const valuation = Number((totalStock * Number(item.Costing || 0)).toFixed(2));

      return {
        ...item,
        MainStock: mainStock,
        DeptStock: deptStock,
        DeptWeight: deptWeight,
        JwStock: jwStock,
        JwWeight: jwWeight,
        TotalStock: totalStock,
        TotalWeight: totalWeight,
        Valuation: valuation,
        Departments: depts,
        Jobworkers: jws
      };
    });

    res.status(200).json(combined);
  } catch (error) {
    console.error('Error fetching combined stock report:', error);
    res.status(500).json({ message: 'Server error fetching combined stock report', error: error.message });
  }
};

// GET /api/items/dead-stock
exports.getDeadStockReport = async (req, res) => {
  try {
    const { category, type, search } = req.query; // type: 'All', 'Auto', 'Manual'
    const pool = await connectDB();

    // 1. Fetch all items with dead stock columns
    const [itemsRes, movementRes, deptRes, jwRes] = await Promise.all([
      pool.request().query(`
        SELECT 
          ItemCode, 
          ISNULL(SubCode, '') AS SubCode, 
          ItemName, 
          ItemType, 
          ISNULL(Category, 'Inhouse') AS Category, 
          WarehouseNo, 
          Location, 
          Series, 
          StdWeight, 
          Unit, 
          MRP, 
          Costing, 
          OpeningStock, 
          ISNULL(ClosingStock, 0) AS ClosingStock, 
          HSNCode, 
          ISNULL(ReorderLevel, 0) AS ReorderLevel,
          ISNULL(DeadStockType, 'None') AS DeadStockType,
          ISNULL(DeadStockDays, 0) AS DeadStockDays,
          ISNULL(IsDeadStock, 0) AS IsDeadStock
        FROM ItemMaster
        ORDER BY ItemCode ASC, SubCode ASC
      `),
      pool.request().query(`
        SELECT 
          ItemCode,
          SubCode,
          MAX(TxDate) AS LastMovementDate
        FROM (
          SELECT d.ITEMCODE AS ItemCode, ISNULL(d.SUBCODE, '') AS SubCode, h.INWARDDATE AS TxDate
          FROM InwardDetail d JOIN InwardHeader h ON d.INWARDID = h.ID
          UNION ALL
          SELECT d.ITEMCODE AS ItemCode, ISNULL(d.SUBCODE, '') AS SubCode, h.OUTWARDDATE AS TxDate
          FROM OutwardDetail d JOIN OutwardHeader h ON d.OUTWARDID = h.ID
          UNION ALL
          SELECT d.ITEMCODE AS ItemCode, ISNULL(d.SUBCODE, '') AS SubCode, h.JWOUTWARDDATE AS TxDate
          FROM JobworkOutDetail d JOIN JobworkOutHeader h ON d.JWOUTWARDID = h.ID
          UNION ALL
          SELECT d.INITEMCODE AS ItemCode, ISNULL(d.INSUBCODE, '') AS SubCode, h.JWINWARDDATE AS TxDate
          FROM JobworkInDetail d JOIN JobworkInHeader h ON d.JWINWARDID = h.ID
          UNION ALL
          SELECT d.OUTITEMCODE AS ItemCode, ISNULL(d.OUTSUBCODE, '') AS SubCode, h.JWINWARDDATE AS TxDate
          FROM JobworkInDetail d JOIN JobworkInHeader h ON d.JWINWARDID = h.ID
          UNION ALL
          SELECT d.SCRAPITEMCODE AS ItemCode, ISNULL(d.SCRAPSUBCODE, '') AS SubCode, h.JWINWARDDATE AS TxDate
          FROM JobworkInDetail d JOIN JobworkInHeader h ON d.JWINWARDID = h.ID
          UNION ALL
          SELECT st.OutItemCode AS ItemCode, ISNULL(st.OutSubCode, '') AS SubCode, st.MoveDate AS TxDate
          FROM StockTransfer st
          UNION ALL
          SELECT st.InItemCode AS ItemCode, ISNULL(st.InSubCode, '') AS SubCode, st.MoveDate AS TxDate
          FROM StockTransfer st
          UNION ALL
          SELECT st.ScrapItemCode AS ItemCode, ISNULL(st.ScrapSubCode, '') AS SubCode, st.MoveDate AS TxDate
          FROM StockTransfer st
          UNION ALL
          SELECT sj.ItemCode AS ItemCode, ISNULL(sj.SubCode, '') AS SubCode, sj.SJDate AS TxDate
          FROM StockJournal sj
          UNION ALL
          SELECT a.ItemCode AS ItemCode, ISNULL(a.SubCode, '') AS SubCode, a.AssemblyDate AS TxDate
          FROM AssemblyTransactions a
        )
        WHERE ItemCode IS NOT NULL AND ItemCode <> ''
        GROUP BY ItemCode, SubCode
      `),
      pool.request().query(`
        SELECT ItemCode, ISNULL(SubCode, '') AS SubCode, SUM(ISNULL(Pcs, 0)) AS DeptStock
        FROM DepartmentStock
        GROUP BY ItemCode, ISNULL(SubCode, '')
      `),
      pool.request().query(`
        SELECT 
          d.ITEMCODE AS ItemCode,
          ISNULL(d.SUBCODE, '') AS SubCode,
          (SUM(d.QUANTITY) - ISNULL(inwards.InQty, 0)) AS JwStock
        FROM JobworkOutDetail d
        INNER JOIN JobworkOutHeader h ON d.JWOUTWARDID = h.ID
        LEFT JOIN (
          SELECT 
            jwh.LEDGERID,
            jwd.OUTITEMCODE,
            ISNULL(jwd.OUTSUBCODE, '') AS OUTSUBCODE,
            SUM(jwd.QUANTITY) AS InQty
          FROM JobworkInDetail jwd
          INNER JOIN JobworkInHeader jwh ON jwd.JWINWARDID = jwh.ID
          GROUP BY jwh.LEDGERID, jwd.OUTITEMCODE, ISNULL(jwd.OUTSUBCODE, '')
        ) inwards ON h.LEDGERID = inwards.LEDGERID AND d.ITEMCODE = inwards.OUTITEMCODE AND ISNULL(d.SUBCODE, '') = inwards.OUTSUBCODE
        GROUP BY d.ITEMCODE, ISNULL(d.SUBCODE, ''), inwards.InQty
        HAVING (SUM(d.QUANTITY) - ISNULL(inwards.InQty, 0)) > 0
      `)
    ]);

    // Movement map
    const movementMap = {};
    for (const row of movementRes.recordset) {
      const key = `${row.ItemCode}__${row.SubCode || ''}`;
      movementMap[key] = row.LastMovementDate ? String(row.LastMovementDate).slice(0, 10) : null;
    }

    // Dept stock map
    const deptStockMap = {};
    for (const row of deptRes.recordset) {
      const key = `${row.ItemCode}__${row.SubCode || ''}`;
      deptStockMap[key] = Number(row.DeptStock || 0);
    }

    // JW stock map
    const jwStockMap = {};
    for (const row of jwRes.recordset) {
      const key = `${row.ItemCode}__${row.SubCode || ''}`;
      jwStockMap[key] = Number(row.JwStock || 0);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadStockList = [];

    for (const item of itemsRes.recordset) {
      const itemKey = `${item.ItemCode}__${item.SubCode || ''}`;
      const lastMovement = movementMap[itemKey] || null;

      let daysInactive = null;
      if (lastMovement) {
        const mvDate = new Date(lastMovement);
        if (!isNaN(mvDate.getTime())) {
          const diffTime = today.getTime() - mvDate.getTime();
          daysInactive = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        }
      }

      const deadStockType = (item.DeadStockType || 'None').trim();
      const deadStockDays = parseInt(item.DeadStockDays, 10) || 0;
      const isManualDeclared = deadStockType === 'Manual' || item.IsDeadStock === 1;

      // Auto criteria: DeadStockType is 'Auto' AND deadStockDays > 0 AND (daysInactive >= deadStockDays OR never moved)
      const isAutoDeclared = deadStockType === 'Auto' && deadStockDays > 0 && (
        daysInactive === null || daysInactive >= deadStockDays
      );

      if (isManualDeclared || isAutoDeclared) {
        const declaredType = isManualDeclared ? 'Manual' : 'Auto';
        let reason = '';
        if (isManualDeclared) {
          reason = 'Manually declared as Dead Stock';
        } else if (daysInactive === null) {
          reason = `No transaction recorded (Threshold: ${deadStockDays} days)`;
        } else {
          reason = `No movement in ${daysInactive} days (Threshold: ${deadStockDays} days)`;
        }

        const mainStock = Number(item.ClosingStock || 0);
        const deptStock = deptStockMap[itemKey] || 0;
        const jwStock = jwStockMap[itemKey] || 0;
        const totalStock = mainStock + deptStock + jwStock;
        const costing = Number(item.Costing || 0);
        const valuation = Number((totalStock * costing).toFixed(2));

        deadStockList.push({
          ...item,
          EffectiveDeadStockType: declaredType,
          DeadStockDays: deadStockDays,
          LastMovementDate: lastMovement,
          DaysInactive: daysInactive,
          DeadStockReason: reason,
          MainStock: mainStock,
          DeptStock: deptStock,
          JwStock: jwStock,
          TotalStock: totalStock,
          DeadStockValuation: valuation
        });
      }
    }

    // Apply query filters
    let filtered = deadStockList;

    if (category && category !== 'All') {
      filtered = filtered.filter(i => i.Category === category);
    }

    if (type && type !== 'All') {
      filtered = filtered.filter(i => i.EffectiveDeadStockType === type);
    }

    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = filtered.filter(i => 
        (i.ItemCode && i.ItemCode.toLowerCase().includes(s)) ||
        (i.SubCode && i.SubCode.toLowerCase().includes(s)) ||
        (i.ItemName && i.ItemName.toLowerCase().includes(s)) ||
        (i.WarehouseNo && i.WarehouseNo.toLowerCase().includes(s)) ||
        (i.Location && i.Location.toLowerCase().includes(s)) ||
        (i.Series && i.Series.toLowerCase().includes(s))
      );
    }

    // Calculate KPI summary
    const totalDeadStockItems = filtered.length;
    const totalDeadStockQty = filtered.reduce((acc, i) => acc + (Number(i.TotalStock) || 0), 0);
    const totalDeadStockValue = filtered.reduce((acc, i) => acc + (Number(i.DeadStockValuation) || 0), 0);
    const autoCount = filtered.filter(i => i.EffectiveDeadStockType === 'Auto').length;
    const manualCount = filtered.filter(i => i.EffectiveDeadStockType === 'Manual').length;

    res.status(200).json({
      summary: {
        totalDeadStockItems,
        totalDeadStockQty: Math.round(totalDeadStockQty * 1000) / 1000,
        totalDeadStockValue: Math.round(totalDeadStockValue * 100) / 100,
        autoCount,
        manualCount
      },
      items: filtered
    });
  } catch (error) {
    console.error('Error fetching dead stock report:', error);
    res.status(500).json({ message: 'Server error fetching dead stock report', error: error.message });
  }
};

// PUT /api/items/:id/dead-stock
exports.updateDeadStockStatus = async (req, res) => {
  const { id } = req.params;
  const { subCode = '', deadStockType = 'None', deadStockDays = 0, isDeadStock = 0 } = req.body;

  const itemCode = (id || '').trim();
  const cleanSubCode = (subCode !== undefined && subCode !== null ? String(subCode) : (req.query.subCode || '')).trim();

  if (!itemCode) {
    return res.status(400).json({ message: 'ItemCode is required' });
  }

  const validType = ['None', 'Auto', 'Manual'].includes(deadStockType) ? deadStockType : 'None';
  const numDays = parseInt(deadStockDays, 10) || 0;
  const flagIsDead = (validType === 'Manual' || isDeadStock === 1 || isDeadStock === true) ? 1 : 0;

  try {
    const pool = await connectDB();
    const result = await pool.request()
      .input('ItemCode', sql.VarChar(50), itemCode)
      .input('SubCode', sql.VarChar(50), cleanSubCode)
      .input('DeadStockType', sql.VarChar(20), validType)
      .input('DeadStockDays', sql.Int, numDays)
      .input('IsDeadStock', sql.Int, flagIsDead)
      .query(`
        UPDATE ItemMaster 
        SET DeadStockType = @DeadStockType,
            DeadStockDays = @DeadStockDays,
            IsDeadStock = @IsDeadStock
        WHERE ItemCode = @ItemCode AND ISNULL(SubCode, '') = @SubCode
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.status(200).json({ 
      message: 'Dead stock status updated successfully',
      itemCode,
      subCode: cleanSubCode,
      deadStockType: validType,
      deadStockDays: numDays,
      isDeadStock: flagIsDead
    });
  } catch (error) {
    console.error('Error updating dead stock status:', error);
    res.status(500).json({ message: 'Server error updating dead stock status', error: error.message });
  }
};


