const { connectDB, sql } = require('../config/db');

const getSignature = (username) => {
    const name = username || 'Admin';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const sig = `${name} - ${dateStr} ${timeStr}`;
    return sig.substring(0, 40);
};

exports.getStockTransfers = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
        st.*,
        fd.DeptName as FromDeptName,
        td.DeptName as ToDeptName,
        oi.ItemName as OutItemName,
        ii.ItemName as InItemName,
        si.ItemName as ScrapItemName
      FROM StockTransfer st
      LEFT JOIN DepartmentMaster fd ON st.FromDeptID = fd.DeptID
      LEFT JOIN DepartmentMaster td ON st.ToDeptID = td.DeptID
      LEFT JOIN ItemMaster oi ON st.OutItemCode = oi.ItemCode
      LEFT JOIN ItemMaster ii ON st.InItemCode = ii.ItemCode
      LEFT JOIN ItemMaster si ON st.ScrapItemCode = si.ItemCode
      ORDER BY st.MoveDate DESC, st.MoveID DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching stock transfers:', error);
    res.status(500).json({ message: 'Server error fetching stock transfers' });
  }
};

exports.getAvailableStock = async (req, res) => {
  try {
    const { deptId } = req.params;
    if (!deptId) return res.status(400).json({ message: 'DeptID is required' });

    const pool = await connectDB();
    
    // Check if it's "Stock"
    const deptResult = await pool.request().query(`SELECT DeptName FROM DepartmentMaster WHERE DeptID = ${deptId}`);
    if (deptResult.recordset.length === 0) return res.status(404).json({ message: 'Department not found' });
    
    const deptName = (deptResult.recordset[0].DeptName || '').toLowerCase();

    if (deptName === 'stock') {
      const dbRes = await pool.request().query(`
        SELECT ItemCode, ItemName, Unit, ClosingStock
        FROM ItemMaster 
        WHERE ISNULL(ClosingStock, 0) > 0
      `);
      const mapped = dbRes.recordset.map(item => {
        const isWeight = item.Unit === 'KG' || item.Unit === 'KGS';
        return {
          ItemCode: item.ItemCode,
          ItemName: item.ItemName,
          Unit: item.Unit,
          Pcs: isWeight ? 0 : item.ClosingStock,
          Weight: isWeight ? item.ClosingStock : 0
        };
      });
      return res.json(mapped);
    } else {
      const dbRes = await pool.request().query(`
        SELECT d.ItemCode, i.ItemName, i.Unit, d.Pcs, d.Weight
        FROM DepartmentStock d
        JOIN ItemMaster i ON d.ItemCode = i.ItemCode
        WHERE d.DeptID = ${deptId} AND (ISNULL(d.Pcs, 0) > 0 OR ISNULL(d.Weight, 0) > 0)
      `);
      return res.json(dbRes.recordset);
    }
  } catch (error) {
    console.error('Error fetching available stock:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const modifyStock = async (request, detail, FromDeptID, ToDeptID, multiplier = 1) => {
  // 1. Get Department Names
  const deptResult = await request.query(`SELECT DeptID, DeptName FROM DepartmentMaster WHERE DeptID IN (${FromDeptID}, ${ToDeptID})`);
  const depts = {};
  deptResult.recordset.forEach(d => { depts[d.DeptID] = d.DeptName ? d.DeptName.toLowerCase() : '' });

  const fromDeptName = depts[FromDeptID] || '';
  const toDeptName = depts[ToDeptID] || '';

  // 2. Get Units for Items
  const itemsStr = [detail.OutItemCode, detail.InItemCode, detail.ScrapItemCode]
    .filter(Boolean)
    .map(i => `'${i}'`)
    .join(',');
  
  if (!itemsStr) return; // No items to process

  const itemResult = await request.query(`SELECT ItemCode, Unit FROM ItemMaster WHERE ItemCode IN (${itemsStr})`);
  const units = {};
  itemResult.recordset.forEach(i => { units[i.ItemCode] = i.Unit ? i.Unit.toUpperCase() : '' });

  // --- OUT ITEM LOGIC ---
  if (fromDeptName === 'stock') {
    // Reduce ClosingStock
    const unit = units[detail.OutItemCode];
    let qtyToReduce = 0;
    if (unit === 'KG' || unit === 'KGS') qtyToReduce = detail.OutWeight || 0;
    else qtyToReduce = detail.OutPcs || 0;

    // Multiplier: 1 = add transfer (reduce stock), -1 = reverse transfer (increase stock)
    const change = -1 * multiplier * qtyToReduce;
    await request.query(`
      UPDATE ItemMaster 
      SET ClosingStock = ISNULL(ClosingStock, 0) + (${change})
      WHERE ItemCode = '${detail.OutItemCode}'
    `);
  } else {
    // Reduce DepartmentStock
    const pcsChange = -1 * multiplier * (detail.OutPcs || 0);
    const wtChange = -1 * multiplier * (detail.OutWeight || 0);

    const check = await request.query(`SELECT * FROM DepartmentStock WHERE DeptID = ${FromDeptID} AND ItemCode = '${detail.OutItemCode}'`);
    if (check.recordset.length > 0) {
      await request.query(`
        UPDATE DepartmentStock
        SET Pcs = ISNULL(Pcs, 0) + (${pcsChange}), Weight = ISNULL(Weight, 0) + (${wtChange})
        WHERE DeptID = ${FromDeptID} AND ItemCode = '${detail.OutItemCode}'
      `);
    } else {
      await request.query(`
        INSERT INTO DepartmentStock (DeptID, ItemCode, Pcs, Weight)
        VALUES (${FromDeptID}, '${detail.OutItemCode}', ${pcsChange}, ${wtChange})
      `);
    }
  }

  // --- IN ITEM LOGIC ---
  if (toDeptName === 'stock') {
    // Increase ClosingStock
    const unit = units[detail.InItemCode];
    let qtyToAdd = 0;
    if (unit === 'KG' || unit === 'KGS') qtyToAdd = detail.InWeight || 0;
    else qtyToAdd = detail.InPcs || 0;

    const change = 1 * multiplier * qtyToAdd;
    await request.query(`
      UPDATE ItemMaster 
      SET ClosingStock = ISNULL(ClosingStock, 0) + (${change})
      WHERE ItemCode = '${detail.InItemCode}'
    `);
  } else {
    // Increase DepartmentStock
    const pcsChange = 1 * multiplier * (detail.InPcs || 0);
    const wtChange = 1 * multiplier * (detail.InWeight || 0);

    const check = await request.query(`SELECT * FROM DepartmentStock WHERE DeptID = ${ToDeptID} AND ItemCode = '${detail.InItemCode}'`);
    if (check.recordset.length > 0) {
      await request.query(`
        UPDATE DepartmentStock
        SET Pcs = ISNULL(Pcs, 0) + (${pcsChange}), Weight = ISNULL(Weight, 0) + (${wtChange})
        WHERE DeptID = ${ToDeptID} AND ItemCode = '${detail.InItemCode}'
      `);
    } else {
      await request.query(`
        INSERT INTO DepartmentStock (DeptID, ItemCode, Pcs, Weight)
        VALUES (${ToDeptID}, '${detail.InItemCode}', ${pcsChange}, ${wtChange})
      `);
    }
  }

  // --- SCRAP ITEM LOGIC ---
  if (detail.ScrapItemCode) {
    // Always increase ClosingStock by Weight
    const change = 1 * multiplier * (detail.ScrapWeight || 0);
    await request.query(`
      UPDATE ItemMaster 
      SET ClosingStock = ISNULL(ClosingStock, 0) + (${change})
      WHERE ItemCode = '${detail.ScrapItemCode}'
    `);
  }
};

exports.createStockTransfers = async (req, res) => {
  let pool;
  let transaction;
  try {
    const { MoveDate, FromDeptID, ToDeptID, Remarks, Details, CreatedBy } = req.body;

    if (!MoveDate || !FromDeptID || !ToDeptID || !Details || Details.length === 0) {
      return res.status(400).json({ message: 'Missing required fields or details.' });
    }

    pool = await connectDB();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const request = new sql.Request(transaction);

    // Fetch and increment TransferID
    const lastIdResult = await request.query(`SELECT TOP 1 TransferID FROM StockTransfer ORDER BY MoveID DESC`);
    let nextTransferId = '1';
    if (lastIdResult.recordset.length > 0) {
      const lastStr = lastIdResult.recordset[0].TransferID;
      const lastNum = parseInt(lastStr, 10);
      if (!isNaN(lastNum)) {
        nextTransferId = (lastNum + 1).toString();
      } else {
        nextTransferId = lastStr + '-1';
      }
    }

    for (const detail of Details) {
      if (!detail.OutItemCode || !detail.InItemCode) continue;

      const outPcs = parseFloat(detail.OutPcs) || 0;
      const inPcs = parseFloat(detail.InPcs) || 0;
      const outWt = parseFloat(detail.OutWeight) || 0;
      const inWt = parseFloat(detail.InWeight) || 0;

      if (inPcs > outPcs) {
        throw new Error(`In Pcs (${inPcs}) cannot be greater than Out Pcs (${outPcs}).`);
      }
      if (inWt > outWt) {
        throw new Error(`In Weight (${inWt}) cannot be greater than Out Weight (${outWt}).`);
      }

      const scrapWt = parseFloat(detail.ScrapWeight) || 0;
      const lossWeight = Math.max(0, outWt - inWt - scrapWt);

      await request.query(`
        INSERT INTO StockTransfer (
          TransferID, MoveDate, FromDeptID, ToDeptID, OutItemCode, OutPcs, OutWeight,
          InItemCode, InPcs, InWeight, ScrapItemCode, ScrapPcs, ScrapWeight, LossWeight, Remarks, CreatedBy, UpdatedBy
        )
        VALUES (
          '${nextTransferId}', '${MoveDate}', ${FromDeptID}, ${ToDeptID}, '${detail.OutItemCode}', ${outPcs}, ${outWt},
          '${detail.InItemCode}', ${inPcs}, ${inWt}, 
          ${detail.ScrapItemCode ? "'" + detail.ScrapItemCode + "'" : 'NULL'}, ${detail.ScrapPcs || 0}, ${scrapWt}, 
          ${lossWeight}, ${Remarks ? "'" + Remarks + "'" : 'NULL'}, '${getSignature(CreatedBy)}', '${getSignature(CreatedBy)}'
        )
      `);
      
      await modifyStock(request, detail, FromDeptID, ToDeptID, 1);
    }

    await transaction.commit();
    res.status(201).json({ message: 'Stock transfers created successfully.' });
  } catch (error) {
    console.error('Error creating stock transfers:', error);
    if (transaction) await transaction.rollback();
    res.status(500).json({ message: 'Server error creating stock transfers' });
  }
};

exports.updateStockTransfer = async (req, res) => {
  let pool;
  let transaction;
  try {
    const { id } = req.params;
    const { MoveDate, FromDeptID, ToDeptID, Remarks, Details, UpdatedBy } = req.body;
    
    const detail = Details && Details.length > 0 ? Details[0] : req.body;

    if (!MoveDate || !FromDeptID || !ToDeptID || !detail.OutItemCode || !detail.InItemCode) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    pool = await connectDB();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const request = new sql.Request(transaction);

    const oldRecordResult = await request.query(`SELECT * FROM StockTransfer WHERE MoveID = ${id}`);
    if (oldRecordResult.recordset.length === 0) {
      throw new Error('Stock transfer not found');
    }
    const oldRecord = oldRecordResult.recordset[0];

    // Reverse old stock
    await modifyStock(request, oldRecord, oldRecord.FromDeptID, oldRecord.ToDeptID, -1);

    const outPcs = parseFloat(detail.OutPcs) || 0;
    const inPcs = parseFloat(detail.InPcs) || 0;
    const outWt = parseFloat(detail.OutWeight) || 0;
    const inWt = parseFloat(detail.InWeight) || 0;

    if (inPcs > outPcs) {
      throw new Error(`In Pcs (${inPcs}) cannot be greater than Out Pcs (${outPcs}).`);
    }
    if (inWt > outWt) {
      throw new Error(`In Weight (${inWt}) cannot be greater than Out Weight (${outWt}).`);
    }

    const scrapWt = parseFloat(detail.ScrapWeight) || 0;
    const lossWeight = Math.max(0, outWt - inWt - scrapWt);

    // Update the record
    await request.query(`
      UPDATE StockTransfer SET
        MoveDate = '${MoveDate}',
        FromDeptID = ${FromDeptID},
        ToDeptID = ${ToDeptID},
        OutItemCode = '${detail.OutItemCode}',
        OutPcs = ${outPcs},
        OutWeight = ${outWt},
        InItemCode = '${detail.InItemCode}',
        InPcs = ${inPcs},
        InWeight = ${inWt},
        ScrapItemCode = ${detail.ScrapItemCode ? "'" + detail.ScrapItemCode + "'" : 'NULL'},
        ScrapPcs = ${detail.ScrapPcs || 0},
        ScrapWeight = ${scrapWt},
        LossWeight = ${lossWeight},
        Remarks = ${Remarks ? "'" + Remarks + "'" : 'NULL'},
        UpdatedBy = '${getSignature(UpdatedBy)}'
      WHERE MoveID = ${id}
    `);

    // Apply new stock
    await modifyStock(request, detail, FromDeptID, ToDeptID, 1);

    await transaction.commit();
    res.json({ message: 'Stock transfer updated successfully.' });
  } catch (error) {
    console.error('Error updating stock transfer:', error);
    if (transaction) await transaction.rollback();
    res.status(500).json({ message: 'Server error updating stock transfer' });
  }
};

exports.deleteStockTransfer = async (req, res) => {
  let pool;
  let transaction;
  try {
    const { id } = req.params;
    pool = await connectDB();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const request = new sql.Request(transaction);

    const oldRecordResult = await request.query(`SELECT * FROM StockTransfer WHERE MoveID = ${id}`);
    if (oldRecordResult.recordset.length === 0) {
      throw new Error('Stock transfer not found');
    }
    const oldRecord = oldRecordResult.recordset[0];

    // Reverse old stock
    await modifyStock(request, oldRecord, oldRecord.FromDeptID, oldRecord.ToDeptID, -1);

    // Delete record
    await request.query(`DELETE FROM StockTransfer WHERE MoveID = ${id}`);

    await transaction.commit();
    res.json({ message: 'Stock transfer deleted successfully.' });
  } catch (error) {
    console.error('Error deleting stock transfer:', error);
    if (transaction) await transaction.rollback();
    res.status(500).json({ message: 'Server error deleting stock transfer' });
  }
};
