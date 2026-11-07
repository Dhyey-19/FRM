const { connectDB } = require('../config/db');

const calculateDueInfo = (dateInput, creditDays = 0) => {
  let y, m, d;
  if (typeof dateInput === 'string' && dateInput.includes('-')) {
    const parts = dateInput.split('T')[0].split('-');
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
    d = parseInt(parts[2], 10);
  } else {
    const dt = new Date(dateInput);
    y = dt.getUTCFullYear();
    m = dt.getUTCMonth();
    d = dt.getUTCDate();
  }
  const dueUTC = Date.UTC(y, m, d + (Number(creditDays) || 0));
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dueUTC - todayUTC) / (1000 * 60 * 60 * 24));
  return { dueDays: diffDays };
};

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
      WITH TransferRates AS (
        SELECT 
          ds.DeptID,
          ds.ItemCode,
          COALESCE(
            (SELECT TOP 1 st.Rate FROM StockTransfer st WHERE st.ToDeptID = ds.DeptID AND st.InItemCode = ds.ItemCode AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
            (SELECT TOP 1 st.Rate FROM StockTransfer st WHERE st.FromDeptID = ds.DeptID AND st.OutItemCode = ds.ItemCode AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
            (SELECT TOP 1 st.Rate FROM StockTransfer st WHERE (st.InItemCode = ds.ItemCode OR st.OutItemCode = ds.ItemCode) AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
            im.Costing,
            0
          ) AS TransferRate,
          COALESCE(
            (SELECT TOP 1 st.Unit FROM StockTransfer st WHERE st.ToDeptID = ds.DeptID AND st.InItemCode = ds.ItemCode AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
            (SELECT TOP 1 st.Unit FROM StockTransfer st WHERE st.FromDeptID = ds.DeptID AND st.OutItemCode = ds.ItemCode AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
            (SELECT TOP 1 st.Unit FROM StockTransfer st WHERE (st.InItemCode = ds.ItemCode OR st.OutItemCode = ds.ItemCode) AND st.Rate > 0 ORDER BY st.MoveDate DESC, st.MoveID DESC),
            im.Unit
          ) AS ValuationUnit
        FROM DepartmentStock ds
        JOIN ItemMaster im ON ds.ItemCode = im.ItemCode
      )
      SELECT 
        dm.DeptID,
        dm.DeptName,
        ISNULL(SUM(
          (CASE 
            WHEN UPPER(tr.ValuationUnit) IN ('KG', 'KGS') AND ISNULL(ds.Weight, 0) != 0 THEN ISNULL(ds.Weight, 0)
            WHEN UPPER(tr.ValuationUnit) NOT IN ('KG', 'KGS') AND ISNULL(ds.Pcs, 0) != 0 THEN ISNULL(ds.Pcs, 0)
            WHEN ISNULL(ds.Weight, 0) != 0 THEN ISNULL(ds.Weight, 0)
            ELSE ISNULL(ds.Pcs, 0)
          END) * tr.TransferRate
        ), 0) AS totalValue,
        ISNULL(SUM(ds.Pcs), 0) AS totalPcs,
        ISNULL(SUM(ds.Weight), 0) AS totalWeight
      FROM DepartmentMaster dm
      LEFT JOIN DepartmentStock ds ON dm.DeptID = ds.DeptID
      LEFT JOIN ItemMaster im ON ds.ItemCode = im.ItemCode
      LEFT JOIN TransferRates tr ON ds.DeptID = tr.DeptID AND ds.ItemCode = tr.ItemCode
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

    // 6 & 7. Receivables and Payables (With Bill, Without Bill, Combined)
    const billBalancesResult = await pool.request().query(`
      WITH LedgerBillSums AS (
        SELECT 
          l.Id,
          ISNULL(l.OpeningBalance, 0) AS OpeningBalance,
          ISNULL(l.OpeningBalance, 0) + ISNULL(SUM(CASE WHEN (v.Bill = 1 OR v.Bill IS NULL) THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithBillBalance,
          ISNULL(SUM(CASE WHEN v.Bill = 0 THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithoutBillBalance
        FROM LedgerMaster l
        INNER JOIN AccountGroup a ON l.AccountGroupID = a.Id
        LEFT JOIN VoucherEntry v ON l.Id = v.LedgerId
        WHERE a.GroupName IN ('Sundry Debtors', 'Party', 'Sundry Creditors', 'Vendor')
        GROUP BY l.Id, l.OpeningBalance
      ),
      ComputedLedgers AS (
        SELECT 
          Id,
          WithBillBalance,
          WithoutBillBalance,
          (WithBillBalance + WithoutBillBalance) AS NetBalance
        FROM LedgerBillSums
      )
      SELECT 
        -- Receivables (NetBalance > 0)
        ISNULL(SUM(CASE WHEN NetBalance > 0 THEN NetBalance ELSE 0 END), 0) AS totalReceivable,
        ISNULL(SUM(CASE WHEN NetBalance > 0 THEN WithBillBalance ELSE 0 END), 0) AS totalReceivableWithBill,
        ISNULL(SUM(CASE WHEN NetBalance > 0 THEN WithoutBillBalance ELSE 0 END), 0) AS totalReceivableWithoutBill,
        
        -- Payables (NetBalance < 0)
        ISNULL(SUM(CASE WHEN NetBalance < 0 THEN -NetBalance ELSE 0 END), 0) AS totalPayable,
        ISNULL(SUM(CASE WHEN NetBalance < 0 THEN -WithBillBalance ELSE 0 END), 0) AS totalPayableWithBill,
        ISNULL(SUM(CASE WHEN NetBalance < 0 THEN -WithoutBillBalance ELSE 0 END), 0) AS totalPayableWithoutBill
      FROM ComputedLedgers;
    `);

    const billStats = billBalancesResult.recordset[0] || {};
    const totalReceivable = billStats.totalReceivable || 0;
    const totalPayable = billStats.totalPayable || 0;
    const totalReceivableWithBill = billStats.totalReceivableWithBill || 0;
    const totalPayableWithBill = billStats.totalPayableWithBill || 0;
    const totalReceivableWithoutBill = billStats.totalReceivableWithoutBill || 0;
    const totalPayableWithoutBill = billStats.totalPayableWithoutBill || 0;

    // 7a. Calculate Overdue Receivables (Invoice-wise allocation)
    let totalReceivableOverdueWithBill = 0;
    let totalReceivableOverdueWithoutBill = 0;

    const receivableInvoicesResult = await pool.request().query(`
      WITH LedgerBalances AS (
        SELECT 
          l.Id,
          ISNULL(l.PaymentTerm, 0) AS CreditDays,
          ISNULL(l.ClosingBalance, 0) AS ClosingBalance,
          ISNULL(l.OpeningBalance, 0) + ISNULL(SUM(CASE WHEN (v.Bill = 1 OR v.Bill IS NULL) THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithBillBalance,
          ISNULL(SUM(CASE WHEN v.Bill = 0 THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithoutBillBalance
        FROM LedgerMaster l
        INNER JOIN AccountGroup a ON l.AccountGroupID = a.Id
        LEFT JOIN VoucherEntry v ON l.Id = v.LedgerId
        WHERE a.GroupName IN ('Sundry Debtors', 'Party', 'Sundry Creditors', 'Vendor')
        GROUP BY l.Id, l.PaymentTerm, l.OpeningBalance, l.ClosingBalance
      )
      SELECT 
          h.ID AS OutwardId,
          h.OUTWARDDATE AS OutwardDate,
          h.TOTALAMOUNT AS InvoiceAmount,
          ISNULL(h.Bill, 1) AS Bill,
          lb.Id AS LedgerId,
          lb.CreditDays,
          lb.ClosingBalance AS PartyClosingBalance,
          lb.WithBillBalance,
          lb.WithoutBillBalance
      FROM OutwardHeader h
      INNER JOIN LedgerBalances lb ON h.LEDGERID = lb.Id
      ORDER BY lb.Id ASC, h.OUTWARDDATE ASC
    `);

    const parties = {};
    receivableInvoicesResult.recordset.forEach(row => {
      if (!parties[row.LedgerId]) {
        parties[row.LedgerId] = {
          closingBalance: parseFloat(row.PartyClosingBalance) || 0,
          withBillBalance: parseFloat(row.WithBillBalance) || 0,
          withoutBillBalance: parseFloat(row.WithoutBillBalance) || 0,
          invoices: []
        };
      }
      parties[row.LedgerId].invoices.push({
        outwardDate: row.OutwardDate,
        invoiceAmount: parseFloat(row.InvoiceAmount) || 0,
        creditDays: parseInt(row.CreditDays) || 0,
        bill: row.Bill === 1 || row.Bill === true || row.Bill === '1'
      });
    });

    for (const ledgerId in parties) {
      const p = parties[ledgerId];
      let outstandingLimitWithBill = p.withBillBalance > 0 ? p.withBillBalance : 0;
      let outstandingLimitWithoutBill = p.withoutBillBalance > 0 ? p.withoutBillBalance : 0;

      const sortedInvoices = [...p.invoices].sort((a, b) => new Date(b.outwardDate) - new Date(a.outwardDate));

      sortedInvoices.forEach(inv => {
        let outstandingWithBill = 0;
        if (inv.bill && outstandingLimitWithBill > 0) {
          outstandingWithBill = Math.min(inv.invoiceAmount, outstandingLimitWithBill);
          outstandingLimitWithBill -= outstandingWithBill;
        }

        let outstandingWithoutBill = 0;
        if (!inv.bill && outstandingLimitWithoutBill > 0) {
          outstandingWithoutBill = Math.min(inv.invoiceAmount, outstandingLimitWithoutBill);
          outstandingLimitWithoutBill -= outstandingWithoutBill;
        }

        const { dueDays } = calculateDueInfo(inv.outwardDate, inv.creditDays);
        if (dueDays < 0) {
          if (inv.bill) {
            totalReceivableOverdueWithBill += outstandingWithBill;
          } else {
            totalReceivableOverdueWithoutBill += outstandingWithoutBill;
          }
        }
      });
    }

    const totalReceivableOverdue = Number((totalReceivableOverdueWithBill + totalReceivableOverdueWithoutBill).toFixed(2));
    totalReceivableOverdueWithBill = Number(totalReceivableOverdueWithBill.toFixed(2));
    totalReceivableOverdueWithoutBill = Number(totalReceivableOverdueWithoutBill.toFixed(2));

    // 7b. Calculate Overdue Payables (Invoice-wise allocation)
    let totalPayableOverdueWithBill = 0;
    let totalPayableOverdueWithoutBill = 0;

    const payableInvoicesResult = await pool.request().query(`
      WITH LedgerBalances AS (
        SELECT 
          l.Id,
          ISNULL(l.PaymentTerm, 0) AS CreditDays,
          ISNULL(l.ClosingBalance, 0) AS ClosingBalance,
          ISNULL(l.OpeningBalance, 0) + ISNULL(SUM(CASE WHEN (v.Bill = 1 OR v.Bill IS NULL) THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithBillBalance,
          ISNULL(SUM(CASE WHEN v.Bill = 0 THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithoutBillBalance
        FROM LedgerMaster l
        INNER JOIN AccountGroup a ON l.AccountGroupID = a.Id
        LEFT JOIN VoucherEntry v ON l.Id = v.LedgerId
        WHERE a.GroupName IN ('Sundry Debtors', 'Party', 'Sundry Creditors', 'Vendor')
        GROUP BY l.Id, l.PaymentTerm, l.OpeningBalance, l.ClosingBalance
      )
      SELECT 
          h.ID AS InwardId,
          h.INWARDDATE AS InwardDate,
          h.TOTALAMOUNT AS InvoiceAmount,
          ISNULL(h.Bill, 1) AS Bill,
          lb.Id AS LedgerId,
          lb.CreditDays,
          lb.ClosingBalance AS VendorClosingBalance,
          lb.WithBillBalance,
          lb.WithoutBillBalance
      FROM InwardHeader h
      INNER JOIN LedgerBalances lb ON h.LEDGERID = lb.Id
      ORDER BY lb.Id ASC, h.INWARDDATE ASC
    `);

    const vendors = {};
    payableInvoicesResult.recordset.forEach(row => {
      if (!vendors[row.LedgerId]) {
        vendors[row.LedgerId] = {
          closingBalance: parseFloat(row.VendorClosingBalance) || 0,
          withBillBalance: parseFloat(row.WithBillBalance) || 0,
          withoutBillBalance: parseFloat(row.WithoutBillBalance) || 0,
          invoices: []
        };
      }
      vendors[row.LedgerId].invoices.push({
        inwardDate: row.InwardDate,
        invoiceAmount: parseFloat(row.InvoiceAmount) || 0,
        creditDays: parseInt(row.CreditDays) || 0,
        bill: row.Bill === 1 || row.Bill === true || row.Bill === '1'
      });
    });

    for (const ledgerId in vendors) {
      const v = vendors[ledgerId];
      let outstandingLimitWithBill = v.withBillBalance < 0 ? Math.abs(v.withBillBalance) : 0;
      let outstandingLimitWithoutBill = v.withoutBillBalance < 0 ? Math.abs(v.withoutBillBalance) : 0;

      const sortedInvoices = [...v.invoices].sort((a, b) => new Date(b.inwardDate) - new Date(a.inwardDate));

      sortedInvoices.forEach(inv => {
        let outstandingWithBill = 0;
        if (inv.bill && outstandingLimitWithBill > 0) {
          outstandingWithBill = Math.min(inv.invoiceAmount, outstandingLimitWithBill);
          outstandingLimitWithBill -= outstandingWithBill;
        }

        let outstandingWithoutBill = 0;
        if (!inv.bill && outstandingLimitWithoutBill > 0) {
          outstandingWithoutBill = Math.min(inv.invoiceAmount, outstandingLimitWithoutBill);
          outstandingLimitWithoutBill -= outstandingWithoutBill;
        }

        const { dueDays } = calculateDueInfo(inv.inwardDate, inv.creditDays);
        if (dueDays < 0) {
          if (inv.bill) {
            totalPayableOverdueWithBill += outstandingWithBill;
          } else {
            totalPayableOverdueWithoutBill += outstandingWithoutBill;
          }
        }
      });
    }

    const totalPayableOverdue = Number((totalPayableOverdueWithBill + totalPayableOverdueWithoutBill).toFixed(2));
    totalPayableOverdueWithBill = Number(totalPayableOverdueWithBill.toFixed(2));
    totalPayableOverdueWithoutBill = Number(totalPayableOverdueWithoutBill.toFixed(2));

    // 8. Total Turnover (Outward) & Historical Month Comparisons
    const turnoverResult = await pool.request().query(`
      SELECT 
        ISNULL(SUM(TOTALAMOUNT), 0) AS totalTurnover,
        ISNULL(SUM(CASE WHEN FORMAT(OUTWARDDATE, 'yyyy-MM') = FORMAT(GETDATE(), 'yyyy-MM') THEN TOTALAMOUNT ELSE 0 END), 0) AS currentMonthTurnover,
        ISNULL(SUM(CASE WHEN FORMAT(OUTWARDDATE, 'yyyy-MM') = FORMAT(DATEADD('month', -1, GETDATE()), 'yyyy-MM') THEN TOTALAMOUNT ELSE 0 END), 0) AS previousMonthTurnover,
        ISNULL(SUM(CASE WHEN FORMAT(OUTWARDDATE, 'yyyy-MM') = FORMAT(DATEADD('year', -1, GETDATE()), 'yyyy-MM') THEN TOTALAMOUNT ELSE 0 END), 0) AS lastYearSameMonthTurnover,
        COUNT(CASE WHEN FORMAT(OUTWARDDATE, 'yyyy-MM') = FORMAT(GETDATE(), 'yyyy-MM') THEN 1 END) AS currentMonthInvoices,
        COUNT(CASE WHEN FORMAT(OUTWARDDATE, 'yyyy-MM') = FORMAT(DATEADD('month', -1, GETDATE()), 'yyyy-MM') THEN 1 END) AS previousMonthInvoices,
        COUNT(CASE WHEN FORMAT(OUTWARDDATE, 'yyyy-MM') = FORMAT(DATEADD('year', -1, GETDATE()), 'yyyy-MM') THEN 1 END) AS lastYearSameMonthInvoices
      FROM OutwardHeader
    `);

    const turnoverData = turnoverResult.recordset[0] || {};
    const totalTurnover = turnoverData.totalTurnover || 0;
    const currentMonthTurnover = turnoverData.currentMonthTurnover || 0;
    const previousMonthTurnover = turnoverData.previousMonthTurnover || 0;
    const lastYearSameMonthTurnover = turnoverData.lastYearSameMonthTurnover || 0;

    const hasPrevMonthData = (turnoverData.previousMonthInvoices || 0) > 0 || previousMonthTurnover > 0;
    const hasLastYearData = (turnoverData.lastYearSameMonthInvoices || 0) > 0 || lastYearSameMonthTurnover > 0;

    let prevMonthDiff = currentMonthTurnover - previousMonthTurnover;
    let prevMonthGrowthPercent = hasPrevMonthData && previousMonthTurnover > 0 
      ? Number((((currentMonthTurnover - previousMonthTurnover) / previousMonthTurnover) * 100).toFixed(1))
      : null;

    let lastYearDiff = currentMonthTurnover - lastYearSameMonthTurnover;
    let lastYearGrowthPercent = hasLastYearData && lastYearSameMonthTurnover > 0 
      ? Number((((currentMonthTurnover - lastYearSameMonthTurnover) / lastYearSameMonthTurnover) * 100).toFixed(1))
      : null;

    const turnoverComparison = {
      totalTurnover,
      currentMonthTurnover,
      previousMonthTurnover,
      lastYearSameMonthTurnover,
      hasPrevMonthData,
      hasLastYearData,
      prevMonthDiff,
      prevMonthGrowthPercent,
      lastYearDiff,
      lastYearGrowthPercent
    };

    // 8a. Items Below Reorder Level (Low Stock Alert)
    const reorderResult = await pool.request().query(`
      SELECT 
        ItemCode, ISNULL(SubCode, '') AS SubCode, ItemName, ItemType, Series, Unit, Costing,
        ISNULL(ClosingStock, 0) AS ClosingStock,
        ISNULL(ReorderLevel, 0) AS ReorderLevel,
        (ISNULL(ReorderLevel, 0) - ISNULL(ClosingStock, 0)) AS Deficit
      FROM ItemMaster
      WHERE ISNULL(ReorderLevel, 0) > 0 AND ISNULL(ClosingStock, 0) < ISNULL(ReorderLevel, 0)
      ORDER BY Deficit DESC, ItemName ASC
    `);
    const lowStockItems = reorderResult.recordset || [];
    const lowStockCount = lowStockItems.length;

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
      totalReceivableWithBill,
      totalPayableWithBill,
      totalReceivableWithoutBill,
      totalPayableWithoutBill,
      totalReceivableOverdue,
      totalReceivableOverdueWithBill,
      totalReceivableOverdueWithoutBill,
      totalPayableOverdue,
      totalPayableOverdueWithBill,
      totalPayableOverdueWithoutBill,
      totalTurnover,
      turnoverComparison,
      lowStockCount,
      lowStockItems,
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

// GET /api/dashboard/notifications
exports.getDashboardNotifications = async (req, res) => {
  try {
    const pool = await connectDB();

    // 1. Low stock / below reorder level items
    const reorderResult = await pool.request().query(`
      SELECT 
        ItemCode, ISNULL(SubCode, '') AS SubCode, ItemName, ItemType, Series, Unit, Costing,
        ISNULL(ClosingStock, 0) AS ClosingStock,
        ISNULL(ReorderLevel, 0) AS ReorderLevel,
        (ISNULL(ReorderLevel, 0) - ISNULL(ClosingStock, 0)) AS Deficit
      FROM ItemMaster
      WHERE ISNULL(ReorderLevel, 0) > 0 AND ISNULL(ClosingStock, 0) < ISNULL(ReorderLevel, 0)
      ORDER BY Deficit DESC, ItemName ASC
    `);

    const notifications = [];

    (reorderResult.recordset || []).forEach(item => {
      const itemCodeStr = (item.ItemCode || '').trim();
      const subCodeStr = (item.SubCode || '').trim();
      const displayCode = subCodeStr ? `${itemCodeStr} / ${subCodeStr}` : itemCodeStr;
      notifications.push({
        id: `reorder_${itemCodeStr}_${subCodeStr}`,
        type: 'reorder',
        category: 'Low Stock Alert',
        severity: item.ClosingStock <= 0 ? 'critical' : 'warning',
        title: `Low Stock: ${item.ItemName} (${displayCode})`,
        message: `Current stock of ${item.ClosingStock} ${item.Unit} is below reorder level (${item.ReorderLevel} ${item.Unit}). Shortfall: ${item.Deficit} ${item.Unit}.`,
        itemCode: itemCodeStr,
        subCode: subCodeStr,
        itemName: item.ItemName,
        currentStock: item.ClosingStock,
        reorderLevel: item.ReorderLevel,
        deficit: item.Deficit,
        unit: item.Unit,
        timestamp: new Date().toISOString(),
        actionLink: `/dashboard/items?itemCode=${encodeURIComponent(itemCodeStr)}${subCodeStr ? `&subCode=${encodeURIComponent(subCodeStr)}` : ''}`
      });
    });

    // 2. Overdue Receivables
    const recInvoicesResult = await pool.request().query(`
      WITH LedgerBalances AS (
        SELECT 
          l.Id,
          l.LedgerName,
          ISNULL(l.PaymentTerm, 0) AS CreditDays,
          ISNULL(l.ClosingBalance, 0) AS ClosingBalance,
          ISNULL(l.OpeningBalance, 0) + ISNULL(SUM(CASE WHEN (v.Bill = 1 OR v.Bill IS NULL) THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithBillBalance,
          ISNULL(SUM(CASE WHEN v.Bill = 0 THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithoutBillBalance
        FROM LedgerMaster l
        INNER JOIN AccountGroup a ON l.AccountGroupID = a.Id
        LEFT JOIN VoucherEntry v ON l.Id = v.LedgerId
        WHERE a.GroupName IN ('Sundry Debtors', 'Party')
        GROUP BY l.Id, l.LedgerName, l.PaymentTerm, l.OpeningBalance, l.ClosingBalance
      )
      SELECT 
          h.ID AS OutwardId,
          h.OUTWARDNO AS OutwardNo,
          h.OUTWARDDATE AS OutwardDate,
          h.TOTALAMOUNT AS InvoiceAmount,
          ISNULL(h.Bill, 1) AS Bill,
          lb.Id AS LedgerId,
          lb.LedgerName,
          lb.CreditDays,
          lb.ClosingBalance AS PartyClosingBalance,
          lb.WithBillBalance,
          lb.WithoutBillBalance
      FROM OutwardHeader h
      INNER JOIN LedgerBalances lb ON h.LEDGERID = lb.Id
      ORDER BY lb.Id ASC, h.OUTWARDDATE ASC
    `);

    const parties = {};
    (recInvoicesResult.recordset || []).forEach(row => {
      if (!parties[row.LedgerId]) {
        parties[row.LedgerId] = {
          ledgerName: row.LedgerName,
          closingBalance: parseFloat(row.PartyClosingBalance) || 0,
          invoices: []
        };
      }
      parties[row.LedgerId].invoices.push({
        outwardId: row.OutwardId,
        outwardNo: row.OutwardNo,
        outwardDate: row.OutwardDate,
        invoiceAmount: parseFloat(row.InvoiceAmount) || 0,
        creditDays: parseInt(row.CreditDays) || 0,
        bill: row.Bill === 1 || row.Bill === true || row.Bill === '1'
      });
    });

    for (const ledgerId in parties) {
      const p = parties[ledgerId];
      let limit = p.closingBalance > 0 ? p.closingBalance : 0;
      const sortedInvoices = [...p.invoices].sort((a, b) => new Date(b.outwardDate) - new Date(a.outwardDate));

      sortedInvoices.forEach(inv => {
        let outstanding = 0;
        if (limit > 0) {
          outstanding = Math.min(inv.invoiceAmount, limit);
          limit -= outstanding;
        }

        if (outstanding > 0) {
          const { dueDays } = calculateDueInfo(inv.outwardDate, inv.creditDays);
          if (dueDays < 0) {
            notifications.push({
              id: `rec_overdue_${inv.outwardId}_${ledgerId}`,
              type: 'receivable_overdue',
              category: 'Payment Overdue',
              severity: Math.abs(dueDays) > 30 ? 'critical' : 'warning',
              title: `Overdue from ${p.ledgerName}`,
              message: `Payment of ₹${Math.round(outstanding).toLocaleString('en-IN')} for Sales #${inv.outwardNo} is overdue by ${Math.abs(dueDays)} days.`,
              amount: outstanding,
              dueDays: dueDays,
              outwardNo: inv.outwardNo,
              partyName: p.ledgerName,
              ledgerId: ledgerId,
              timestamp: new Date().toISOString(),
              actionLink: `/dashboard/reports/invoice-receivable?partyName=${encodeURIComponent(p.ledgerName)}&invoiceNo=${encodeURIComponent(inv.outwardNo)}`
            });
          }
        }
      });
    }

    // 3. Overdue Payables
    const payInvoicesResult = await pool.request().query(`
      WITH LedgerBalances AS (
        SELECT 
          l.Id,
          l.LedgerName,
          ISNULL(l.PaymentTerm, 0) AS CreditDays,
          ISNULL(l.ClosingBalance, 0) AS ClosingBalance,
          ISNULL(l.OpeningBalance, 0) + ISNULL(SUM(CASE WHEN (v.Bill = 1 OR v.Bill IS NULL) THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithBillBalance,
          ISNULL(SUM(CASE WHEN v.Bill = 0 THEN (CASE WHEN v.Mode = 'Debit' THEN v.Amount ELSE -v.Amount END) ELSE 0 END), 0) AS WithoutBillBalance
        FROM LedgerMaster l
        INNER JOIN AccountGroup a ON l.AccountGroupID = a.Id
        LEFT JOIN VoucherEntry v ON l.Id = v.LedgerId
        WHERE a.GroupName IN ('Sundry Creditors', 'Vendor')
        GROUP BY l.Id, l.LedgerName, l.PaymentTerm, l.OpeningBalance, l.ClosingBalance
      )
      SELECT 
          h.ID AS InwardId,
          h.INWARDNO AS InwardNo,
          h.INWARDDATE AS InwardDate,
          h.TOTALAMOUNT AS InvoiceAmount,
          ISNULL(h.Bill, 1) AS Bill,
          lb.Id AS LedgerId,
          lb.LedgerName,
          lb.CreditDays,
          lb.ClosingBalance AS VendorClosingBalance,
          lb.WithBillBalance,
          lb.WithoutBillBalance
      FROM InwardHeader h
      INNER JOIN LedgerBalances lb ON h.LEDGERID = lb.Id
      ORDER BY lb.Id ASC, h.INWARDDATE ASC
    `);

    const vendors = {};
    (payInvoicesResult.recordset || []).forEach(row => {
      if (!vendors[row.LedgerId]) {
        vendors[row.LedgerId] = {
          ledgerName: row.LedgerName,
          closingBalance: parseFloat(row.VendorClosingBalance) || 0,
          invoices: []
        };
      }
      vendors[row.LedgerId].invoices.push({
        inwardId: row.InwardId,
        inwardNo: row.InwardNo,
        inwardDate: row.InwardDate,
        invoiceAmount: parseFloat(row.InvoiceAmount) || 0,
        creditDays: parseInt(row.CreditDays) || 0,
        bill: row.Bill === 1 || row.Bill === true || row.Bill === '1'
      });
    });

    for (const ledgerId in vendors) {
      const v = vendors[ledgerId];
      let limit = v.closingBalance < 0 ? Math.abs(v.closingBalance) : 0;
      const sortedInvoices = [...v.invoices].sort((a, b) => new Date(b.inwardDate) - new Date(a.inwardDate));

      sortedInvoices.forEach(inv => {
        let outstanding = 0;
        if (limit > 0) {
          outstanding = Math.min(inv.invoiceAmount, limit);
          limit -= outstanding;
        }

        if (outstanding > 0) {
          const { dueDays } = calculateDueInfo(inv.inwardDate, inv.creditDays);
          if (dueDays < 0) {
            notifications.push({
              id: `pay_overdue_${inv.inwardId}_${ledgerId}`,
              type: 'payable_overdue',
              category: 'Payment Obligation',
              severity: Math.abs(dueDays) > 30 ? 'critical' : 'warning',
              title: `Payment Due to ${v.ledgerName}`,
              message: `Payment of ₹${Math.round(outstanding).toLocaleString('en-IN')} for Purchase #${inv.inwardNo} is overdue by ${Math.abs(dueDays)} days.`,
              amount: outstanding,
              dueDays: dueDays,
              inwardNo: inv.inwardNo,
              vendorName: v.ledgerName,
              ledgerId: ledgerId,
              timestamp: new Date().toISOString(),
              actionLink: `/dashboard/reports/invoice-payable?vendorName=${encodeURIComponent(v.ledgerName)}&invoiceNo=${encodeURIComponent(inv.inwardNo)}`
            });
          }
        }
      });
    }

    const summary = {
      total: notifications.length,
      reorder: notifications.filter(n => n.type === 'reorder').length,
      receivables: notifications.filter(n => n.type === 'receivable_overdue').length,
      payables: notifications.filter(n => n.type === 'payable_overdue').length,
      critical: notifications.filter(n => n.severity === 'critical').length,
      warning: notifications.filter(n => n.severity === 'warning').length
    };

    res.status(200).json({
      notifications,
      summary
    });
  } catch (error) {
    console.error('Error fetching dashboard notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
