const { connectDB } = require('../config/db');

// GET /api/dashboard/kpis
exports.getDashboardKPIs = async (req, res) => {
  try {
    const pool = await connectDB();

    // 1. Total Items
    const itemsResult = await pool.request().query(`
      SELECT COUNT(*) AS totalItems FROM ItemMaster
    `);
    const totalItems = itemsResult.recordset[0].totalItems || 0;

    // 2. Total Stock Value
    const valueResult = await pool.request().query(`
      SELECT SUM(ClosingStock * Costing) AS totalValue FROM ItemMaster
    `);
    const totalValue = valueResult.recordset[0].totalValue || 0;

    // 2a. ItemMaster Stock Totals (Pcs & Weight)
    const itemMasterStockResult = await pool.request().query(`
      SELECT 
        ISNULL(SUM(CASE WHEN UPPER(Unit) NOT IN ('KG', 'KGS') THEN ClosingStock ELSE 0 END), 0) AS totalPcs,
        ISNULL(SUM(CASE WHEN UPPER(Unit) IN ('KG', 'KGS') THEN ClosingStock ELSE 0 END), 0) AS totalWeight
      FROM ItemMaster
    `);
    const mainPcs = itemMasterStockResult.recordset[0].totalPcs || 0;
    const mainWeight = itemMasterStockResult.recordset[0].totalWeight || 0;

    // 2b. Department Stock Values (including Pcs and Weight sums)
    const deptStockResult = await pool.request().query(`
      SELECT 
        dm.DeptID,
        dm.DeptName,
        ISNULL(SUM(CASE WHEN UPPER(im.Unit) = 'KG' THEN ds.Weight ELSE ds.Pcs END * im.Costing), 0) AS totalValue,
        ISNULL(SUM(ds.Pcs), 0) AS totalPcs,
        ISNULL(SUM(ds.Weight), 0) AS totalWeight
      FROM DepartmentMaster dm
      LEFT JOIN DepartmentStock ds ON dm.DeptID = ds.DeptID
      LEFT JOIN ItemMaster im ON ds.ItemCode = im.ItemCode
      GROUP BY dm.DeptID, dm.DeptName
    `);

    let hasMainStockDept = false;
    const departmentStocks = [];

    deptStockResult.recordset.forEach(row => {
      if (row.DeptName.toLowerCase() === 'stock') {
        // Map the database department "Stock" directly to ItemMaster main stock values
        departmentStocks.push({
          deptName: row.DeptName, // Displays "Stock"
          totalValue: totalValue,
          totalPcs: mainPcs,
          totalWeight: mainWeight
        });
        hasMainStockDept = true;
      } else if (row.DeptName.toLowerCase() !== 'stock department' && row.DeptName.toLowerCase() !== 'main stock') {
        departmentStocks.push({
          deptName: row.DeptName,
          totalValue: row.totalValue,
          totalPcs: row.totalPcs,
          totalWeight: row.totalWeight
        });
      }
    });

    // Fallback: If no database department named "Stock" exists, prepend "Stock Department" manually
    if (!hasMainStockDept) {
      departmentStocks.unshift({
        deptName: 'Stock Department',
        totalValue: totalValue,
        totalPcs: mainPcs,
        totalWeight: mainWeight
      });
    }

    // 3. Total Departments
    const deptResult = await pool.request().query(`
      SELECT COUNT(*) AS totalDepartments FROM DepartmentMaster
    `);
    const totalDepartments = deptResult.recordset[0].totalDepartments || 0;

    // 4. Transfers Today
    const transfersResult = await pool.request().query(`
      SELECT COUNT(*) AS transfersToday 
      FROM StockTransfer 
      WHERE CAST(MoveDate AS DATE) = CAST(GETDATE() AS DATE)
    `);
    const transfersToday = transfersResult.recordset[0].transfersToday || 0;

    // 5. Total Asset Value
    const assetResult = await pool.request().query(`
      SELECT SUM(TotalValue) AS totalAssetValue FROM Assets
    `);
    const totalAssetValue = assetResult.recordset[0].totalAssetValue || 0;

    // 6. Total Receivable
    const receivableResult = await pool.request().query(`
      SELECT ISNULL(SUM(l.ClosingBalance), 0) AS totalReceivable
      FROM LedgerMaster l
      LEFT JOIN AccountGroup a ON l.AccountGroupID = a.Id
      WHERE l.ClosingBalance > 0 
        AND a.GroupName IN ('Sundry Debtors', 'Party', 'Sundry Creditors', 'Vendor')
    `);
    const totalReceivable = receivableResult.recordset[0].totalReceivable || 0;

    // 7. Total Payable
    const payableResult = await pool.request().query(`
      SELECT ISNULL(SUM(ABS(l.ClosingBalance)), 0) AS totalPayable
      FROM LedgerMaster l
      LEFT JOIN AccountGroup a ON l.AccountGroupID = a.Id
      WHERE l.ClosingBalance < 0 
        AND a.GroupName IN ('Sundry Debtors', 'Party', 'Sundry Creditors', 'Vendor')
    `);
    const totalPayable = payableResult.recordset[0].totalPayable || 0;

    // 8. Total Turnover (Outward)
    const turnoverResult = await pool.request().query(`
      SELECT ISNULL(SUM(TOTALAMOUNT), 0) AS totalTurnover
      FROM OutwardHeader
    `);
    const totalTurnover = turnoverResult.recordset[0].totalTurnover || 0;

    // 9. Monthly Outward (Last 6 Months)
    const monthlyOutwardResult = await pool.request().query(`
      SELECT 
          FORMAT(OUTWARDDATE, 'yyyy-MM') AS monthLabel,
          ISNULL(SUM(TOTALAMOUNT), 0) AS totalAmount
      FROM OutwardHeader
      WHERE OUTWARDDATE >= DATEADD(month, -6, GETDATE())
      GROUP BY FORMAT(OUTWARDDATE, 'yyyy-MM')
      ORDER BY monthLabel ASC
    `);
    const monthlyOutward = monthlyOutwardResult.recordset;

    // 10. Top 5 Parties by Turnover
    const topPartiesResult = await pool.request().query(`
      SELECT TOP 5
          l.LedgerName AS partyName,
          ISNULL(SUM(h.TOTALAMOUNT), 0) AS totalAmount
      FROM OutwardHeader h
      INNER JOIN LedgerMaster l ON h.LEDGERID = l.Id
      GROUP BY l.LedgerName
      ORDER BY totalAmount DESC
    `);
    const topParties = topPartiesResult.recordset;

    // 11. Cash and Bank Balances
    const bankBalanceResult = await pool.request().query(`
      SELECT ISNULL(SUM(l.ClosingBalance), 0) AS cashBankBalance
      FROM LedgerMaster l
      LEFT JOIN AccountGroup a ON l.AccountGroupID = a.Id
      WHERE a.GroupName IN ('Cash-in-Hand', 'Bank Accounts')
    `);
    const cashBankBalance = bankBalanceResult.recordset[0].cashBankBalance || 0;

    res.status(200).json({
      totalItems,
      totalValue,
      totalDepartments,
      transfersToday,
      totalAssetValue,
      totalReceivable,
      totalPayable,
      totalTurnover,
      monthlyOutward,
      topParties,
      cashBankBalance,
      departmentStocks
    });

  } catch (error) {
    console.error('Error fetching dashboard KPIs:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
