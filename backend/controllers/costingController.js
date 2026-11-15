const { connectDB, sql } = require('../config/db');
const { DEFAULT_CONFIG, calculateCostingMatrix, SERIES_DEFINITIONS, SIZES } = require('../utils/itemCostingEngine');

/**
 * Synchronizes the calculated costing matrix to ItemMaster and BOM_Master
 */
async function syncCostingToDatabase(pool, matrix, config) {
  // 1. Sync / ensure Raw Material Sub-Items
  const subItems = [
    { code: 'RM-PIPE-STD', name: 'Standard Pipe', type: 'RM', cat: 'BOP', unit: 'MTR', cost: Number(config.PipeRatePerMeter) || DEFAULT_CONFIG.PipeRatePerMeter },
    { code: 'RM-PIPE-HCP', name: 'HCP Pipe', type: 'RM', cat: 'BOP', unit: 'MTR', cost: Number(config.HcpPipeRatePerMeter) || DEFAULT_CONFIG.HcpPipeRatePerMeter },
    { code: 'BOP-CAP', name: 'End Cap', type: 'BOP', cat: 'BOP', unit: 'PCS', cost: Number(config.CapRate) || DEFAULT_CONFIG.CapRate },
    { code: 'BOP-KEY', name: 'Key', type: 'BOP', cat: 'BOP', unit: 'PCS', cost: Number(config.KeyRate) || DEFAULT_CONFIG.KeyRate },
    { code: 'BOP-WSH', name: 'Washer', type: 'BOP', cat: 'BOP', unit: 'PCS', cost: Number(config.WasherRate) || DEFAULT_CONFIG.WasherRate },
    { code: 'SRV-LABOUR', name: 'Assembly Labour Charge', type: 'CONSUMABLE', cat: 'Inhouse', unit: 'PCS', cost: Number(config.LabourRate) || DEFAULT_CONFIG.LabourRate },
    { code: 'BOP-PCK', name: 'Packing Material', type: 'BOP', cat: 'BOP', unit: 'PCS', cost: Number(config.PackingRate) || DEFAULT_CONFIG.PackingRate },
    { code: 'RM-INS-NYL', name: 'Nylon Insert', type: 'RM', cat: 'BOP', unit: 'PCS', cost: Number(config.NylonInsertRate) || DEFAULT_CONFIG.NylonInsertRate },
    { code: 'RM-NUT-NYL', name: 'Nylon Nut', type: 'RM', cat: 'BOP', unit: 'PCS', cost: Number(config.NylonNutRate) || DEFAULT_CONFIG.NylonNutRate },
    { code: 'RM-NUT-SS201', name: 'SS 201 Nut', type: 'RM', cat: 'BOP', unit: 'PCS', cost: Number(config.SS201NutRate) || DEFAULT_CONFIG.SS201NutRate },
    { code: 'RM-NUT-SS304', name: 'SS 304 Nut', type: 'RM', cat: 'BOP', unit: 'PCS', cost: Number(config.SS304NutRate) || DEFAULT_CONFIG.SS304NutRate },
    { code: 'RM-INR-SS', name: 'SS Inner', type: 'RM', cat: 'BOP', unit: 'PCS', cost: Number(config.SSInnerRate) || DEFAULT_CONFIG.SSInnerRate },
    { code: 'RM-INS-BRS', name: 'Brass Insert', type: 'RM', cat: 'Inhouse', unit: 'PCS', cost: matrix.derived.brassInsertCost },
    { code: 'RM-NUT-BRS-N', name: 'Brass Nut (N)', type: 'RM', cat: 'Inhouse', unit: 'PCS', cost: matrix.derived.brassNutNCost },
    { code: 'RM-NUT-BRS-PC', name: 'Brass Nut (PC)', type: 'RM', cat: 'Inhouse', unit: 'PCS', cost: matrix.derived.brassNutPCCost }
  ];

  for (const itm of subItems) {
    const chk = await pool.request()
      .input('ItemCode', sql.NVarChar(50), itm.code)
      .query('SELECT 1 FROM [ItemMaster] WHERE [ItemCode] = @ItemCode');
    if (chk.recordset.length === 0) {
      await pool.request()
        .input('ItemCode', sql.NVarChar(50), itm.code)
        .input('SubCode', sql.NVarChar(50), '')
        .input('ItemName', sql.NVarChar(100), itm.name)
        .input('ItemType', sql.NVarChar(50), itm.type)
        .input('Category', sql.NVarChar(50), itm.cat)
        .input('Unit', sql.NVarChar(20), itm.unit)
        .input('Costing', sql.Decimal(15, 2), itm.cost)
        .input('MRP', sql.Decimal(15, 2), itm.cost)
        .query(`
          INSERT INTO [ItemMaster] (ItemCode, SubCode, ItemName, ItemType, Category, Unit, Costing, MRP, OpeningStock, ClosingStock)
          VALUES (@ItemCode, @SubCode, @ItemName, @ItemType, @Category, @Unit, @Costing, @MRP, 0, 100)
        `);
    } else {
      await pool.request()
        .input('ItemCode', sql.NVarChar(50), itm.code)
        .input('Costing', sql.Decimal(15, 2), itm.cost)
        .query('UPDATE [ItemMaster] SET [Costing] = @Costing WHERE [ItemCode] = @ItemCode');
    }
  }

  // 2. Fetch existing FG items to match
  const existingItemsRes = await pool.request().query('SELECT ItemCode, SubCode, ItemName, Series, Costing, MRP FROM [ItemMaster]');
  const existingList = existingItemsRes.recordset || [];

  let updatedCount = 0;
  let createdCount = 0;

  for (const s of matrix.series) {
    for (const sz of s.sizes) {
      const seriesKey = s.seriesKey;
      const sizeStr = sz.size;
      const sizeNoQuote = sizeStr.replace(/"/g, '');
      const standardItemCode = `ITM-${seriesKey}-${sizeNoQuote}`;
      const standardItemName = `${s.seriesName} - ${sizeStr}`;
      const costing = Math.round(sz.totalCost * 100) / 100;
      const mrp = Math.round(sz.salePrice * 100) / 100;

      // Find match
      let matched = existingList.find(e => 
        e.ItemCode === standardItemCode ||
        (e.Series && (e.Series.includes(seriesKey) || s.seriesName.includes(e.Series)) && e.ItemName && e.ItemName.includes(sizeStr)) ||
        (e.ItemCode && e.ItemCode.includes(seriesKey) && e.ItemCode.includes(sizeNoQuote))
      );

      const targetItemCode = matched ? matched.ItemCode : standardItemCode;
      const targetSubCode = matched ? (matched.SubCode || '') : '';

      if (matched) {
        await pool.request()
          .input('ItemCode', sql.NVarChar(50), targetItemCode)
          .input('SubCode', sql.NVarChar(50), targetSubCode)
          .input('Costing', sql.Decimal(15, 2), costing)
          .input('MRP', sql.Decimal(15, 2), mrp)
          .query(`
            UPDATE [ItemMaster]
            SET [Costing] = @Costing, [MRP] = @MRP
            WHERE [ItemCode] = @ItemCode AND [SubCode] = @SubCode
          `);
        updatedCount++;
      } else {
        await pool.request()
          .input('ItemCode', sql.NVarChar(50), targetItemCode)
          .input('SubCode', sql.NVarChar(50), '')
          .input('ItemName', sql.NVarChar(100), standardItemName)
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

      // 3. Link child components in BOM_Master
      const nutItemCode = {
        'NylonNut': 'RM-NUT-NYL',
        'SS201Nut': 'RM-NUT-SS201',
        'SS304Nut': 'RM-NUT-SS304',
        'BrassNutN': 'RM-NUT-BRS-N',
        'BrassNutPC': 'RM-NUT-BRS-PC'
      }[s.nutKey] || 'RM-NUT-NYL';

      const innerItemCode = {
        'NylonInsert': 'RM-INS-NYL',
        'BrassInsert': 'RM-INS-BRS',
        'SSInner': 'RM-INR-SS'
      }[s.innerKey] || 'RM-INS-NYL';

      const pipeItemCode = s.isHcp ? 'RM-PIPE-HCP' : 'RM-PIPE-STD';

      const bomChildren = [
        { code: pipeItemCode, qty: 1 },
        { code: 'BOP-CAP', qty: 1 },
        { code: nutItemCode, qty: 2 },
        { code: innerItemCode, qty: 2 },
        { code: 'BOP-KEY', qty: 1 },
        { code: 'BOP-WSH', qty: 1 },
        { code: 'SRV-LABOUR', qty: 1 },
        { code: 'BOP-PCK', qty: 1 }
      ];

      try {
        await pool.request()
          .input('ParentCode', sql.NVarChar(50), targetItemCode)
          .query('DELETE FROM [BOM_Master] WHERE [ParentItemCode] = @ParentCode');

        for (const child of bomChildren) {
          await pool.request()
            .input('ParentItemCode', sql.NVarChar(50), targetItemCode)
            .input('ParentSubCode', sql.NVarChar(50), targetSubCode)
            .input('ChildItemCode', sql.NVarChar(50), child.code)
            .input('ChildSubCode', sql.NVarChar(50), '')
            .input('Quantity', sql.Decimal(12, 4), child.qty)
            .query(`
              INSERT INTO [BOM_Master] (ParentItemCode, ParentSubCode, ChildItemCode, ChildSubCode, Quantity)
              VALUES (@ParentItemCode, @ParentSubCode, @ChildItemCode, @ChildSubCode, @Quantity)
            `);
        }
      } catch (bomErr) {
        console.warn(`[Costing Sync] BOM sync notice for ${targetItemCode}:`, bomErr.message);
      }
    }
  }

  return { updatedCount, createdCount };
}

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
 * Automatically synchronizes all 40 products in ItemMaster!
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

    const currentConfig = {
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
    };

    const matrix = calculateCostingMatrix(currentConfig);

    // Auto-sync products to ItemMaster and BOM_Master
    let syncResult = { updatedCount: 0, createdCount: 0 };
    try {
      syncResult = await syncCostingToDatabase(pool, matrix, currentConfig);
    } catch (syncErr) {
      console.warn('[Costing] Auto-sync to ItemMaster error:', syncErr.message);
    }

    res.status(200).json({
      success: true,
      message: `Costing rates saved! All products updated in Item Master (${syncResult.updatedCount} updated, ${syncResult.createdCount} created).`,
      derived: matrix.derived,
      series: matrix.series,
      syncResult
    });
  } catch (error) {
    console.error('Error saving costing config:', error);
    res.status(500).json({ success: false, message: 'Server error saving costing configuration' });
  }
};

/**
 * POST /api/costing/apply-to-item-master
 * Explicit trigger to sync calculated Costing and Sale Price (MRP) to ItemMaster and BOM.
 */
exports.applyToItemMaster = async (req, res) => {
  try {
    const pool = await connectDB();
    const configRes = await pool.request()
      .input('ConfigKey', sql.NVarChar(50), 'DEFAULT')
      .query('SELECT TOP 1 * FROM [ItemCostingConfig] WHERE [ConfigKey] = @ConfigKey');

    const config = (configRes.recordset && configRes.recordset[0]) || DEFAULT_CONFIG;
    const matrix = calculateCostingMatrix(config);

    const syncResult = await syncCostingToDatabase(pool, matrix, config);

    res.status(200).json({
      success: true,
      message: `Item Master fully synchronized: ${syncResult.updatedCount} items updated, ${syncResult.createdCount} items created with BOM parts!`,
      syncResult
    });
  } catch (error) {
    console.error('Error applying costing to ItemMaster:', error);
    res.status(500).json({ success: false, message: 'Server error applying costing to Item Master: ' + error.message });
  }
};

/**
 * GET /api/costing/item-bom-breakdown/:itemCode
 * Returns dynamic BOM costing breakdown for any selected item.
 */
exports.getItemBOMBreakdown = async (req, res) => {
  try {
    const pool = await connectDB();
    const itemCode = req.params.itemCode;
    const subCode = req.query.subCode || '';

    // 1. Fetch Item details
    const itmRes = await pool.request()
      .input('ItemCode', sql.NVarChar(50), itemCode)
      .input('SubCode', sql.NVarChar(50), subCode)
      .query(`
        SELECT TOP 1 ItemCode, SubCode, ItemName, ItemType, Category, Series, Unit, Costing, MRP
        FROM [ItemMaster]
        WHERE [ItemCode] = @ItemCode AND [SubCode] = @SubCode
      `);

    if (itmRes.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found: ' + itemCode });
    }
    const item = itmRes.recordset[0];

    // 2. Fetch active costing configuration
    const configRes = await pool.request()
      .input('ConfigKey', sql.NVarChar(50), 'DEFAULT')
      .query('SELECT TOP 1 * FROM [ItemCostingConfig] WHERE [ConfigKey] = @ConfigKey');
    const config = (configRes.recordset && configRes.recordset[0]) || DEFAULT_CONFIG;
    const matrix = calculateCostingMatrix(config);

    // 3. Detect series and size (for pipe multipliers & series formulas)
    const seriesDef = SERIES_DEFINITIONS.find(s => 
      (item.Series && item.Series.includes(s.seriesKey)) || 
      (item.ItemCode && item.ItemCode.includes(s.seriesKey)) ||
      (item.ItemName && item.ItemName.includes(s.seriesKey))
    );

    const sizeDef = SIZES.find(sz => 
      (item.ItemName && item.ItemName.includes(sz.size)) ||
      (item.ItemCode && item.ItemCode.endsWith('-' + sz.size.replace(/"/g, '')))
    ) || { size: '12"', mult: 11 };

    // 4. Fetch BOM child components from BOM_Master
    const bomRes = await pool.request()
      .input('ParentItemCode', sql.NVarChar(50), itemCode)
      .input('ParentSubCode', sql.NVarChar(50), subCode)
      .query(`
        SELECT b.ChildItemCode, b.ChildSubCode, b.Quantity,
               i.ItemName as ChildItemName, i.ItemType as ChildItemType,
               i.Category as ChildCategory, i.Unit as ChildUnit, i.Costing as MasterCosting
        FROM [BOM_Master] b
        LEFT JOIN [ItemMaster] i ON b.ChildItemCode = i.ItemCode AND b.ChildSubCode = i.SubCode
        WHERE b.ParentItemCode = @ParentItemCode AND b.ParentSubCode = @ParentSubCode
      `);

    const bomRows = bomRes.recordset || [];
    let totalCosting = 0;
    const breakdown = [];

    const pRate = (seriesDef && seriesDef.isHcp) 
      ? (Number(config.HcpPipeRatePerMeter) || DEFAULT_CONFIG.HcpPipeRatePerMeter)
      : (Number(config.PipeRatePerMeter) || DEFAULT_CONFIG.PipeRatePerMeter);

    for (const b of bomRows) {
      const childCode = b.ChildItemCode;
      let unitRate = Number(b.MasterCosting) || 0;
      let rateSource = 'Master Cost';

      if (childCode === 'RM-PIPE-STD' || childCode === 'RM-PIPE-HCP' || childCode.includes('PIPE')) {
        unitRate = (pRate / 38) * sizeDef.mult;
        rateSource = `(${pRate}/38)×${sizeDef.mult}`;
      } else if (childCode === 'RM-INS-BRS') {
        unitRate = matrix.derived.brassInsertCost;
        rateSource = 'Brass Formula';
      } else if (childCode === 'RM-NUT-BRS-N') {
        unitRate = matrix.derived.brassNutNCost;
        rateSource = 'Brass Formula';
      } else if (childCode === 'RM-NUT-BRS-PC') {
        unitRate = matrix.derived.brassNutPCCost;
        rateSource = 'Brass Formula';
      } else if (childCode === 'RM-NUT-NYL') {
        unitRate = Number(config.NylonNutRate) || DEFAULT_CONFIG.NylonNutRate;
        rateSource = 'Nylon Rate';
      } else if (childCode === 'RM-INS-NYL') {
        unitRate = Number(config.NylonInsertRate) || DEFAULT_CONFIG.NylonInsertRate;
        rateSource = 'Nylon Rate';
      } else if (childCode === 'RM-NUT-SS201') {
        unitRate = Number(config.SS201NutRate) || DEFAULT_CONFIG.SS201NutRate;
        rateSource = 'SS Rate';
      } else if (childCode === 'RM-NUT-SS304') {
        unitRate = Number(config.SS304NutRate) || DEFAULT_CONFIG.SS304NutRate;
        rateSource = 'SS Rate';
      } else if (childCode === 'RM-INR-SS') {
        unitRate = Number(config.SSInnerRate) || DEFAULT_CONFIG.SSInnerRate;
        rateSource = 'SS Rate';
      } else if (childCode === 'BOP-CAP') {
        unitRate = Number(config.CapRate) || DEFAULT_CONFIG.CapRate;
        rateSource = 'Standard Rate';
      } else if (childCode === 'BOP-KEY') {
        unitRate = Number(config.KeyRate) || DEFAULT_CONFIG.KeyRate;
        rateSource = 'Standard Rate';
      } else if (childCode === 'BOP-WSH') {
        unitRate = Number(config.WasherRate) || DEFAULT_CONFIG.WasherRate;
        rateSource = 'Standard Rate';
      } else if (childCode === 'SRV-LABOUR') {
        unitRate = Number(config.LabourRate) || DEFAULT_CONFIG.LabourRate;
        rateSource = 'Labour Rate';
      } else if (childCode === 'BOP-PCK') {
        unitRate = Number(config.PackingRate) || DEFAULT_CONFIG.PackingRate;
        rateSource = 'Packing Rate';
      }

      const qty = Number(b.Quantity) || 1;
      const lineCost = Math.round(unitRate * qty * 100) / 100;
      totalCosting += lineCost;

      breakdown.push({
        childItemCode: b.ChildItemCode,
        childSubCode: b.ChildSubCode,
        childItemName: b.ChildItemName || b.ChildItemCode,
        childItemType: b.ChildItemType || 'RM',
        childCategory: b.ChildCategory || 'BOP',
        childUnit: b.ChildUnit || 'PCS',
        quantity: qty,
        unitRate: Math.round(unitRate * 100) / 100,
        lineCost: lineCost,
        rateSource: rateSource
      });
    }

    totalCosting = Math.round(totalCosting * 100) / 100;

    let storedMargin = 0;
    if (config.MarginsJson) {
      try {
        const mObj = typeof config.MarginsJson === 'string' ? JSON.parse(config.MarginsJson) : config.MarginsJson;
        if (seriesDef && mObj[seriesDef.seriesKey] && mObj[seriesDef.seriesKey][sizeDef.size] !== undefined) {
          storedMargin = Number(mObj[seriesDef.seriesKey][sizeDef.size]) || 0;
        }
      } catch (e) {}
    }

    const currentMRP = Number(item.MRP) || totalCosting;
    const margin = storedMargin !== 0 ? storedMargin : Math.max(0, Math.round((currentMRP - totalCosting) * 100) / 100);
    const salePrice = Math.round((totalCosting + margin) * 100) / 100;

    res.status(200).json({
      success: true,
      item,
      seriesKey: seriesDef?.seriesKey || null,
      size: sizeDef.size,
      multiplier: sizeDef.mult,
      breakdown,
      totalCosting,
      margin,
      salePrice,
      config,
      derived: matrix.derived
    });
  } catch (error) {
    console.error('Error fetching item BOM breakdown:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving BOM breakdown: ' + error.message });
  }
};

/**
 * POST /api/costing/update-item-price
 * Updates Costing and MRP for an individual item.
 */
exports.updateItemPrice = async (req, res) => {
  try {
    const pool = await connectDB();
    const { itemCode, subCode = '', costing, mrp } = req.body;

    if (!itemCode) {
      return res.status(400).json({ success: false, message: 'ItemCode is required' });
    }

    await pool.request()
      .input('ItemCode', sql.NVarChar(50), itemCode)
      .input('SubCode', sql.NVarChar(50), subCode)
      .input('Costing', sql.Decimal(15, 2), Number(costing) || 0)
      .input('MRP', sql.Decimal(15, 2), Number(mrp) || Number(costing) || 0)
      .query(`
        UPDATE [ItemMaster]
        SET [Costing] = @Costing, [MRP] = @MRP
        WHERE [ItemCode] = @ItemCode AND [SubCode] = @SubCode
      `);

    res.status(200).json({
      success: true,
      message: `Item ${itemCode} updated in Item Master (Costing: ₹${costing}, MRP: ₹${mrp})`
    });
  } catch (error) {
    console.error('Error updating item price:', error);
    res.status(500).json({ success: false, message: 'Server error updating item price: ' + error.message });
  }
};
