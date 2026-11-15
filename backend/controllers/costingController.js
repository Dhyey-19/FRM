const { connectDB, sql } = require('../config/db');
const { DEFAULT_CONFIG, calculateCostingMatrix } = require('../utils/itemCostingEngine');

/**
 * GET /api/costing/config
 * Retrieves saved costing rates and computes the full calculation matrix.
 */
exports.getConfig = async (req, res) => {
  try {
    const pool = await connectDB();
    let configRow = null;

    try {
      const result = await pool.request()
        .input('ConfigKey', sql.NVarChar(50), 'DEFAULT')
        .query('SELECT TOP 1 * FROM [ItemCostingConfig] WHERE [ConfigKey] = @ConfigKey');

      if (result.recordset && result.recordset.length > 0) {
        configRow = result.recordset[0];
      }
    } catch (dbErr) {
      console.warn('[Costing] Notice reading ItemCostingConfig table:', dbErr.message);
    }

    const effectiveConfig = configRow || DEFAULT_CONFIG;
    const matrix = calculateCostingMatrix(effectiveConfig);

    res.status(200).json({
      success: true,
      config: effectiveConfig,
      derived: matrix.derived,
      series: matrix.series
    });
  } catch (error) {
    console.error('Error fetching costing config:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving costing configuration' });
  }
};

/**
 * POST /api/costing/config
 * Updates the user-defined rates (red inputs) and margins in the database.
 */
exports.saveConfig = async (req, res) => {
  try {
    const pool = await connectDB();
    const data = req.body || {};

    const pipeRate = Number(data.PipeRatePerMeter ?? DEFAULT_CONFIG.PipeRatePerMeter);
    const brassRate = Number(data.BrassRatePerKg ?? DEFAULT_CONFIG.BrassRatePerKg);
    const hcpPipeRate = Number(data.HcpPipeRatePerMeter ?? DEFAULT_CONFIG.HcpPipeRatePerMeter);

    const nylonInsert = Number(data.NylonInsertRate ?? DEFAULT_CONFIG.NylonInsertRate);
    const nylonNut = Number(data.NylonNutRate ?? DEFAULT_CONFIG.NylonNutRate);
    const ss201Nut = Number(data.SS201NutRate ?? DEFAULT_CONFIG.SS201NutRate);
    const ss304Nut = Number(data.SS304NutRate ?? DEFAULT_CONFIG.SS304NutRate);
    const ssInner = Number(data.SSInnerRate ?? DEFAULT_CONFIG.SSInnerRate);

    const brassInsertConv = Number(data.BrassInsertConv ?? DEFAULT_CONFIG.BrassInsertConv);
    const brassInsertWt = Number(data.BrassInsertWeight ?? DEFAULT_CONFIG.BrassInsertWeight);
    const brassNutNConv = Number(data.BrassNutNConv ?? DEFAULT_CONFIG.BrassNutNConv);
    const brassNutNWt = Number(data.BrassNutNWeight ?? DEFAULT_CONFIG.BrassNutNWeight);
    const brassNutPCConv = Number(data.BrassNutPCConv ?? DEFAULT_CONFIG.BrassNutPCConv);
    const brassNutPCWt = Number(data.BrassNutPCWeight ?? DEFAULT_CONFIG.BrassNutPCWeight);

    const capRate = Number(data.CapRate ?? DEFAULT_CONFIG.CapRate);
    const keyRate = Number(data.KeyRate ?? DEFAULT_CONFIG.KeyRate);
    const washerRate = Number(data.WasherRate ?? DEFAULT_CONFIG.WasherRate);
    const labourRate = Number(data.LabourRate ?? DEFAULT_CONFIG.LabourRate);
    const packingRate = Number(data.PackingRate ?? DEFAULT_CONFIG.PackingRate);

    let marginsJson = null;
    if (data.MarginsJson) {
      marginsJson = typeof data.MarginsJson === 'string' ? data.MarginsJson : JSON.stringify(data.MarginsJson);
    }

    await pool.request()
      .input('ConfigKey', sql.NVarChar(50), 'DEFAULT')
      .input('PipeRatePerMeter', sql.Decimal(12, 4), pipeRate)
      .input('BrassRatePerKg', sql.Decimal(12, 4), brassRate)
      .input('HcpPipeRatePerMeter', sql.Decimal(12, 4), hcpPipeRate)
      .input('NylonInsertRate', sql.Decimal(12, 4), nylonInsert)
      .input('NylonNutRate', sql.Decimal(12, 4), nylonNut)
      .input('SS201NutRate', sql.Decimal(12, 4), ss201Nut)
      .input('SS304NutRate', sql.Decimal(12, 4), ss304Nut)
      .input('SSInnerRate', sql.Decimal(12, 4), ssInner)
      .input('BrassInsertConv', sql.Decimal(12, 4), brassInsertConv)
      .input('BrassInsertWeight', sql.Decimal(12, 4), brassInsertWt)
      .input('BrassNutNConv', sql.Decimal(12, 4), brassNutNConv)
      .input('BrassNutNWeight', sql.Decimal(12, 4), brassNutNWt)
      .input('BrassNutPCConv', sql.Decimal(12, 4), brassNutPCConv)
      .input('BrassNutPCWeight', sql.Decimal(12, 4), brassNutPCWt)
      .input('CapRate', sql.Decimal(12, 4), capRate)
      .input('KeyRate', sql.Decimal(12, 4), keyRate)
      .input('WasherRate', sql.Decimal(12, 4), washerRate)
      .input('LabourRate', sql.Decimal(12, 4), labourRate)
      .input('PackingRate', sql.Decimal(12, 4), packingRate)
      .input('MarginsJson', sql.NVarChar(sql.MAX), marginsJson)
      .query(`
        IF EXISTS (SELECT 1 FROM [ItemCostingConfig] WHERE [ConfigKey] = @ConfigKey)
        BEGIN
          UPDATE [ItemCostingConfig] SET
            [PipeRatePerMeter] = @PipeRatePerMeter,
            [BrassRatePerKg] = @BrassRatePerKg,
            [HcpPipeRatePerMeter] = @HcpPipeRatePerMeter,
            [NylonInsertRate] = @NylonInsertRate,
            [NylonNutRate] = @NylonNutRate,
            [SS201NutRate] = @SS201NutRate,
            [SS304NutRate] = @SS304NutRate,
            [SSInnerRate] = @SSInnerRate,
            [BrassInsertConv] = @BrassInsertConv,
            [BrassInsertWeight] = @BrassInsertWeight,
            [BrassNutNConv] = @BrassNutNConv,
            [BrassNutNWeight] = @BrassNutNWeight,
            [BrassNutPCConv] = @BrassNutPCConv,
            [BrassNutPCWeight] = @BrassNutPCWeight,
            [CapRate] = @CapRate,
            [KeyRate] = @KeyRate,
            [WasherRate] = @WasherRate,
            [LabourRate] = @LabourRate,
            [PackingRate] = @PackingRate,
            [MarginsJson] = @MarginsJson,
            [UpdatedAt] = GETDATE()
          WHERE [ConfigKey] = @ConfigKey;
        END
        ELSE
        BEGIN
          INSERT INTO [ItemCostingConfig] (
            [ConfigKey], [PipeRatePerMeter], [BrassRatePerKg], [HcpPipeRatePerMeter],
            [NylonInsertRate], [NylonNutRate], [SS201NutRate], [SS304NutRate], [SSInnerRate],
            [BrassInsertConv], [BrassInsertWeight], [BrassNutNConv], [BrassNutNWeight],
            [BrassNutPCConv], [BrassNutPCWeight], [CapRate], [KeyRate], [WasherRate],
            [LabourRate], [PackingRate], [MarginsJson]
          ) VALUES (
            @ConfigKey, @PipeRatePerMeter, @BrassRatePerKg, @HcpPipeRatePerMeter,
            @NylonInsertRate, @NylonNutRate, @SS201NutRate, @SS304NutRate, @SSInnerRate,
            @BrassInsertConv, @BrassInsertWeight, @BrassNutNConv, @BrassNutNWeight,
            @BrassNutPCConv, @BrassNutPCWeight, @CapRate, @KeyRate, @WasherRate,
            @LabourRate, @PackingRate, @MarginsJson
          );
        END
      `);

    const matrix = calculateCostingMatrix({
      PipeRatePerMeter: pipeRate,
      BrassRatePerKg: brassRate,
      HcpPipeRatePerMeter: hcpPipeRate,
      NylonInsertRate: nylonInsert,
      NylonNutRate: nylonNut,
      SS201NutRate: ss201Nut,
      SS304NutRate: ss304Nut,
      SSInnerRate: ssInner,
      BrassInsertConv: brassInsertConv,
      BrassInsertWeight: brassInsertWt,
      BrassNutNConv: brassNutNConv,
      BrassNutNWeight: brassNutNWt,
      BrassNutPCConv: brassNutPCConv,
      BrassNutPCWeight: brassNutPCWt,
      CapRate: capRate,
      KeyRate: keyRate,
      WasherRate: washerRate,
      LabourRate: labourRate,
      PackingRate: packingRate,
      MarginsJson: marginsJson
    });

    res.status(200).json({
      success: true,
      message: 'Costing rates saved successfully',
      derived: matrix.derived,
      series: matrix.series
    });
  } catch (error) {
    console.error('Error saving costing config:', error);
    res.status(500).json({ success: false, message: 'Server error saving costing configuration' });
  }
};

/**
 * POST /api/costing/apply-to-item-master
 * Applies calculated Costing and Sale Price (MRP) to ItemMaster for selected or all items.
 */
exports.applyToItemMaster = async (req, res) => {
  try {
    const pool = await connectDB();
    const { itemsToSync, createMissing = false } = req.body;

    // Fetch existing items
    const existingItemsRes = await pool.request().query('SELECT ItemCode, SubCode, ItemName, Series, Costing, MRP FROM [ItemMaster]');
    const existingList = existingItemsRes.recordset || [];

    let updatedCount = 0;
    let createdCount = 0;

    for (const item of itemsToSync || []) {
      const seriesKey = String(item.seriesKey || item.seriesCode || '');
      const seriesName = item.seriesName || `${seriesKey} Series`;
      const size = String(item.size || '');
      const costing = Math.round((Number(item.totalCost) || 0) * 100) / 100;
      const mrp = Math.round((Number(item.salePrice) || costing) * 100) / 100;

      // Find match in existing items:
      // Match by exact ItemCode if provided, or matching Series + size in ItemName/ItemCode
      let matched = existingList.find(e => 
        (item.itemCode && e.ItemCode === item.itemCode && (!item.subCode || e.SubCode === item.subCode)) ||
        (e.Series && (e.Series.includes(seriesKey) || seriesName.includes(e.Series)) && e.ItemName && e.ItemName.includes(size)) ||
        (e.ItemCode && e.ItemCode.includes(seriesKey) && e.ItemCode.includes(size.replace(/"/g, '')))
      );

      if (matched) {
        await pool.request()
          .input('ItemCode', sql.NVarChar(50), matched.ItemCode)
          .input('SubCode', sql.NVarChar(50), matched.SubCode || '')
          .input('Costing', sql.Decimal(15, 2), costing)
          .input('MRP', sql.Decimal(15, 2), mrp)
          .query(`
            UPDATE [ItemMaster]
            SET [Costing] = @Costing, [MRP] = @MRP
            WHERE [ItemCode] = @ItemCode AND [SubCode] = @SubCode
          `);
        updatedCount++;
      } else if (createMissing) {
        const newItemCode = `ITM-${seriesKey}-${size.replace(/"/g, '')}`;
        const newItemName = `${seriesKey} Series ${size}`;

        await pool.request()
          .input('ItemCode', sql.NVarChar(50), newItemCode)
          .input('SubCode', sql.NVarChar(50), '')
          .input('ItemName', sql.NVarChar(100), newItemName)
          .input('ItemType', sql.NVarChar(50), 'FG')
          .input('Category', sql.NVarChar(50), 'Inhouse')
          .input('Series', sql.NVarChar(50), `${seriesKey} Series`)
          .input('Unit', sql.NVarChar(20), 'PCS')
          .input('Costing', sql.Decimal(15, 2), costing)
          .input('MRP', sql.Decimal(15, 2), mrp)
          .query(`
            INSERT INTO [ItemMaster] (
              [ItemCode], [SubCode], [ItemName], [ItemType], [Category], [Series], [Unit], [Costing], [MRP], [OpeningStock], [ClosingStock]
            ) VALUES (
              @ItemCode, @SubCode, @ItemName, @ItemType, @Category, @Series, @Unit, @Costing, @MRP, 0, 0
            )
          `);
        createdCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Costing synced: ${updatedCount} item(s) updated${createdCount > 0 ? `, ${createdCount} created` : ''}.`,
      updatedCount,
      createdCount
    });
  } catch (error) {
    console.error('Error applying costing to ItemMaster:', error);
    res.status(500).json({ success: false, message: 'Server error applying costing to Item Master: ' + error.message });
  }
};
