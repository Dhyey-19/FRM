const { connectDB, sql } = require('../config/db');

// Helper to compute Auto Status matching SALES for ERP formula
// Formula: IF(Stage=="", "", IF(Stage=="Won", "✅ WON", IF(Stage=="Lost", "❌ LOST", IF(NextAction=="" || FollowUpDate=="", "⚪ NO NEXT ACTION", IF(FollowUpDate<Today, "🔴 OVERDUE", IF(FollowUpDate==Today, "🟠 DUE TODAY", IF(DateAdded < Today - 21 days, "🟣 STUCK", "🟢 ON TRACK")))))))
const computeStatus = (stage, nextAction, followUpDate, dateAdded, todayStr) => {
  if (!stage) return '';
  const s = String(stage).trim();
  if (s.toLowerCase() === 'won') return '✅ WON';
  if (s.toLowerCase() === 'lost') return '❌ LOST';

  const na = (nextAction || '').trim();
  const fu = followUpDate ? followUpDate.split('T')[0] : '';
  if (!na || !fu) return '⚪ NO NEXT ACTION';

  if (fu < todayStr) return '🔴 OVERDUE';
  if (fu === todayStr) return '🟠 DUE TODAY';

  if (dateAdded) {
    const da = dateAdded.split('T')[0];
    const diffDays = Math.floor((new Date(todayStr) - new Date(da)) / (1000 * 60 * 60 * 24));
    if (diffDays > 21) return '🟣 STUCK';
  }

  return '🟢 ON TRACK';
};

const computeQuoted = (stage, dealValue, ourPrice) => {
  const s = String(stage || '').trim().toLowerCase();
  if (['quotation', 'negotiation', 'won'].includes(s) || (parseFloat(dealValue) > 0) || (parseFloat(ourPrice) > 0)) {
    return 'Yes';
  }
  return 'No';
};

// GET /api/crm/leads
exports.getLeads = async (req, res) => {
  try {
    const pool = await connectDB();
    const todayStr = new Date().toISOString().split('T')[0];

    const result = await pool.request().query(`
      SELECT 
        l.LeadID,
        CONVERT(VARCHAR(10), l.DateAdded, 120) AS DateAdded,
        l.Customer,
        ISNULL(l.Country, 'India') AS Country,
        ISNULL(l.Contact, '') AS Contact,
        ISNULL(l.ProductRequirement, '') AS ProductRequirement,
        ISNULL(l.ItemCode, '') AS ItemCode,
        im.ItemName,
        l.Stage,
        ISNULL(l.NextAction, '') AS NextAction,
        CONVERT(VARCHAR(10), l.FollowUpDate, 120) AS FollowUpDate,
        ISNULL(l.DealValue, 0) AS DealValue,
        ISNULL(l.Remarks, '') AS Remarks,
        ISNULL(l.Source, '') AS Source,
        l.QtyAsked,
        l.OurPrice,
        l.TargetPrice,
        ISNULL(l.BuyerType, '') AS BuyerType,
        ISNULL(l.CanWeMake, '') AS CanWeMake,
        ISNULL(l.LostReason, '') AS LostReason,
        l.CreatedBy,
        l.UpdatedBy,
        l.CreatedAt,
        l.UpdatedAt
      FROM CRM_Leads l
      LEFT JOIN ItemMaster im ON l.ItemCode = im.ItemCode
      ORDER BY l.DateAdded DESC, l.LeadID DESC
    `);

    const mapped = result.recordset.map(r => ({
      ...r,
      Status: computeStatus(r.Stage, r.NextAction, r.FollowUpDate, r.DateAdded, todayStr),
      Quoted: computeQuoted(r.Stage, r.DealValue, r.OurPrice)
    }));

    res.status(200).json(mapped);
  } catch (error) {
    console.error('Error fetching CRM leads:', error);
    res.status(500).json({ message: 'Server error fetching leads', error: error.message });
  }
};

// GET /api/crm/leads/:id
exports.getLeadById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await connectDB();
    const todayStr = new Date().toISOString().split('T')[0];

    const result = await pool.request()
      .input('LeadID', sql.Int, id)
      .query(`
        SELECT 
          l.LeadID,
          CONVERT(VARCHAR(10), l.DateAdded, 120) AS DateAdded,
          l.Customer,
          ISNULL(l.Country, 'India') AS Country,
          ISNULL(l.Contact, '') AS Contact,
          ISNULL(l.ProductRequirement, '') AS ProductRequirement,
          ISNULL(l.ItemCode, '') AS ItemCode,
          im.ItemName,
          l.Stage,
          ISNULL(l.NextAction, '') AS NextAction,
          CONVERT(VARCHAR(10), l.FollowUpDate, 120) AS FollowUpDate,
          ISNULL(l.DealValue, 0) AS DealValue,
          ISNULL(l.Remarks, '') AS Remarks,
          ISNULL(l.Source, '') AS Source,
          l.QtyAsked,
          l.OurPrice,
          l.TargetPrice,
          ISNULL(l.BuyerType, '') AS BuyerType,
          ISNULL(l.CanWeMake, '') AS CanWeMake,
          ISNULL(l.LostReason, '') AS LostReason,
          l.CreatedBy,
          l.UpdatedBy,
          l.CreatedAt,
          l.UpdatedAt
        FROM CRM_Leads l
        LEFT JOIN ItemMaster im ON l.ItemCode = im.ItemCode
        WHERE l.LeadID = @LeadID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const r = result.recordset[0];
    const item = {
      ...r,
      Status: computeStatus(r.Stage, r.NextAction, r.FollowUpDate, r.DateAdded, todayStr),
      Quoted: computeQuoted(r.Stage, r.DealValue, r.OurPrice)
    };

    res.status(200).json(item);
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST /api/crm/leads
exports.createLead = async (req, res) => {
  try {
    const {
      DateAdded, Customer, Country, Contact, ProductRequirement, ItemCode,
      Stage, NextAction, FollowUpDate, DealValue, Remarks, Source,
      QtyAsked, OurPrice, TargetPrice, BuyerType, CanWeMake, LostReason,
      CreatedBy
    } = req.body;

    if (!Customer || !String(Customer).trim()) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    const pool = await connectDB();
    const result = await pool.request()
      .input('DateAdded', sql.Date, DateAdded || new Date())
      .input('Customer', sql.NVarChar(200), String(Customer).trim())
      .input('Country', sql.NVarChar(100), Country ? String(Country).trim() : 'India')
      .input('Contact', sql.NVarChar(200), Contact ? String(Contact).trim() : null)
      .input('ProductRequirement', sql.NVarChar(500), ProductRequirement ? String(ProductRequirement).trim() : null)
      .input('ItemCode', sql.VarChar(50), ItemCode ? String(ItemCode).trim() : null)
      .input('Stage', sql.NVarChar(50), Stage ? String(Stage).trim() : 'New')
      .input('NextAction', sql.NVarChar(200), NextAction ? String(NextAction).trim() : null)
      .input('FollowUpDate', sql.Date, FollowUpDate || null)
      .input('DealValue', sql.Numeric(15, 2), parseFloat(DealValue) || 0)
      .input('Remarks', sql.NVarChar(sql.MAX), Remarks ? String(Remarks).trim() : null)
      .input('Source', sql.NVarChar(100), Source ? String(Source).trim() : null)
      .input('QtyAsked', sql.Numeric(15, 2), parseFloat(QtyAsked) || null)
      .input('OurPrice', sql.Numeric(15, 2), parseFloat(OurPrice) || null)
      .input('TargetPrice', sql.Numeric(15, 2), parseFloat(TargetPrice) || null)
      .input('BuyerType', sql.NVarChar(100), BuyerType ? String(BuyerType).trim() : null)
      .input('CanWeMake', sql.NVarChar(100), CanWeMake ? String(CanWeMake).trim() : null)
      .input('LostReason', sql.NVarChar(250), LostReason ? String(LostReason).trim() : null)
      .input('CreatedBy', sql.NVarChar(100), CreatedBy || 'Admin')
      .query(`
        INSERT INTO CRM_Leads 
        (DateAdded, Customer, Country, Contact, ProductRequirement, ItemCode, Stage, NextAction, FollowUpDate, DealValue, Remarks, Source, QtyAsked, OurPrice, TargetPrice, BuyerType, CanWeMake, LostReason, CreatedBy, UpdatedBy)
        OUTPUT INSERTED.LeadID
        VALUES 
        (@DateAdded, @Customer, @Country, @Contact, @ProductRequirement, @ItemCode, @Stage, @NextAction, @FollowUpDate, @DealValue, @Remarks, @Source, @QtyAsked, @OurPrice, @TargetPrice, @BuyerType, @CanWeMake, @LostReason, @CreatedBy, @CreatedBy)
      `);

    res.status(201).json({
      message: 'Inquiry / Lead created successfully',
      LeadID: result.recordset[0].LeadID
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ message: 'Server error creating lead', error: error.message });
  }
};

// PUT /api/crm/leads/:id
exports.updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      DateAdded, Customer, Country, Contact, ProductRequirement, ItemCode,
      Stage, NextAction, FollowUpDate, DealValue, Remarks, Source,
      QtyAsked, OurPrice, TargetPrice, BuyerType, CanWeMake, LostReason,
      UpdatedBy
    } = req.body;

    if (!Customer || !String(Customer).trim()) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    const pool = await connectDB();
    const result = await pool.request()
      .input('LeadID', sql.Int, id)
      .input('DateAdded', sql.Date, DateAdded || new Date())
      .input('Customer', sql.NVarChar(200), String(Customer).trim())
      .input('Country', sql.NVarChar(100), Country ? String(Country).trim() : 'India')
      .input('Contact', sql.NVarChar(200), Contact ? String(Contact).trim() : null)
      .input('ProductRequirement', sql.NVarChar(500), ProductRequirement ? String(ProductRequirement).trim() : null)
      .input('ItemCode', sql.VarChar(50), ItemCode ? String(ItemCode).trim() : null)
      .input('Stage', sql.NVarChar(50), Stage ? String(Stage).trim() : 'New')
      .input('NextAction', sql.NVarChar(200), NextAction ? String(NextAction).trim() : null)
      .input('FollowUpDate', sql.Date, FollowUpDate || null)
      .input('DealValue', sql.Numeric(15, 2), parseFloat(DealValue) || 0)
      .input('Remarks', sql.NVarChar(sql.MAX), Remarks ? String(Remarks).trim() : null)
      .input('Source', sql.NVarChar(100), Source ? String(Source).trim() : null)
      .input('QtyAsked', sql.Numeric(15, 2), parseFloat(QtyAsked) || null)
      .input('OurPrice', sql.Numeric(15, 2), parseFloat(OurPrice) || null)
      .input('TargetPrice', sql.Numeric(15, 2), parseFloat(TargetPrice) || null)
      .input('BuyerType', sql.NVarChar(100), BuyerType ? String(BuyerType).trim() : null)
      .input('CanWeMake', sql.NVarChar(100), CanWeMake ? String(CanWeMake).trim() : null)
      .input('LostReason', sql.NVarChar(250), LostReason ? String(LostReason).trim() : null)
      .input('UpdatedBy', sql.NVarChar(100), UpdatedBy || 'Admin')
      .query(`
        UPDATE CRM_Leads SET
          DateAdded = @DateAdded,
          Customer = @Customer,
          Country = @Country,
          Contact = @Contact,
          ProductRequirement = @ProductRequirement,
          ItemCode = @ItemCode,
          Stage = @Stage,
          NextAction = @NextAction,
          FollowUpDate = @FollowUpDate,
          DealValue = @DealValue,
          Remarks = @Remarks,
          Source = @Source,
          QtyAsked = @QtyAsked,
          OurPrice = @OurPrice,
          TargetPrice = @TargetPrice,
          BuyerType = @BuyerType,
          CanWeMake = @CanWeMake,
          LostReason = @LostReason,
          UpdatedBy = @UpdatedBy,
          UpdatedAt = GETDATE()
        WHERE LeadID = @LeadID
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.status(200).json({ message: 'Lead updated successfully' });
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ message: 'Server error updating lead', error: error.message });
  }
};

// DELETE /api/crm/leads/:id
exports.deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await connectDB();
    const result = await pool.request()
      .input('LeadID', sql.Int, id)
      .query('DELETE FROM CRM_Leads WHERE LeadID = @LeadID');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.status(200).json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ message: 'Server error deleting lead', error: error.message });
  }
};

// GET /api/crm/dashboard
exports.getSalesDashboard = async (req, res) => {
  try {
    const pool = await connectDB();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Week start: Monday of current week
    const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon
    const diffToMon = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + diffToMon);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Month start: 1st of current month
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const result = await pool.request().query(`
      SELECT 
        LeadID,
        CONVERT(VARCHAR(10), DateAdded, 120) AS DateAdded,
        Customer,
        Stage,
        ISNULL(NextAction, '') AS NextAction,
        CONVERT(VARCHAR(10), FollowUpDate, 120) AS FollowUpDate,
        ISNULL(DealValue, 0) AS DealValue,
        ISNULL(OurPrice, 0) AS OurPrice
      FROM CRM_Leads
    `);

    const leads = result.recordset.map(r => ({
      ...r,
      Status: computeStatus(r.Stage, r.NextAction, r.FollowUpDate, r.DateAdded, todayStr),
      Quoted: computeQuoted(r.Stage, r.DealValue, r.OurPrice)
    }));

    // RIGHT NOW (Live actionable metrics)
    const openLeads = leads.filter(l => l.Stage !== 'Won' && l.Stage !== 'Lost');
    const currentOpenPipeline = openLeads.length;
    const overdueFollowups = openLeads.filter(l => l.FollowUpDate && l.FollowUpDate < todayStr).length;
    const dueToday = openLeads.filter(l => l.FollowUpDate && l.FollowUpDate === todayStr).length;
    const missingNextAction = openLeads.filter(l => !l.NextAction || !l.FollowUpDate).length;

    // Helper to calculate cohort metrics for a period
    const calcPeriodMetrics = (startDateStr) => {
      // Opening inquiries: active (not Won/Lost) inquiries added BEFORE the period start
      const openingInquiries = leads.filter(l => l.DateAdded < startDateStr && l.Stage !== 'Won' && l.Stage !== 'Lost').length;
      
      // Leads added within the period [startDate, today]
      const periodLeads = leads.filter(l => l.DateAdded >= startDateStr && l.DateAdded <= todayStr);
      const newInquiries = periodLeads.length;
      const qualified = periodLeads.filter(l => l.Stage === 'Qualified').length;
      const sample = periodLeads.filter(l => l.Stage === 'Sample').length;
      const quotationsSent = periodLeads.filter(l => l.Quoted === 'Yes').length;
      const negotiation = periodLeads.filter(l => l.Stage === 'Negotiation').length;
      const inquiriesWon = periodLeads.filter(l => l.Stage === 'Won').length;
      const inquiriesLost = periodLeads.filter(l => l.Stage === 'Lost').length;

      // Activity
      const newLeadsAdded = newInquiries;
      const customersContacted = periodLeads.filter(l => l.Stage !== 'New').length;
      const quotationsSentCohort = quotationsSent;
      const followupsPendingLive = currentOpenPipeline;
      const overdueFollowupsLive = overdueFollowups;

      // Results
      const ordersWon = inquiriesWon;
      const salesValue = periodLeads.filter(l => l.Stage === 'Won').reduce((sum, l) => sum + (parseFloat(l.DealValue) || 0), 0);
      const aov = ordersWon > 0 ? Math.round(salesValue / ordersWon) : 0;
      const winRate = (inquiriesWon + inquiriesLost) > 0 ? (inquiriesWon / (inquiriesWon + inquiriesLost)) : (ordersWon > 0 ? 1 : 0);
      const quoteToOrder = quotationsSent > 0 ? (ordersWon / quotationsSent) : 0;
      const inquiryToOrder = newInquiries > 0 ? (ordersWon / newInquiries) : 0;

      return {
        funnel: {
          openingInquiries,
          newInquiries,
          qualified,
          sample,
          quotationsSent,
          negotiation,
          inquiriesWon,
          inquiriesLost,
          currentOpenInquiries: currentOpenPipeline
        },
        activity: {
          newLeadsAdded,
          customersContacted,
          quotationsSent: quotationsSentCohort,
          followupsPending: followupsPendingLive,
          overdueFollowups: overdueFollowupsLive
        },
        results: {
          ordersWon,
          salesValue,
          averageOrderValue: aov,
          winRate,
          quoteToOrderConversion: quoteToOrder,
          inquiryToOrderConversion: inquiryToOrder
        }
      };
    };

    const todayMetrics = calcPeriodMetrics(todayStr);
    const weekMetrics = calcPeriodMetrics(weekStartStr);
    const monthMetrics = calcPeriodMetrics(monthStartStr);

    res.status(200).json({
      anchors: {
        today: todayStr,
        weekStart: weekStartStr,
        monthStart: monthStartStr
      },
      rightNow: {
        currentOpenPipeline,
        overdueFollowups,
        dueToday,
        missingNextAction
      },
      funnel: {
        today: todayMetrics.funnel,
        week: weekMetrics.funnel,
        month: monthMetrics.funnel
      },
      activity: {
        today: todayMetrics.activity,
        week: weekMetrics.activity,
        month: monthMetrics.activity
      },
      results: {
        today: todayMetrics.results,
        week: weekMetrics.results,
        month: monthMetrics.results
      }
    });
  } catch (error) {
    console.error('Error fetching sales dashboard:', error);
    res.status(500).json({ message: 'Server error generating sales dashboard', error: error.message });
  }
};

// POST /api/crm/bulk
exports.bulkCreateLeads = async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Array of lead records is required' });
  }

  let added = 0;
  let skipped = 0;

  try {
    const pool = await connectDB();

    function parseExcelDate(val) {
      if (!val) return null;
      if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return d.toISOString().split('T')[0];
      }
      if (typeof val === 'string') {
        const s = val.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split('T')[0];
        const parsed = new Date(s);
        if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
      }
      return null;
    }

    for (const item of items) {
      const customer = item.Customer || item['Customer Name'] || item['Client'];
      if (!customer || !String(customer).trim()) {
        skipped++;
        continue;
      }

      const dateAdded = parseExcelDate(item.DateAdded || item['Date Added'] || item.Date) || new Date().toISOString().split('T')[0];
      const country = item.Country || item['Country'] || 'India';
      const contact = item.Contact || item['Contact Person'] || null;
      const productReq = item.ProductRequirement || item['Product / Requirement'] || item['Requirement'] || null;
      const itemCode = item.ItemCode || item['Item Code'] || null;
      const stage = item.Stage || item['Stage'] || 'New';
      const nextAction = item.NextAction || item['Next Action'] || null;
      const followUpDate = parseExcelDate(item.FollowUpDate || item['Follow-up Date'] || item['Followup Date']);
      const dealValue = parseFloat(item.DealValue || item['Value (Rs)'] || item['Value'] || item['Deal Value']) || 0;
      const remarks = item.Remarks || item['Remarks'] || null;
      const source = item.Source || item['Source'] || null;
      const qtyAsked = parseFloat(item.QtyAsked || item['Qty Asked'] || item['Quantity']) || null;
      const ourPrice = parseFloat(item.OurPrice || item['Our Price (Rs)'] || item['Our Price']) || null;
      const targetPrice = parseFloat(item.TargetPrice || item['Target Price (Rs)'] || item['Target Price']) || null;
      const buyerType = item.BuyerType || item['Buyer Type'] || null;
      const canWeMake = item.CanWeMake || item['Can We Make?'] || null;
      const lostReason = item.LostReason || item['Lost Reason'] || null;
      const createdBy = item.CreatedBy || 'Import';

      await pool.request()
        .input('DateAdded', sql.Date, dateAdded)
        .input('Customer', sql.NVarChar(200), String(customer).trim())
        .input('Country', sql.NVarChar(100), String(country).trim())
        .input('Contact', sql.NVarChar(200), contact ? String(contact).trim() : null)
        .input('ProductRequirement', sql.NVarChar(500), productReq ? String(productReq).trim() : null)
        .input('ItemCode', sql.VarChar(50), itemCode ? String(itemCode).trim() : null)
        .input('Stage', sql.NVarChar(50), String(stage).trim())
        .input('NextAction', sql.NVarChar(200), nextAction ? String(nextAction).trim() : null)
        .input('FollowUpDate', sql.Date, followUpDate)
        .input('DealValue', sql.Numeric(15, 2), dealValue)
        .input('Remarks', sql.NVarChar(sql.MAX), remarks ? String(remarks).trim() : null)
        .input('Source', sql.NVarChar(100), source ? String(source).trim() : null)
        .input('QtyAsked', sql.Numeric(15, 2), qtyAsked)
        .input('OurPrice', sql.Numeric(15, 2), ourPrice)
        .input('TargetPrice', sql.Numeric(15, 2), targetPrice)
        .input('BuyerType', sql.NVarChar(100), buyerType ? String(buyerType).trim() : null)
        .input('CanWeMake', sql.NVarChar(100), canWeMake ? String(canWeMake).trim() : null)
        .input('LostReason', sql.NVarChar(250), lostReason ? String(lostReason).trim() : null)
        .input('CreatedBy', sql.NVarChar(100), createdBy)
        .query(`
          INSERT INTO CRM_Leads
          (DateAdded, Customer, Country, Contact, ProductRequirement, ItemCode, Stage, NextAction, FollowUpDate, DealValue, Remarks, Source, QtyAsked, OurPrice, TargetPrice, BuyerType, CanWeMake, LostReason, CreatedBy, UpdatedBy)
          VALUES
          (@DateAdded, @Customer, @Country, @Contact, @ProductRequirement, @ItemCode, @Stage, @NextAction, @FollowUpDate, @DealValue, @Remarks, @Source, @QtyAsked, @OurPrice, @TargetPrice, @BuyerType, @CanWeMake, @LostReason, @CreatedBy, @CreatedBy)
        `);
      added++;
    }

    res.status(200).json({
      message: `Successfully processed ${items.length} records. Added: ${added}, Skipped: ${skipped}`,
      added,
      skipped
    });
  } catch (error) {
    console.error('Error bulk creating leads:', error);
    res.status(500).json({ message: 'Server error bulk creating leads', error: error.message });
  }
};
