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
      SELECT 
        dm.DeptID,
        dm.DeptName,
        ISNULL(SUM(
          (CASE 
            WHEN UPPER(im.Unit) IN ('KG', 'KGS') AND ISNULL(ds.Weight, 0) != 0 THEN ISNULL(ds.Weight, 0)
            WHEN UPPER(im.Unit) NOT IN ('KG', 'KGS') AND ISNULL(ds.Pcs, 0) != 0 THEN ISNULL(ds.Pcs, 0)
            WHEN ISNULL(ds.Weight, 0) != 0 THEN ISNULL(ds.Weight, 0)
            ELSE ISNULL(ds.Pcs, 0)
          END) * ISNULL(dm.Costing, 0)
        ), 0) AS totalValue,
        ISNULL(SUM(ds.Pcs), 0) AS totalPcs,
        ISNULL(SUM(ds.Weight), 0) AS totalWeight
      FROM DepartmentMaster dm
      LEFT JOIN DepartmentStock ds ON dm.DeptID = ds.DeptID
      LEFT JOIN ItemMaster im ON ds.ItemCode = im.ItemCode AND ISNULL(ds.SubCode, '') = ISNULL(im.SubCode, '')
      GROUP BY dm.DeptID, dm.DeptName, dm.Costing
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
        ISNULL(SUM(CASE WHEN FORMAT(OUTWARDDATE, 'yyyy-MM') = FORMAT(DATEADD(month, -1, GETDATE()), 'yyyy-MM') THEN TOTALAMOUNT ELSE 0 END), 0) AS previousMonthTurnover,
        ISNULL(SUM(CASE WHEN FORMAT(OUTWARDDATE, 'yyyy-MM') = FORMAT(DATEADD(year, -1, GETDATE()), 'yyyy-MM') THEN TOTALAMOUNT ELSE 0 END), 0) AS lastYearSameMonthTurnover,
        COUNT(CASE WHEN FORMAT(OUTWARDDATE, 'yyyy-MM') = FORMAT(GETDATE(), 'yyyy-MM') THEN 1 END) AS currentMonthInvoices,
        COUNT(CASE WHEN FORMAT(OUTWARDDATE, 'yyyy-MM') = FORMAT(DATEADD(month, -1, GETDATE()), 'yyyy-MM') THEN 1 END) AS previousMonthInvoices,
        COUNT(CASE WHEN FORMAT(OUTWARDDATE, 'yyyy-MM') = FORMAT(DATEADD(year, -1, GETDATE()), 'yyyy-MM') THEN 1 END) AS lastYearSameMonthInvoices
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

    // 12. Purchase Authority & Sales Authority Metrics (PO Fulfillment, Ready to Dispatch & Shortfall)
    const authorityOrdersResult = await pool.request().query(`
      SELECT 
        i.ItemCode,
        ISNULL(i.SubCode, '') AS SubCode,
        i.ItemName,
        ISNULL(i.Category, 'Inhouse') AS Category,
        i.Unit,
        ISNULL(i.Costing, 0) AS Costing,
        ISNULL(i.ClosingStock, 0) AS StockInHand,
        ISNULL(po.TotalPOPendingQty, 0) AS TotalPOPendingQty,
        ISNULL(po.TotalPOOrderedQty, 0) AS TotalPOOrderedQty,
        ISNULL(po.POCount, 0) AS POCount,
        ISNULL(po.PODetailsList, '') AS AssociatedPOs,
        ISNULL(pi.TotalPIPendingQty, 0) AS PendingPIQty,
        ISNULL(pi.PIDetailsList, '') AS AssociatedPIs,
        (
          SELECT COUNT(*) 
          FROM BOM_Master b 
          WHERE b.ParentItemCode = i.ItemCode 
            AND (ISNULL(b.ParentSubCode, '') = ISNULL(i.SubCode, '') OR (ISNULL(b.ParentSubCode, '') = '' AND NOT EXISTS (SELECT 1 FROM BOM_Master b2 WHERE b2.ParentItemCode = i.ItemCode AND ISNULL(b2.ParentSubCode, '') = ISNULL(i.SubCode, ''))))
        ) AS BOMCount
      FROM (
        SELECT 
          d.ITEMCODE,
          ISNULL(d.SUBCODE, '') AS SUBCODE,
          SUM(d.PENDINGQTY) AS TotalPOPendingQty,
          SUM(d.QUANTITY) AS TotalPOOrderedQty,
          COUNT(DISTINCT h.ID) AS POCount,
          STRING_AGG(CONCAT(h.PONO, ' (', CAST(d.PENDINGQTY AS INT), ' ', ISNULL(d.UNIT, 'PCS'), ')'), ', ') AS PODetailsList
        FROM PurchaseOrderDetail d
        INNER JOIN PurchaseOrderHeader h ON d.POID = h.ID
        WHERE UPPER(h.STATUS) IN ('PENDING', 'PARTIALLY FULFILLED') AND d.PENDINGQTY > 0
        GROUP BY d.ITEMCODE, ISNULL(d.SUBCODE, '')
      ) po
      JOIN ItemMaster i ON po.ITEMCODE = i.ItemCode AND po.SUBCODE = ISNULL(i.SubCode, '')
      LEFT JOIN (
        SELECT 
          pid.ITEMCODE,
          ISNULL(pid.SUBCODE, '') AS SUBCODE,
          SUM(pid.PENDINGQTY) AS TotalPIPendingQty,
          STRING_AGG(CONCAT(pih.PINO, ' (', CAST(pid.PENDINGQTY AS INT), ' ', ISNULL(pid.UNIT, 'PCS'), ')'), ', ') AS PIDetailsList
        FROM PerformaInvoiceDetail pid
        INNER JOIN PerformaInvoiceHeader pih ON pid.PIID = pih.ID
        WHERE UPPER(pih.STATUS) IN ('ORDERED', 'PARTIALLY RECEIVED', 'DRAFT') AND pid.PENDINGQTY > 0
        GROUP BY pid.ITEMCODE, ISNULL(pid.SUBCODE, '')
      ) pi ON i.ItemCode = pi.ITEMCODE AND ISNULL(i.SubCode, '') = pi.SUBCODE
      ORDER BY (po.TotalPOPendingQty - ISNULL(i.ClosingStock, 0) - ISNULL(pi.TotalPIPendingQty, 0)) DESC, i.ItemCode ASC
    `);

    const authorityRows = authorityOrdersResult.recordset || [];

    const distinctPOCountResult = await pool.request().query(`
      SELECT COUNT(DISTINCT ID) AS totalPendingPOs
      FROM PurchaseOrderHeader
      WHERE UPPER(STATUS) IN ('PENDING', 'PARTIALLY FULFILLED')
    `);
    const totalPendingPOsCount = distinctPOCountResult.recordset[0]?.totalPendingPOs || 0;

    // Process Purchase Authority Metrics
    const purchaseShortfallItems = [];
    let purchaseTotalPOQty = 0;
    let purchaseTotalShortfallQty = 0;
    let purchaseTotalMissingValue = 0;
    let purchasePipelinePIQty = 0;
    let allPendingPOQty = 0;

    // Process Sales Authority Metrics
    const salesPendingOrderItems = [];
    let salesTotalOrderQty = 0;
    let salesReadyToDispatchQty = 0;
    let salesTotalShortfallQty = 0;
    let salesFullyReadyCount = 0;
    let salesPartialOrShortfallCount = 0;

    authorityRows.forEach(row => {
      const poDemand = parseFloat(row.TotalPOPendingQty) || 0;
      const stock = parseFloat(row.StockInHand) || 0;
      const piPending = parseFloat(row.PendingPIQty) || 0;
      const costing = parseFloat(row.Costing) || 0;

      allPendingPOQty += poDemand;
      purchasePipelinePIQty += piPending;

      // Purchase Authority Shortfall formula: Math.max(0, poDemand - stock - piPending)
      const purchaseShortfall = Math.max(0, poDemand - stock - piPending);
      const purchaseMissingVal = Math.round(purchaseShortfall * costing * 100) / 100;

      if (purchaseShortfall > 0) {
        purchaseTotalPOQty += poDemand;
        purchaseTotalShortfallQty += purchaseShortfall;
        purchaseTotalMissingValue += purchaseMissingVal;

        purchaseShortfallItems.push({
          itemCode: row.ItemCode,
          subCode: row.SubCode || '',
          itemName: row.ItemName,
          category: row.Category || 'Inhouse',
          unit: row.Unit || 'PCS',
          costing: costing,
          poPendingQty: poDemand,
          stockInHand: stock,
          piPendingQty: piPending,
          shortfallQty: purchaseShortfall,
          missingValue: purchaseMissingVal,
          associatedPOs: row.AssociatedPOs || '',
          associatedPIs: row.AssociatedPIs || '',
          hasBOM: (parseInt(row.BOMCount) || 0) > 0,
          bomCount: parseInt(row.BOMCount) || 0,
          status: piPending > 0 ? 'Partial Shortfall' : 'Critical Shortfall'
        });
      }

      // Sales Authority Dispatch formula:
      // Ready to dispatch = Math.min(poDemand, Math.max(0, stock))
      // Sales shortfall = Math.max(0, poDemand - Math.max(0, stock))
      const readyQty = Math.min(poDemand, Math.max(0, stock));
      const salesShortfall = Math.max(0, poDemand - Math.max(0, stock));

      salesTotalOrderQty += poDemand;
      salesReadyToDispatchQty += readyQty;
      salesTotalShortfallQty += salesShortfall;

      if (salesShortfall === 0) {
        salesFullyReadyCount++;
      } else {
        salesPartialOrShortfallCount++;
      }

      salesPendingOrderItems.push({
        itemCode: row.ItemCode,
        subCode: row.SubCode || '',
        itemName: row.ItemName,
        category: row.Category || 'Inhouse',
        unit: row.Unit || 'PCS',
        poPendingQty: poDemand,
        stockInHand: stock,
        readyToDispatchQty: readyQty,
        shortfallQty: salesShortfall,
        associatedPOs: row.AssociatedPOs || '',
        status: salesShortfall === 0 ? 'Ready to Dispatch' : (readyQty > 0 ? 'Partial Dispatch Ready' : 'Awaiting Stock')
      });
    });

    const salesReadinessPercentage = salesTotalOrderQty > 0 
      ? Math.round((salesReadyToDispatchQty / salesTotalOrderQty) * 100) 
      : 100;

    const purchaseAuthority = {
      shortfallItemsCount: purchaseShortfallItems.length,
      totalShortfallQty: Math.round(purchaseTotalShortfallQty * 1000) / 1000,
      totalPOQty: Math.round(purchaseTotalPOQty * 1000) / 1000,
      allPendingPOQty: Math.round(allPendingPOQty * 1000) / 1000,
      pipelinePIQty: Math.round(purchasePipelinePIQty * 1000) / 1000,
      totalMissingValue: Math.round(purchaseTotalMissingValue * 100) / 100,
      items: purchaseShortfallItems
    };

    const salesAuthority = {
      pendingOrderItemsCount: salesPendingOrderItems.length,
      totalPendingOrdersCount: totalPendingPOsCount,
      totalOrderQty: Math.round(salesTotalOrderQty * 1000) / 1000,
      readyToDispatchQty: Math.round(salesReadyToDispatchQty * 1000) / 1000,
      shortfallQty: Math.round(salesTotalShortfallQty * 1000) / 1000,
      readinessPercentage: salesReadinessPercentage,
      fullyReadyItemsCount: salesFullyReadyCount,
      partialOrShortfallCount: salesPartialOrShortfallCount,
      items: salesPendingOrderItems
    };

    // 14. Overdue Proof of Delivery (POD) Count
    let overduePodCount = 0;
    try {
      const pendingPodResult = await pool.request().query(`
        SELECT 
          h.ID, h.OUTWARDDATE, ISNULL(l.DeliveryDays, 0) AS DeliveryDays
        FROM OutwardHeader h
        LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
        WHERE (h.DateOfPod IS NULL OR TRIM(h.DateOfPod) = '' OR h.DateOfPod = '-')
      `);
      const nowDt = new Date();
      const todayDt = new Date(nowDt.getFullYear(), nowDt.getMonth(), nowDt.getDate());
      (pendingPodResult.recordset || []).forEach(r => {
        const invDateStr = String(r.OUTWARDDATE || '').split('T')[0];
        const days = parseInt(r.DeliveryDays, 10) || 0;
        const parts = invDateStr.split('-');
        if (parts.length === 3) {
          const expDt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          expDt.setDate(expDt.getDate() + days);
          if (todayDt > expDt) {
            overduePodCount++;
          }
        }
      });
    } catch (err) {
      console.error('Error counting overdue PODs for KPIs:', err);
    }

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
      departmentStocks,
      purchaseAuthority,
      salesAuthority,
      overduePodCount
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

    // Query status tracking table
    let statusMap = new Map();
    let closedRowsList = [];
    try {
      const statusRes = await pool.request().query(`
        SELECT NotificationId, NotificationType, Title, Message, Status, GeneratedAt, ClosedAt, ClosedBy, ClosedReason
        FROM NotificationLogStatus
      `);
      (statusRes.recordset || []).forEach(r => {
        statusMap.set(r.NotificationId, r);
        if (r.Status === 'Closed') {
          closedRowsList.push(r);
        }
      });
    } catch (stErr) {
      console.warn('Notice querying NotificationLogStatus:', stErr.message);
    }

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

    // 1b. Purchase Shortfall & Sales Ready Notifications (Authority Alerts)
    const authorityNotifResult = await pool.request().query(`
      SELECT 
        i.ItemCode,
        ISNULL(i.SubCode, '') AS SubCode,
        i.ItemName,
        i.Unit,
        ISNULL(i.ClosingStock, 0) AS StockInHand,
        ISNULL(po.TotalPOPendingQty, 0) AS TotalPOPendingQty,
        ISNULL(pi.TotalPIPendingQty, 0) AS PendingPIQty,
        ISNULL(po.PODetailsList, '') AS AssociatedPOs
      FROM (
        SELECT 
          d.ITEMCODE,
          ISNULL(d.SUBCODE, '') AS SUBCODE,
          SUM(d.PENDINGQTY) AS TotalPOPendingQty,
          STRING_AGG(h.PONO, ', ') AS PODetailsList
        FROM PurchaseOrderDetail d
        INNER JOIN PurchaseOrderHeader h ON d.POID = h.ID
        WHERE UPPER(h.STATUS) IN ('PENDING', 'PARTIALLY FULFILLED') AND d.PENDINGQTY > 0
        GROUP BY d.ITEMCODE, ISNULL(d.SUBCODE, '')
      ) po
      JOIN ItemMaster i ON po.ITEMCODE = i.ItemCode AND po.SUBCODE = ISNULL(i.SubCode, '')
      LEFT JOIN (
        SELECT 
          pid.ITEMCODE,
          ISNULL(pid.SUBCODE, '') AS SUBCODE,
          SUM(pid.PENDINGQTY) AS TotalPIPendingQty
        FROM PerformaInvoiceDetail pid
        INNER JOIN PerformaInvoiceHeader pih ON pid.PIID = pih.ID
        WHERE UPPER(pih.STATUS) IN ('ORDERED', 'PARTIALLY RECEIVED', 'DRAFT') AND pid.PENDINGQTY > 0
        GROUP BY pid.ITEMCODE, ISNULL(pid.SUBCODE, '')
      ) pi ON i.ItemCode = pi.ITEMCODE AND ISNULL(i.SubCode, '') = pi.SUBCODE
    `);

    (authorityNotifResult.recordset || []).forEach(item => {
      const itemCodeStr = (item.ItemCode || '').trim();
      const subCodeStr = (item.SubCode || '').trim();
      const displayCode = subCodeStr ? `${itemCodeStr} / ${subCodeStr}` : itemCodeStr;
      const poDemand = parseFloat(item.TotalPOPendingQty) || 0;
      const stock = parseFloat(item.StockInHand) || 0;
      const piPending = parseFloat(item.PendingPIQty) || 0;

      const shortfallQty = Math.max(0, poDemand - stock - piPending);
      if (shortfallQty > 0) {
        notifications.push({
          id: `shortfall_${itemCodeStr}_${subCodeStr}`,
          type: 'shortfall',
          category: 'Purchase Shortfall Alert',
          severity: 'critical',
          title: `Procurement Shortfall: ${item.ItemName} (${displayCode})`,
          message: `Pending POs (${item.AssociatedPOs}) need ${poDemand} ${item.Unit}. Stock in hand: ${stock} ${item.Unit}. Shortfall to purchase: ${shortfallQty} ${item.Unit}.`,
          itemCode: itemCodeStr,
          subCode: subCodeStr,
          itemName: item.ItemName,
          poDemand,
          stockInHand: stock,
          shortfallQty,
          unit: item.Unit,
          timestamp: new Date().toISOString(),
          actionLink: `/dashboard/reports/pending-po?tab=2&search=${encodeURIComponent(itemCodeStr)}`
        });
      }

      // If fully ready to dispatch for sales
      if (stock >= poDemand && poDemand > 0) {
        notifications.push({
          id: `dispatch_ready_${itemCodeStr}_${subCodeStr}`,
          type: 'dispatch_ready',
          category: 'Sales Ready to Dispatch',
          severity: 'success',
          title: `Ready for Dispatch: ${item.ItemName} (${displayCode})`,
          message: `Full order quantity (${poDemand} ${item.Unit}) is ready in stock (${stock} available). You can generate Sales Outward.`,
          itemCode: itemCodeStr,
          subCode: subCodeStr,
          itemName: item.ItemName,
          poDemand,
          stockInHand: stock,
          unit: item.Unit,
          timestamp: new Date().toISOString(),
          actionLink: `/dashboard/outward?itemCode=${encodeURIComponent(itemCodeStr)}`
        });
      }
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

    // 4. Overdue Proof of Delivery (POD) Shipments
    try {
      const pendingPodResult = await pool.request().query(`
        SELECT 
          h.ID AS OutwardId,
          h.OUTWARDNO AS OutwardNo,
          h.OUTWARDDATE AS OutwardDate,
          h.TOTALAMOUNT AS TotalAmount,
          h.CourierCompany,
          h.AwbNo,
          h.TransportMode,
          h.DateOfPod,
          h.Bill,
          l.Id AS LedgerId,
          l.LedgerName,
          l.City,
          l.State,
          ISNULL(l.DeliveryDays, 0) AS DeliveryDays
        FROM OutwardHeader h
        LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
        WHERE (h.DateOfPod IS NULL OR TRIM(h.DateOfPod) = '' OR h.DateOfPod = '-')
        ORDER BY h.OUTWARDDATE ASC
      `);

      const addDaysToDateStr = (dateStr, days) => {
        if (!dateStr) return '';
        const parts = String(dateStr).split('T')[0].split('-');
        if (parts.length < 3) return dateStr;
        const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        dt.setDate(dt.getDate() + (parseInt(days, 10) || 0));
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      };

      const parseLocalDate = (dateStr) => {
        if (!dateStr) return null;
        const parts = String(dateStr).split('T')[0].split('-');
        if (parts.length < 3) return null;
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      };

      const nowDt = new Date();
      const todayDt = new Date(nowDt.getFullYear(), nowDt.getMonth(), nowDt.getDate());

      (pendingPodResult.recordset || []).forEach(row => {
        const invDateStr = String(row.OutwardDate || '').split('T')[0];
        const deliveryDays = parseInt(row.DeliveryDays, 10) || 0;
        const expectedDateStr = addDaysToDateStr(invDateStr, deliveryDays);
        const expectedDeliveryDate = parseLocalDate(expectedDateStr);

        if (expectedDeliveryDate && todayDt > expectedDeliveryDate) {
          const diffDays = Math.floor((todayDt.getTime() - expectedDeliveryDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) {
            const expParts = expectedDateStr.split('-');
            const expDisplay = expParts.length === 3 ? `${expParts[2]}/${expParts[1]}/${expParts[0]}` : expectedDateStr;
            const trackingInfo = row.CourierCompany 
              ? `Dispatched via ${row.CourierCompany}${row.AwbNo ? ` (AWB: ${row.AwbNo})` : ''}` 
              : 'Not yet dispatched';

            notifications.push({
              id: `pod_overdue_${row.OutwardId}`,
              type: 'overdue_pod',
              category: 'Delivery POD Overdue',
              severity: diffDays > 7 ? 'critical' : 'warning',
              title: `POD Overdue (${diffDays}d late): Sales #${row.OutwardNo} • ${row.LedgerName}`,
              message: `Delivery confirmation (POD) for invoice #${row.OutwardNo} to ${row.LedgerName}${row.City ? ` (${row.City})` : ''} was expected on ${expDisplay} (${deliveryDays}d term), but Date of POD is not entered. ${trackingInfo}.`,
              outwardNo: row.OutwardNo,
              outwardId: row.OutwardId,
              partyName: row.LedgerName,
              city: row.City,
              amount: parseFloat(row.TotalAmount) || 0,
              deliveryDays: deliveryDays,
              expectedDeliveryDate: expectedDateStr,
              overdueDays: diffDays,
              courierCompany: row.CourierCompany,
              awbNo: row.AwbNo,
              transportMode: row.TransportMode,
              timestamp: new Date().toISOString(),
              actionLink: `/dashboard/reports/pending-pod?search=${encodeURIComponent(row.OutwardNo)}`
            });
          }
        }
      });
    } catch (podErr) {
      console.error('Error fetching overdue POD notifications:', podErr);
    }

    // 1f. Fetch Task Notifications for current user
    try {
      const currentUserId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;
      const currentUsername = (req.headers['x-username'] || '').trim();

      if (currentUserId || currentUsername) {
        let taskNotifQuery = `
          SELECT tn.NotificationId, tn.TaskId, tn.FromUsername, tn.Type, tn.Title, tn.Message, tn.Status, tn.CreatedAt, tn.ClosedAt, tn.ClosedBy
          FROM TaskNotifications tn
          WHERE 1=1
        `;
        if (currentUserId) {
          taskNotifQuery += ` AND tn.UserId = ${currentUserId}`;
        } else if (currentUsername) {
          taskNotifQuery += ` AND tn.UserId IN (SELECT UserId FROM Users WHERE LOWER(Username) = '${currentUsername.toLowerCase().replace(/'/g, "''")}')`;
        }
        taskNotifQuery += ` ORDER BY tn.CreatedAt DESC`;

        const taskNotifRes = await pool.request().query(taskNotifQuery);
        (taskNotifRes.recordset || []).forEach(tn => {
          notifications.push({
            id: `task_notif_${tn.NotificationId}`,
            type: 'task_notification',
            category: 'Task Alert',
            severity: tn.Type === 'TASK_COMPLETED' ? 'success' : 'info',
            title: tn.Title,
            message: tn.Message,
            status: tn.Status || 'Open',
            generatedAt: tn.CreatedAt ? new Date(tn.CreatedAt).toISOString() : new Date().toISOString(),
            closedAt: tn.ClosedAt ? new Date(tn.ClosedAt).toISOString() : null,
            closedBy: tn.ClosedBy || null,
            timestamp: tn.CreatedAt ? new Date(tn.CreatedAt).toISOString() : new Date().toISOString(),
            actionLink: `/dashboard/tasks?taskId=${tn.TaskId}`
          });
        });
      }
    } catch (tnErr) {
      console.warn('Error fetching TaskNotifications:', tnErr.message);
    }

    // 1g. Fetch CRM Leads Alerts (Overdue follow-ups, Due today, Stuck inquiries, Missing next action)
    try {
      const crmLeadsResult = await pool.request().query(`
        SELECT 
          LeadID,
          CONVERT(VARCHAR(10), DateAdded, 120) AS DateAdded,
          Customer,
          ISNULL(Country, 'India') AS Country,
          ISNULL(Contact, '') AS Contact,
          ISNULL(ProductRequirement, '') AS ProductRequirement,
          ISNULL(ItemCode, '') AS ItemCode,
          Stage,
          ISNULL(NextAction, '') AS NextAction,
          CONVERT(VARCHAR(10), FollowUpDate, 120) AS FollowUpDate,
          ISNULL(DealValue, 0) AS DealValue,
          ISNULL(Source, '') AS Source,
          DATEDIFF(day, DateAdded, GETDATE()) AS AgeDays,
          DATEDIFF(day, FollowUpDate, GETDATE()) AS OverdueDays
        FROM CRM_Leads
        WHERE LOWER(Stage) NOT IN ('won', 'lost')
      `);

      const todayStr = new Date().toISOString().split('T')[0];

      (crmLeadsResult.recordset || []).forEach(lead => {
        const leadId = lead.LeadID;
        const customer = (lead.Customer || '').trim();
        const stage = lead.Stage || 'New';
        const dealVal = parseFloat(lead.DealValue) || 0;
        const valFormatted = dealVal > 0 ? `₹${Math.round(dealVal).toLocaleString('en-IN')}` : '';
        const fu = lead.FollowUpDate;
        const na = (lead.NextAction || '').trim();
        const reqStr = lead.ProductRequirement || lead.ItemCode || '';

        // 1g-i. Overdue Follow-up
        if (fu && fu < todayStr) {
          const diffDays = Math.max(1, parseInt(lead.OverdueDays, 10) || 1);
          notifications.push({
            id: `crm_overdue_${leadId}`,
            type: 'crm_overdue',
            category: 'CRM Follow-up Overdue',
            severity: diffDays > 3 ? 'critical' : 'warning',
            title: `CRM Follow-up Overdue (${diffDays}d late): ${customer} [${stage}]`,
            message: `Follow-up with ${customer} was scheduled for ${fu} (${diffDays} days ago). Next Action: "${na || 'Follow up with customer'}".${valFormatted ? ` Deal Value: ${valFormatted}.` : ''}${reqStr ? ` Requirement: ${reqStr}.` : ''}`,
            customer: customer,
            stage: stage,
            dealValue: dealVal,
            followUpDate: fu,
            nextAction: na,
            overdueDays: diffDays,
            timestamp: new Date().toISOString(),
            actionLink: `/dashboard/crm?search=${encodeURIComponent(customer)}`
          });
        }
        // 1g-ii. Due Today Follow-up
        else if (fu && fu === todayStr) {
          notifications.push({
            id: `crm_today_${leadId}`,
            type: 'crm_today',
            category: 'CRM Due Today',
            severity: 'warning',
            title: `CRM Follow-up Due Today: ${customer} [${stage}]`,
            message: `Sales follow-up with ${customer} is scheduled for today! Next Action: "${na || 'Contact customer'}".${valFormatted ? ` Deal Value: ${valFormatted}.` : ''}${reqStr ? ` Requirement: ${reqStr}.` : ''}`,
            customer: customer,
            stage: stage,
            dealValue: dealVal,
            followUpDate: fu,
            nextAction: na,
            timestamp: new Date().toISOString(),
            actionLink: `/dashboard/crm?search=${encodeURIComponent(customer)}`
          });
        }
        // 1g-iii. Missing Next Action / Follow-up Date
        else if (!na || !fu) {
          notifications.push({
            id: `crm_no_action_${leadId}`,
            type: 'crm_no_action',
            category: 'CRM Action Required',
            severity: 'warning',
            title: `CRM Action Required: ${customer} [${stage}]`,
            message: `Inquiry from ${customer} (${stage}) is missing a Next Action or Follow-up Date.${valFormatted ? ` Deal Value: ${valFormatted}.` : ''} Plan next step to keep inquiry moving.`,
            customer: customer,
            stage: stage,
            dealValue: dealVal,
            timestamp: new Date().toISOString(),
            actionLink: `/dashboard/crm?search=${encodeURIComponent(customer)}`
          });
        }
        // 1g-iv. Stuck Inquiry (>21 days)
        else if (parseInt(lead.AgeDays, 10) > 21) {
          notifications.push({
            id: `crm_stuck_${leadId}`,
            type: 'crm_stuck',
            category: 'CRM Stuck Lead (>21d)',
            severity: 'info',
            title: `CRM Stuck Inquiry (${lead.AgeDays}d open): ${customer} [${stage}]`,
            message: `Inquiry from ${customer} has been open in stage "${stage}" for ${lead.AgeDays} days.${valFormatted ? ` Deal Value: ${valFormatted}.` : ''} Review proposal or follow up with buyer.`,
            customer: customer,
            stage: stage,
            dealValue: dealVal,
            timestamp: new Date().toISOString(),
            actionLink: `/dashboard/crm?search=${encodeURIComponent(customer)}`
          });
        }
      });
    } catch (crmErr) {
      console.error('Error fetching CRM notifications:', crmErr);
    }

    // Map status and lock generated timestamp for all notifications (excluding Deleted)
    const activeNotifications = [];
    for (const n of notifications) {
      const existing = statusMap.get(n.id);
      if (existing && existing.Status === 'Deleted') {
        // Suppress deleted notification
        continue;
      }

      if (existing) {
        n.status = existing.Status || 'Open';
        n.generatedAt = existing.GeneratedAt ? new Date(existing.GeneratedAt).toISOString() : n.timestamp;
        n.closedAt = existing.ClosedAt ? new Date(existing.ClosedAt).toISOString() : null;
        n.closedBy = existing.ClosedBy || null;
        n.closedReason = existing.ClosedReason || null;
      } else {
        n.status = 'Open';
        n.generatedAt = n.timestamp || new Date().toISOString();
        n.closedAt = null;
        n.closedBy = null;
        n.closedReason = null;

        // Persist discovered open alert so its initial GeneratedAt timestamp is recorded
        try {
          const checkRes = await pool.request()
            .input('NotificationId', n.id)
            .query('SELECT 1 FROM NotificationLogStatus WHERE NotificationId = @NotificationId');

          if (!checkRes.recordset || checkRes.recordset.length === 0) {
            await pool.request()
              .input('NotificationId', n.id)
              .input('NotificationType', n.type || '')
              .input('Title', (n.title || '').slice(0, 255))
              .input('Message', (n.message || '').slice(0, 1000))
              .input('GeneratedAt', new Date(n.generatedAt))
              .query(`
                INSERT INTO NotificationLogStatus (NotificationId, NotificationType, Title, Message, Status, GeneratedAt)
                VALUES (@NotificationId, @NotificationType, @Title, @Message, 'Open', @GeneratedAt)
              `);
          }
        } catch (e) {
          // ignore duplicate insert errors
        }
      }
      activeNotifications.push(n);
    }

    // Include closed alerts from historical database records if not already in dynamic list
    closedRowsList.forEach(r => {
      if (r.Status !== 'Deleted' && !activeNotifications.some(x => x.id === r.NotificationId)) {
        activeNotifications.push({
          id: r.NotificationId,
          type: r.NotificationType || 'general',
          category: r.NotificationType ? r.NotificationType.replace(/_/g, ' ').toUpperCase() : 'Closed Alert',
          severity: 'info',
          title: r.Title || 'Closed Alert',
          message: r.Message || 'This alert was marked as closed.',
          status: 'Closed',
          generatedAt: r.GeneratedAt ? new Date(r.GeneratedAt).toISOString() : new Date().toISOString(),
          closedAt: r.ClosedAt ? new Date(r.ClosedAt).toISOString() : new Date().toISOString(),
          closedBy: r.ClosedBy || 'User',
          closedReason: r.ClosedReason || 'Closed by user confirmation',
          timestamp: r.GeneratedAt ? new Date(r.GeneratedAt).toISOString() : new Date().toISOString()
        });
      }
    });

    const summary = {
      total: activeNotifications.length,
      open: activeNotifications.filter(n => n.status !== 'Closed').length,
      closed: activeNotifications.filter(n => n.status === 'Closed').length,
      reorder: activeNotifications.filter(n => n.type === 'reorder' && n.status !== 'Closed').length,
      shortfall: activeNotifications.filter(n => n.type === 'shortfall' && n.status !== 'Closed').length,
      dispatchReady: activeNotifications.filter(n => n.type === 'dispatch_ready' && n.status !== 'Closed').length,
      receivables: activeNotifications.filter(n => n.type === 'receivable_overdue' && n.status !== 'Closed').length,
      payables: activeNotifications.filter(n => n.type === 'payable_overdue' && n.status !== 'Closed').length,
      overduePod: activeNotifications.filter(n => n.type === 'overdue_pod' && n.status !== 'Closed').length,
      tasks: activeNotifications.filter(n => n.type === 'task_notification' && n.status !== 'Closed').length,
      crm: activeNotifications.filter(n => ['crm_overdue', 'crm_today', 'crm_no_action', 'crm_stuck'].includes(n.type) && n.status !== 'Closed').length,
      critical: activeNotifications.filter(n => n.severity === 'critical' && n.status !== 'Closed').length,
      warning: activeNotifications.filter(n => n.severity === 'warning' && n.status !== 'Closed').length,
      success: activeNotifications.filter(n => n.severity === 'success' && n.status !== 'Closed').length
    };

    res.status(200).json({
      notifications: activeNotifications,
      summary
    });
  } catch (error) {
    console.error('Error fetching dashboard notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/dashboard/notifications/:id/close
exports.closeNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { closedBy, closedReason, type, title, message } = req.body || {};
    const currentUser = req.headers['x-username'] || closedBy || 'User';
    const pool = await connectDB();

    if (id && id.startsWith('task_notif_')) {
      const realNotifId = parseInt(id.replace('task_notif_', ''), 10);
      if (!isNaN(realNotifId)) {
        await pool.request()
          .input('NotifId', realNotifId)
          .input('ClosedBy', currentUser)
          .query(`
            UPDATE TaskNotifications 
            SET Status = 'Closed', ClosedAt = GETDATE(), ClosedBy = @ClosedBy 
            WHERE NotificationId = @NotifId
          `);
      }
    }

    const checkRes = await pool.request()
      .input('NotificationId', id)
      .query('SELECT 1 FROM NotificationLogStatus WHERE NotificationId = @NotificationId');

    if (checkRes.recordset && checkRes.recordset.length > 0) {
      await pool.request()
        .input('NotificationId', id)
        .input('ClosedBy', currentUser)
        .input('ClosedReason', closedReason || 'Closed by user confirmation')
        .query(`
          UPDATE NotificationLogStatus
          SET Status = 'Closed',
              ClosedAt = CURRENT_TIMESTAMP,
              ClosedBy = @ClosedBy,
              ClosedReason = @ClosedReason,
              UpdatedAt = CURRENT_TIMESTAMP
          WHERE NotificationId = @NotificationId
        `);
    } else {
      await pool.request()
        .input('NotificationId', id)
        .input('NotificationType', type || null)
        .input('Title', title ? String(title).slice(0, 255) : null)
        .input('Message', message ? String(message).slice(0, 1000) : null)
        .input('ClosedBy', currentUser)
        .input('ClosedReason', closedReason || 'Closed by user confirmation')
        .query(`
          INSERT INTO NotificationLogStatus (NotificationId, NotificationType, Title, Message, Status, GeneratedAt, ClosedAt, ClosedBy, ClosedReason, UpdatedAt)
          VALUES (@NotificationId, @NotificationType, @Title, @Message, 'Closed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, @ClosedBy, @ClosedReason, CURRENT_TIMESTAMP)
        `);
    }

    return res.status(200).json({ success: true, message: 'Notification closed successfully' });
  } catch (error) {
    console.error('Error closing notification:', error);
    return res.status(500).json({ message: 'Server error while closing notification' });
  }
};

// POST /api/dashboard/notifications/:id/reopen
exports.reopenNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await connectDB();
    await pool.request()
      .input('NotificationId', id)
      .query(`
        UPDATE NotificationLogStatus
        SET Status = 'Open', ClosedAt = NULL, ClosedBy = NULL, UpdatedAt = GETDATE()
        WHERE NotificationId = @NotificationId
      `);
    return res.status(200).json({ success: true, message: 'Notification reopened successfully' });
  } catch (error) {
    console.error('Error reopening notification:', error);
    return res.status(500).json({ message: 'Server error while reopening notification' });
  }
};

// DELETE /api/dashboard/notifications/:id or POST /api/dashboard/notifications/:id/delete
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, title, message } = req.body || {};
    const currentUser = req.headers['x-username'] || 'User';
    const pool = await connectDB();

    if (id && id.startsWith('task_notif_')) {
      const realNotifId = parseInt(id.replace('task_notif_', ''), 10);
      if (!isNaN(realNotifId)) {
        await pool.request()
          .input('NotifId', realNotifId)
          .query(`DELETE FROM TaskNotifications WHERE NotificationId = @NotifId`);
      }
    }

    const checkRes = await pool.request()
      .input('NotificationId', id)
      .query('SELECT 1 FROM NotificationLogStatus WHERE NotificationId = @NotificationId');

    if (checkRes.recordset && checkRes.recordset.length > 0) {
      await pool.request()
        .input('NotificationId', id)
        .input('ClosedBy', currentUser)
        .input('ClosedReason', 'Deleted by user')
        .query(`
          UPDATE NotificationLogStatus
          SET Status = 'Deleted',
              ClosedAt = CURRENT_TIMESTAMP,
              ClosedBy = @ClosedBy,
              ClosedReason = @ClosedReason,
              UpdatedAt = CURRENT_TIMESTAMP
          WHERE NotificationId = @NotificationId
        `);
    } else {
      await pool.request()
        .input('NotificationId', id)
        .input('NotificationType', type || null)
        .input('Title', title ? String(title).slice(0, 255) : null)
        .input('Message', message ? String(message).slice(0, 1000) : null)
        .input('ClosedBy', currentUser)
        .query(`
          INSERT INTO NotificationLogStatus (NotificationId, NotificationType, Title, Message, Status, GeneratedAt, ClosedAt, ClosedBy, ClosedReason, UpdatedAt)
          VALUES (@NotificationId, @NotificationType, @Title, @Message, 'Deleted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, @ClosedBy, 'Deleted by user', CURRENT_TIMESTAMP)
        `);
    }

    return res.status(200).json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ message: 'Server error while deleting notification' });
  }
};

// POST /api/dashboard/notifications/delete-all
exports.deleteAllNotifications = async (req, res) => {
  try {
    const { ids, scope } = req.body || {};
    const currentUser = req.headers['x-username'] || 'User';
    const pool = await connectDB();

    if (Array.isArray(ids) && ids.length > 0) {
      // Mark specific array of IDs as Deleted
      for (const id of ids) {
        if (id && id.startsWith('task_notif_')) {
          const realNotifId = parseInt(id.replace('task_notif_', ''), 10);
          if (!isNaN(realNotifId)) {
            await pool.request()
              .input('NotifId', realNotifId)
              .query(`DELETE FROM TaskNotifications WHERE NotificationId = @NotifId`);
          }
        }

        const checkRes = await pool.request()
          .input('NotificationId', id)
          .query('SELECT 1 FROM NotificationLogStatus WHERE NotificationId = @NotificationId');

        if (checkRes.recordset && checkRes.recordset.length > 0) {
          await pool.request()
            .input('NotificationId', id)
            .input('ClosedBy', currentUser)
            .query(`
              UPDATE NotificationLogStatus
              SET Status = 'Deleted', ClosedAt = CURRENT_TIMESTAMP, ClosedBy = @ClosedBy, ClosedReason = 'Deleted by user (bulk)', UpdatedAt = CURRENT_TIMESTAMP
              WHERE NotificationId = @NotificationId
            `);
        } else {
          await pool.request()
            .input('NotificationId', id)
            .input('ClosedBy', currentUser)
            .query(`
              INSERT INTO NotificationLogStatus (NotificationId, Status, GeneratedAt, ClosedAt, ClosedBy, ClosedReason, UpdatedAt)
              VALUES (@NotificationId, 'Deleted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, @ClosedBy, 'Deleted by user (bulk)', CURRENT_TIMESTAMP)
            `);
        }
      }

      return res.status(200).json({
        success: true,
        count: ids.length,
        message: `Successfully deleted ${ids.length} notifications.`
      });
    }

    if (scope === 'all') {
      // Mark all existing NotificationLogStatus as Deleted
      await pool.request()
        .input('ClosedBy', currentUser)
        .query(`
          UPDATE NotificationLogStatus
          SET Status = 'Deleted', ClosedAt = GETDATE(), ClosedBy = @ClosedBy, ClosedReason = 'Deleted all notifications', UpdatedAt = GETDATE()
        `);

      await pool.request().query(`DELETE FROM TaskNotifications`);

      return res.status(200).json({
        success: true,
        message: 'All notifications have been cleared and deleted.'
      });
    }

    return res.status(400).json({ message: 'Please specify notification IDs or scope' });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    return res.status(500).json({ message: 'Server error while deleting all notifications' });
  }
};
