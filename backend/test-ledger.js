const { connectDB, sql } = require('./config/db');

async function testItem(itemCode) {
  const pool = await connectDB();
  const itemRes = await pool.request().input('ItemCode', sql.VarChar(10), itemCode)
    .query('SELECT ItemCode, ItemName, Unit, OpeningStock, ClosingStock FROM ItemMaster WHERE ItemCode = @ItemCode');
  
  if (!itemRes.recordset.length) return console.log('Item not found:', itemCode);
  const item = itemRes.recordset[0];
  const unit = (item.Unit || 'PCS').toUpperCase();

  // 1. Inward
  const inRes = await pool.request().input('ItemCode', sql.VarChar(10), itemCode).query(`
    SELECT h.ID as HeaderId, h.INWARDNO as DocNo, h.INWARDDATE as TxDate, 'Inward' as TxType, 'IN' as Direction,
    d.QUANTITY, d.GROSSWT, d.NETWT, d.UNIT, d.RATE, d.AMOUNT, l.LedgerName as PartyName, h.REMARK,
    CASE WHEN UPPER(ISNULL(d.UNIT, '${unit}')) IN ('KG','KGS') THEN ISNULL(d.NETWT,0) ELSE ISNULL(d.QUANTITY,0) END as EffectiveQty
    FROM InwardDetail d 
    INNER JOIN InwardHeader h ON d.INWARDID = h.ID 
    LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
    WHERE d.ITEMCODE = @ItemCode
  `);

  // 2. Outward
  const outRes = await pool.request().input('ItemCode', sql.VarChar(10), itemCode).query(`
    SELECT h.ID as HeaderId, h.OUTWARDNO as DocNo, h.OUTWARDDATE as TxDate, 'Outward' as TxType, 'OUT' as Direction,
    d.QUANTITY, d.GROSSWT, d.NETWT, d.UNIT, d.RATE, d.AMOUNT, l.LedgerName as PartyName, h.REMARK,
    CASE WHEN UPPER(ISNULL(d.UNIT, '${unit}')) IN ('KG','KGS') THEN ISNULL(d.NETWT,0) ELSE ISNULL(d.QUANTITY,0) END as EffectiveQty
    FROM OutwardDetail d 
    INNER JOIN OutwardHeader h ON d.OUTWARDID = h.ID 
    LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
    WHERE d.ITEMCODE = @ItemCode
  `);

  // 3. Jobwork Out
  const jwOutRes = await pool.request().input('ItemCode', sql.VarChar(10), itemCode).query(`
    SELECT h.ID as HeaderId, h.JWOUTWARDNO as DocNo, h.JWOUTWARDDATE as TxDate, 'Jobwork Out' as TxType, 'OUT' as Direction,
    d.QUANTITY, d.GROSSWT, d.NETWT, d.UNIT, d.RATE, 0 as AMOUNT, l.LedgerName as PartyName, h.REMARK,
    CASE WHEN UPPER(ISNULL(d.UNIT, '${unit}')) IN ('KG','KGS') THEN ISNULL(d.NETWT,0) ELSE ISNULL(d.QUANTITY,0) END as EffectiveQty
    FROM JobworkOutDetail d 
    INNER JOIN JobworkOutHeader h ON d.JWOUTWARDID = h.ID 
    LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
    WHERE d.ITEMCODE = @ItemCode
  `);

  // 4. Jobwork In (Received)
  const jwInRes = await pool.request().input('ItemCode', sql.VarChar(10), itemCode).query(`
    SELECT h.ID as HeaderId, h.JWINWARDNO as DocNo, h.JWINWARDDATE as TxDate, 'Jobwork In' as TxType, 'IN' as Direction,
    d.QUANTITY, d.GROSSWT, d.NETWT, d.UNIT, d.RATE, d.AMOUNT, l.LedgerName as PartyName, h.REMARK,
    CASE WHEN UPPER(ISNULL(d.UNIT, '${unit}')) IN ('KG','KGS') THEN ISNULL(d.NETWT,0) ELSE ISNULL(d.QUANTITY,0) END as EffectiveQty
    FROM JobworkInDetail d 
    INNER JOIN JobworkInHeader h ON d.JWINWARDID = h.ID 
    LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
    WHERE d.INITEMCODE = @ItemCode
  `);

  // 5. Jobwork In (Scrap)
  const jwInScrapRes = await pool.request().input('ItemCode', sql.VarChar(10), itemCode).query(`
    SELECT h.ID as HeaderId, h.JWINWARDNO as DocNo, h.JWINWARDDATE as TxDate, 'Jobwork In (Scrap)' as TxType, 'IN' as Direction,
    d.SCRAPPCS as QUANTITY, 0 as GROSSWT, d.SCRAPWT as NETWT, d.UNIT, 0 as RATE, 0 as AMOUNT, l.LedgerName as PartyName, h.REMARK,
    CASE WHEN UPPER(ISNULL(d.UNIT, '${unit}')) IN ('KG','KGS') THEN ISNULL(d.SCRAPWT,0) ELSE ISNULL(d.SCRAPPCS,0) END as EffectiveQty
    FROM JobworkInDetail d 
    INNER JOIN JobworkInHeader h ON d.JWINWARDID = h.ID 
    LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
    WHERE d.SCRAPITEMCODE = @ItemCode
  `);

  // 6. Stock Transfer (Out)
  const stOutRes = await pool.request().input('ItemCode', sql.VarChar(10), itemCode).query(`
    SELECT st.MoveID as HeaderId, CAST(st.TransferID as VARCHAR(20)) as DocNo, st.MoveDate as TxDate, 
    'Stock Transfer Out' as TxType, 'OUT' as Direction,
    st.OutPcs as QUANTITY, 0 as GROSSWT, st.OutWeight as NETWT, st.Unit as UNIT, st.Rate as RATE, st.Amount as AMOUNT,
    'Transfer: ' + ISNULL(fd.DeptName, '') + ' -> ' + ISNULL(td.DeptName, '') as PartyName, st.Remarks as REMARK,
    fd.DeptName as FromDeptName, td.DeptName as ToDeptName,
    CASE WHEN UPPER(ISNULL(st.Unit, '${unit}')) IN ('KG','KGS') THEN ISNULL(st.OutWeight,0) ELSE ISNULL(st.OutPcs,0) END as EffectiveQty
    FROM StockTransfer st
    LEFT JOIN DepartmentMaster fd ON st.FromDeptID = fd.DeptID
    LEFT JOIN DepartmentMaster td ON st.ToDeptID = td.DeptID
    WHERE st.OutItemCode = @ItemCode
  `);

  // 7. Stock Transfer (In)
  const stInRes = await pool.request().input('ItemCode', sql.VarChar(10), itemCode).query(`
    SELECT st.MoveID as HeaderId, CAST(st.TransferID as VARCHAR(20)) as DocNo, st.MoveDate as TxDate, 
    'Stock Transfer In' as TxType, 'IN' as Direction,
    st.InPcs as QUANTITY, 0 as GROSSWT, st.InWeight as NETWT, st.Unit as UNIT, st.Rate as RATE, st.Amount as AMOUNT,
    'Transfer: ' + ISNULL(fd.DeptName, '') + ' -> ' + ISNULL(td.DeptName, '') as PartyName, st.Remarks as REMARK,
    fd.DeptName as FromDeptName, td.DeptName as ToDeptName,
    CASE WHEN UPPER(ISNULL(st.Unit, '${unit}')) IN ('KG','KGS') THEN ISNULL(st.InWeight,0) ELSE ISNULL(st.InPcs,0) END as EffectiveQty
    FROM StockTransfer st
    LEFT JOIN DepartmentMaster fd ON st.FromDeptID = fd.DeptID
    LEFT JOIN DepartmentMaster td ON st.ToDeptID = td.DeptID
    WHERE st.InItemCode = @ItemCode
  `);

  // 8. Stock Transfer (Scrap)
  const stScrapRes = await pool.request().input('ItemCode', sql.VarChar(10), itemCode).query(`
    SELECT st.MoveID as HeaderId, CAST(st.TransferID as VARCHAR(20)) as DocNo, st.MoveDate as TxDate, 
    'Stock Transfer (Scrap)' as TxType, 'IN' as Direction,
    st.ScrapPcs as QUANTITY, 0 as GROSSWT, st.ScrapWeight as NETWT, st.Unit as UNIT, st.Rate as RATE, st.Amount as AMOUNT,
    'Scrap: ' + ISNULL(fd.DeptName, '') + ' -> ' + ISNULL(td.DeptName, '') as PartyName, st.Remarks as REMARK,
    fd.DeptName as FromDeptName, td.DeptName as ToDeptName,
    CASE WHEN UPPER(ISNULL(st.Unit, '${unit}')) IN ('KG','KGS') THEN ISNULL(st.ScrapWeight,0) ELSE ISNULL(st.ScrapPcs,0) END as EffectiveQty
    FROM StockTransfer st
    LEFT JOIN DepartmentMaster fd ON st.FromDeptID = fd.DeptID
    LEFT JOIN DepartmentMaster td ON st.ToDeptID = td.DeptID
    WHERE st.ScrapItemCode = @ItemCode
  `);

  // 9. Stock Journal
  const sjRes = await pool.request().input('ItemCode', sql.VarChar(10), itemCode).query(`
    SELECT sj.SJID as HeaderId, CAST(sj.SJID as VARCHAR(20)) as DocNo, sj.SJDate as TxDate,
    CASE WHEN sj.SJType = 'Production' THEN 'Stock Journal (Production)' ELSE 'Stock Journal (Consumption)' END as TxType,
    CASE WHEN sj.SJType = 'Production' THEN 'IN' ELSE 'OUT' END as Direction,
    sj.Qty as QUANTITY, 0 as GROSSWT, sj.Qty as NETWT, '${unit}' as UNIT, 0 as RATE, 0 as AMOUNT,
    'Stock Journal: ' + sj.SJType as PartyName, sj.Remarks as REMARK,
    sj.Qty as EffectiveQty
    FROM StockJournal sj
    WHERE sj.ItemCode = @ItemCode
  `);

  // 10. Assembly
  const assemProdRes = await pool.request().input('ItemCode', sql.VarChar(10), itemCode).query(`
    SELECT a.ID as HeaderId, CAST(a.AssemblyNo as VARCHAR(20)) as DocNo, a.AssemblyDate as TxDate,
    'Assembly (Production)' as TxType, 'IN' as Direction,
    a.Quantity as QUANTITY, 0 as GROSSWT, 0 as NETWT, '${unit}' as UNIT, 0 as RATE, 0 as AMOUNT,
    'Assembly Produced' as PartyName, a.Remark as REMARK,
    a.Quantity as EffectiveQty
    FROM AssemblyTransactions a
    WHERE a.ItemCode = @ItemCode
  `);

  const assemConsRes = await pool.request().input('ItemCode', sql.VarChar(10), itemCode).query(`
    SELECT a.ID as HeaderId, CAST(a.AssemblyNo as VARCHAR(20)) as DocNo, a.AssemblyDate as TxDate,
    'Assembly (Consumption)' as TxType, 'OUT' as Direction,
    (b.Quantity * a.Quantity) as QUANTITY, 0 as GROSSWT, 0 as NETWT, '${unit}' as UNIT, 0 as RATE, 0 as AMOUNT,
    'Assembly Consumed for ' + a.ItemCode as PartyName, a.Remark as REMARK,
    (b.Quantity * a.Quantity) as EffectiveQty
    FROM AssemblyTransactions a
    INNER JOIN BOM_Master b ON a.ItemCode = b.ParentItemCode
    WHERE b.ChildItemCode = @ItemCode
  `);

  const all = [
    ...inRes.recordset,
    ...outRes.recordset,
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

  console.log(`\n--- Test Item: ${itemCode} (${item.ItemName}) ---`);
  console.log(`Unit: ${unit} | OpeningStock: ${item.OpeningStock} | ClosingStock: ${item.ClosingStock}`);
  console.log(`Tx counts -> Inward: ${inRes.recordset.length}, Outward: ${outRes.recordset.length}, JW Out: ${jwOutRes.recordset.length}, JW In: ${jwInRes.recordset.length + jwInScrapRes.recordset.length}, ST Out: ${stOutRes.recordset.length}, ST In: ${stInRes.recordset.length + stScrapRes.recordset.length}, Total: ${all.length}`);
}

async function run() {
  await testItem('ABAG79');
  await testItem('BCWM');
  await testItem('ZINC');
  await testItem('BCBL');
  process.exit();
}

run().catch(console.error);
