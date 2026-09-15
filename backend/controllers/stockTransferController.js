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
        SELECT ItemCode, ItemName, Unit, ClosingStock, Costing
        FROM ItemMaster 
        WHERE ISNULL(ClosingStock, 0) > 0
      `);
      const mapped = dbRes.recordset.map(item => {
        const isWeight = item.Unit === 'KG' || item.Unit === 'KGS';
        return {
          ItemCode: item.ItemCode,
          ItemName: item.ItemName,
          Unit: item.Unit,
          Costing: item.Costing,
          Pcs: isWeight ? 0 : item.ClosingStock,
          Weight: isWeight ? item.ClosingStock : 0
        };
      });
      return res.json(mapped);
    } else {
      const dbRes = await pool.request().query(`
        SELECT d.ItemCode, i.ItemName, i.Unit, i.Costing, d.Pcs, d.Weight
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
  if (detail.OutItemCode) {
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
  }

  // --- IN ITEM LOGIC ---
  if (detail.InItemCode) {
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
    const { MoveDate, FromDeptID, ToDeptID, Remarks, outItems = [], inItems = [], scrapItems = [], LossWeight = 0, LossRate = 0, LossAmount = 0, CreatedBy } = req.body;

    if (!MoveDate || !FromDeptID || !ToDeptID || outItems.length === 0) {
      return res.status(400).json({ message: 'Missing required fields or Out Items.' });
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

    const remarksEscaped = Remarks ? `'${Remarks.replace(/'/g, "''")}'` : 'NULL';
    const sig = getSignature(CreatedBy);

    // Insert Out Items
    for (let i = 0; i < outItems.length; i++) {
      const item = outItems[i];
      if (!item.ItemCode) continue;
      const lossWt = i === 0 ? parseFloat(LossWeight) || 0 : 0;
      const lossRt = i === 0 ? parseFloat(LossRate) || 0 : 0;
      const lossAmt = i === 0 ? parseFloat(LossAmount) || 0 : 0;
      const rate = parseFloat(item.Rate) || 0;
      const amount = parseFloat(item.Amount) || 0;
      const unitEscaped = item.Unit ? `'${item.Unit.replace(/'/g, "''")}'` : 'NULL';

      await request.query(`
        INSERT INTO StockTransfer (TransferID, MoveDate, FromDeptID, ToDeptID, OutItemCode, OutPcs, OutWeight, Unit, LossWeight, LossRate, LossAmount, Rate, Amount, Remarks, CreatedBy, UpdatedBy)
        VALUES ('${nextTransferId}', '${MoveDate}', ${FromDeptID}, ${ToDeptID}, '${item.ItemCode}', ${parseFloat(item.Pcs) || 0}, ${parseFloat(item.Weight) || 0}, ${unitEscaped}, ${lossWt}, ${lossRt}, ${lossAmt}, ${rate}, ${amount}, ${remarksEscaped}, '${sig}', '${sig}')
      `);
      await modifyStock(request, { OutItemCode: item.ItemCode, OutPcs: parseFloat(item.Pcs) || 0, OutWeight: parseFloat(item.Weight) || 0 }, FromDeptID, ToDeptID, 1);
    }

    // Insert In Items
    for (const item of inItems) {
      if (!item.ItemCode) continue;
      const rate = parseFloat(item.Rate) || 0;
      const amount = parseFloat(item.Amount) || 0;
      const unitEscaped = item.Unit ? `'${item.Unit.replace(/'/g, "''")}'` : 'NULL';
      await request.query(`
        INSERT INTO StockTransfer (TransferID, MoveDate, FromDeptID, ToDeptID, InItemCode, InPcs, InWeight, Unit, LossWeight, LossRate, LossAmount, Rate, Amount, Remarks, CreatedBy, UpdatedBy)
        VALUES ('${nextTransferId}', '${MoveDate}', ${FromDeptID}, ${ToDeptID}, '${item.ItemCode}', ${parseFloat(item.Pcs) || 0}, ${parseFloat(item.Weight) || 0}, ${unitEscaped}, 0, 0, 0, ${rate}, ${amount}, ${remarksEscaped}, '${sig}', '${sig}')
      `);
      await modifyStock(request, { InItemCode: item.ItemCode, InPcs: parseFloat(item.Pcs) || 0, InWeight: parseFloat(item.Weight) || 0 }, FromDeptID, ToDeptID, 1);
    }

    // Insert Scrap Items
    for (const item of scrapItems) {
      if (!item.ItemCode) continue;
      const rate = parseFloat(item.Rate) || 0;
      const amount = parseFloat(item.Amount) || 0;
      const unitEscaped = item.Unit ? `'${item.Unit.replace(/'/g, "''")}'` : 'NULL';
      await request.query(`
        INSERT INTO StockTransfer (TransferID, MoveDate, FromDeptID, ToDeptID, ScrapItemCode, ScrapPcs, ScrapWeight, Unit, LossWeight, LossRate, LossAmount, Rate, Amount, Remarks, CreatedBy, UpdatedBy)
        VALUES ('${nextTransferId}', '${MoveDate}', ${FromDeptID}, ${ToDeptID}, '${item.ItemCode}', ${parseFloat(item.Pcs) || 0}, ${parseFloat(item.Weight) || 0}, ${unitEscaped}, 0, 0, 0, ${rate}, ${amount}, ${remarksEscaped}, '${sig}', '${sig}')
      `);
      await modifyStock(request, { ScrapItemCode: item.ItemCode, ScrapPcs: parseFloat(item.Pcs) || 0, ScrapWeight: parseFloat(item.Weight) || 0 }, FromDeptID, ToDeptID, 1);
    }

    await transaction.commit();
    res.status(201).json({ message: 'Stock transfers created successfully.', TransferID: nextTransferId });
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
    const { id } = req.params; // id is now TransferID
    const { MoveDate, FromDeptID, ToDeptID, Remarks, outItems = [], inItems = [], scrapItems = [], LossWeight = 0, LossRate = 0, LossAmount = 0, UpdatedBy } = req.body;

    if (!MoveDate || !FromDeptID || !ToDeptID || outItems.length === 0) {
      return res.status(400).json({ message: 'Missing required fields or Out Items.' });
    }

    pool = await connectDB();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const request = new sql.Request(transaction);

    // 1. Find old records and reverse stock
    const oldRecordResult = await request.query(`SELECT * FROM StockTransfer WHERE TransferID = '${id}'`);
    if (oldRecordResult.recordset.length === 0) {
      throw new Error('Stock transfer not found');
    }
    
    for (const oldRecord of oldRecordResult.recordset) {
      await modifyStock(request, oldRecord, oldRecord.FromDeptID, oldRecord.ToDeptID, -1);
    }

    // 2. Delete old records
    await request.query(`DELETE FROM StockTransfer WHERE TransferID = '${id}'`);

    // 3. Insert new records (similar to create)
    const remarksEscaped = Remarks ? `'${Remarks.replace(/'/g, "''")}'` : 'NULL';
    const sig = getSignature(UpdatedBy);

    // Insert Out Items
    for (let i = 0; i < outItems.length; i++) {
      const item = outItems[i];
      if (!item.ItemCode) continue;
      const lossWt = i === 0 ? parseFloat(LossWeight) || 0 : 0;
      const lossRt = i === 0 ? parseFloat(LossRate) || 0 : 0;
      const lossAmt = i === 0 ? parseFloat(LossAmount) || 0 : 0;
      const rate = parseFloat(item.Rate) || 0;
      const amount = parseFloat(item.Amount) || 0;
      const unitEscaped = item.Unit ? `'${item.Unit.replace(/'/g, "''")}'` : 'NULL';

      await request.query(`
        INSERT INTO StockTransfer (TransferID, MoveDate, FromDeptID, ToDeptID, OutItemCode, OutPcs, OutWeight, Unit, LossWeight, LossRate, LossAmount, Rate, Amount, Remarks, CreatedBy, UpdatedBy)
        VALUES ('${id}', '${MoveDate}', ${FromDeptID}, ${ToDeptID}, '${item.ItemCode}', ${parseFloat(item.Pcs) || 0}, ${parseFloat(item.Weight) || 0}, ${unitEscaped}, ${lossWt}, ${lossRt}, ${lossAmt}, ${rate}, ${amount}, ${remarksEscaped}, '${sig}', '${sig}')
      `);
      await modifyStock(request, { OutItemCode: item.ItemCode, OutPcs: parseFloat(item.Pcs) || 0, OutWeight: parseFloat(item.Weight) || 0 }, FromDeptID, ToDeptID, 1);
    }

    // Insert In Items
    for (const item of inItems) {
      if (!item.ItemCode) continue;
      const rate = parseFloat(item.Rate) || 0;
      const amount = parseFloat(item.Amount) || 0;
      const unitEscaped = item.Unit ? `'${item.Unit.replace(/'/g, "''")}'` : 'NULL';
      await request.query(`
        INSERT INTO StockTransfer (TransferID, MoveDate, FromDeptID, ToDeptID, InItemCode, InPcs, InWeight, Unit, LossWeight, LossRate, LossAmount, Rate, Amount, Remarks, CreatedBy, UpdatedBy)
        VALUES ('${id}', '${MoveDate}', ${FromDeptID}, ${ToDeptID}, '${item.ItemCode}', ${parseFloat(item.Pcs) || 0}, ${parseFloat(item.Weight) || 0}, ${unitEscaped}, 0, 0, 0, ${rate}, ${amount}, ${remarksEscaped}, '${sig}', '${sig}')
      `);
      await modifyStock(request, { InItemCode: item.ItemCode, InPcs: parseFloat(item.Pcs) || 0, InWeight: parseFloat(item.Weight) || 0 }, FromDeptID, ToDeptID, 1);
    }

    // Insert Scrap Items
    for (const item of scrapItems) {
      if (!item.ItemCode) continue;
      const rate = parseFloat(item.Rate) || 0;
      const amount = parseFloat(item.Amount) || 0;
      const unitEscaped = item.Unit ? `'${item.Unit.replace(/'/g, "''")}'` : 'NULL';
      await request.query(`
        INSERT INTO StockTransfer (TransferID, MoveDate, FromDeptID, ToDeptID, ScrapItemCode, ScrapPcs, ScrapWeight, Unit, LossWeight, LossRate, LossAmount, Rate, Amount, Remarks, CreatedBy, UpdatedBy)
        VALUES ('${id}', '${MoveDate}', ${FromDeptID}, ${ToDeptID}, '${item.ItemCode}', ${parseFloat(item.Pcs) || 0}, ${parseFloat(item.Weight) || 0}, ${unitEscaped}, 0, 0, 0, ${rate}, ${amount}, ${remarksEscaped}, '${sig}', '${sig}')
      `);
      await modifyStock(request, { ScrapItemCode: item.ItemCode, ScrapPcs: parseFloat(item.Pcs) || 0, ScrapWeight: parseFloat(item.Weight) || 0 }, FromDeptID, ToDeptID, 1);
    }

    await transaction.commit();
    res.json({ message: 'Stock transfer updated successfully.', TransferID: id });
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
    const { id } = req.params; // id is now TransferID
    pool = await connectDB();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const request = new sql.Request(transaction);

    const oldRecordResult = await request.query(`SELECT * FROM StockTransfer WHERE TransferID = '${id}'`);
    if (oldRecordResult.recordset.length === 0) {
      throw new Error('Stock transfer not found');
    }

    for (const oldRecord of oldRecordResult.recordset) {
      // Reverse old stock
      await modifyStock(request, oldRecord, oldRecord.FromDeptID, oldRecord.ToDeptID, -1);
    }

    // Delete record
    await request.query(`DELETE FROM StockTransfer WHERE TransferID = '${id}'`);

    await transaction.commit();
    res.json({ message: 'Stock transfer deleted successfully.' });
  } catch (error) {
    console.error('Error deleting stock transfer:', error);
    if (transaction) await transaction.rollback();
    res.status(500).json({ message: 'Server error deleting stock transfer' });
  }
};
