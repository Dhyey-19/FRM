/**
 * Item Costing Engine for FRM-BBP
 * Calculates standard production costing and sale prices for 8 series across 5 sizes.
 */

const SIZES = [
  { size: '12"', mult: 11 },
  { size: '18"', mult: 17 },
  { size: '24"', mult: 23 },
  { size: '30"', mult: 29 },
  { size: '36"', mult: 35 }
];

const DEFAULT_CONFIG = {
  PipeRatePerMeter: 23.0,
  BrassRatePerKg: 950.0,
  HcpPipeRatePerMeter: 27.0,
  NylonInsertRate: 1.5,
  NylonNutRate: 2.5,
  SS201NutRate: 5.25,
  SS304NutRate: 8.0,
  SSInnerRate: 2.5,
  BrassInsertConv: 300.0,
  BrassInsertWeight: 0.004,
  BrassNutNConv: 230.0,
  BrassNutNWeight: 0.011,
  BrassNutPCConv: 350.0,
  BrassNutPCWeight: 0.012,
  CapRate: 2.5,
  KeyRate: 1.0,
  WasherRate: 0.8,
  LabourRate: 2.0,
  PackingRate: 1.0,
  MarginsJson: null
};

function calculateCostingMatrix(rawConfig = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...rawConfig };

  const pipeRate = Number(cfg.PipeRatePerMeter) || 0;
  const brassRate = Number(cfg.BrassRatePerKg) || 0;
  const hcpPipeRate = Number(cfg.HcpPipeRatePerMeter) || 0;

  const nylonInsert = Number(cfg.NylonInsertRate) || 0;
  const nylonNut = Number(cfg.NylonNutRate) || 0;
  const ss201Nut = Number(cfg.SS201NutRate) || 0;
  const ss304Nut = Number(cfg.SS304NutRate) || 0;
  const ssInner = Number(cfg.SSInnerRate) || 0;

  const brassInsertConv = Number(cfg.BrassInsertConv) || 0;
  const brassInsertWt = Number(cfg.BrassInsertWeight) || 0;
  const brassNutNConv = Number(cfg.BrassNutNConv) || 0;
  const brassNutNWt = Number(cfg.BrassNutNWeight) || 0;
  const brassNutPCConv = Number(cfg.BrassNutPCConv) || 0;
  const brassNutPCWt = Number(cfg.BrassNutPCWeight) || 0;

  const cap = Number(cfg.CapRate) || 0;
  const key = Number(cfg.KeyRate) || 0;
  const washer = Number(cfg.WasherRate) || 0;
  const labour = Number(cfg.LabourRate) || 0;
  const packing = Number(cfg.PackingRate) || 0;

  // Derived Brass Costs
  const brassInsertCost = (brassRate + brassInsertConv) * brassInsertWt;
  const brassNutNCost = (brassRate + brassNutNConv) * brassNutNWt;
  const brassNutPCCost = (brassRate + brassNutPCConv) * brassNutPCWt;

  let savedMargins = {};
  if (cfg.MarginsJson) {
    try {
      savedMargins = typeof cfg.MarginsJson === 'string' ? JSON.parse(cfg.MarginsJson) : cfg.MarginsJson;
    } catch (e) {
      savedMargins = {};
    }
  }

  const seriesDefinitions = [
    {
      seriesKey: '2000',
      seriesCode: '2000',
      seriesName: '2000 Series (Nylon Insert + Nylon Nut)',
      nutKey: 'NylonNut',
      nutName: 'Nylon Nut',
      nutUnitCost: nylonNut,
      nutTotalCost: nylonNut * 2,
      innerKey: 'NylonInsert',
      innerName: 'Nylon Insert',
      innerUnitCost: nylonInsert,
      innerTotalCost: nylonInsert * 2,
      isHcp: false
    },
    {
      seriesKey: '2100',
      seriesCode: '2100',
      seriesName: '2100 Series (Nylon Insert + SS201 Nut)',
      nutKey: 'SS201Nut',
      nutName: 'SS201 Nut',
      nutUnitCost: ss201Nut,
      nutTotalCost: ss201Nut * 2,
      innerKey: 'NylonInsert',
      innerName: 'Nylon Insert',
      innerUnitCost: nylonInsert,
      innerTotalCost: nylonInsert * 2,
      isHcp: false
    },
    {
      seriesKey: '2200',
      seriesCode: '2200',
      seriesName: '2200 Series (Nylon Insert + SS304 Nut)',
      nutKey: 'SS304Nut',
      nutName: 'SS304 Nut',
      nutUnitCost: ss304Nut,
      nutTotalCost: ss304Nut * 2,
      innerKey: 'NylonInsert',
      innerName: 'Nylon Insert',
      innerUnitCost: nylonInsert,
      innerTotalCost: nylonInsert * 2,
      isHcp: false
    },
    {
      seriesKey: '2300',
      seriesCode: '2300',
      seriesName: '2300 Series (Brass Insert + Brass Nut N)',
      nutKey: 'BrassNutN',
      nutName: 'Brass Nut (N)',
      nutUnitCost: brassNutNCost,
      nutTotalCost: brassNutNCost * 2,
      innerKey: 'BrassInsert',
      innerName: 'Brass Insert',
      innerUnitCost: brassInsertCost,
      innerTotalCost: brassInsertCost * 2,
      isHcp: false
    },
    {
      seriesKey: '2400',
      seriesCode: '2400',
      seriesName: '2400 Series (Brass Insert + Brass Nut PC)',
      nutKey: 'BrassNutPC',
      nutName: 'Brass Nut (PC)',
      nutUnitCost: brassNutPCCost,
      nutTotalCost: brassNutPCCost * 2,
      innerKey: 'BrassInsert',
      innerName: 'Brass Insert',
      innerUnitCost: brassInsertCost,
      innerTotalCost: brassInsertCost * 2,
      isHcp: false
    },
    {
      seriesKey: '2500',
      seriesCode: '2500',
      seriesName: '2500 Series (Brass Insert + SS304 Nut)',
      nutKey: 'SS304Nut',
      nutName: 'SS304 Nut',
      nutUnitCost: ss304Nut,
      nutTotalCost: ss304Nut * 2,
      innerKey: 'BrassInsert',
      innerName: 'Brass Insert',
      innerUnitCost: brassInsertCost,
      innerTotalCost: brassInsertCost * 2,
      isHcp: false
    },
    {
      seriesKey: '2600',
      seriesCode: '2600',
      seriesName: '2600 Series (Brass Insert + Nylon Nut)',
      nutKey: 'NylonNut',
      nutName: 'Nylon Nut',
      nutUnitCost: nylonNut,
      nutTotalCost: nylonNut * 2,
      innerKey: 'BrassInsert',
      innerName: 'Brass Insert',
      innerUnitCost: brassInsertCost,
      innerTotalCost: brassInsertCost * 2,
      isHcp: false
    },
    {
      seriesKey: '2900',
      seriesCode: '2900',
      seriesName: '2900 Series (Nylon Insert + SS304 Nut)',
      nutKey: 'SS304Nut',
      nutName: 'SS304 Nut',
      nutUnitCost: ss304Nut,
      nutTotalCost: ss304Nut * 2,
      innerKey: 'SSInner',
      innerName: 'SS Inner',
      innerUnitCost: ssInner,
      innerTotalCost: ssInner * 2,
      isHcp: true
    }
  ];

  const seriesResults = seriesDefinitions.map((s) => {
    const sizeItems = SIZES.map((sz) => {
      const pRate = s.isHcp ? hcpPipeRate : pipeRate;
      const pipeCost = (pRate / 38) * sz.mult;
      const totalCost = pipeCost + cap + s.nutTotalCost + s.innerTotalCost + key + washer + labour + packing;

      // Extract saved margin or default to 0
      const marginKey = `${s.seriesKey}_${sz.size.replace(/"/g, '')}`;
      const seriesMargin = savedMargins[s.seriesKey]?.[sz.size] ?? savedMargins[marginKey] ?? 0;
      const marginVal = Number(seriesMargin) || 0;
      const salePrice = totalCost + marginVal;

      return {
        size: sz.size,
        mult: sz.mult,
        pipeCost: Math.round(pipeCost * 100) / 100,
        capCost: Math.round(cap * 100) / 100,
        nutCost: Math.round(s.nutTotalCost * 100) / 100,
        innerCost: Math.round(s.innerTotalCost * 100) / 100,
        keyCost: Math.round(key * 100) / 100,
        washerCost: Math.round(washer * 100) / 100,
        labourCost: Math.round(labour * 100) / 100,
        packingCost: Math.round(packing * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        margin: Math.round(marginVal * 100) / 100,
        salePrice: Math.round(salePrice * 100) / 100
      };
    });

    return {
      seriesKey: s.seriesKey,
      seriesCode: s.seriesCode,
      seriesName: s.seriesName,
      nutKey: s.nutKey,
      nutName: s.nutName,
      nutUnitCost: Math.round(s.nutUnitCost * 100) / 100,
      nutTotalCost: Math.round(s.nutTotalCost * 100) / 100,
      innerKey: s.innerKey,
      innerName: s.innerName,
      innerUnitCost: Math.round(s.innerUnitCost * 100) / 100,
      innerTotalCost: Math.round(s.innerTotalCost * 100) / 100,
      isHcp: s.isHcp,
      sizes: sizeItems
    };
  });

  return {
    config: cfg,
    derived: {
      brassInsertCost: Math.round(brassInsertCost * 100) / 100,
      brassNutNCost: Math.round(brassNutNCost * 100) / 100,
      brassNutPCCost: Math.round(brassNutPCCost * 100) / 100,
      fixedOverhead: Math.round((cap + key + washer + labour + packing) * 100) / 100
    },
    series: seriesResults
  };
}

module.exports = {
  SIZES,
  DEFAULT_CONFIG,
  SERIES_DEFINITIONS: [
    { seriesKey: '2000', seriesCode: '2000', seriesName: '2000 Series (Nylon Insert + Nylon Nut)', nutKey: 'NylonNut', innerKey: 'NylonInsert', isHcp: false },
    { seriesKey: '2100', seriesCode: '2100', seriesName: '2100 Series (Nylon Insert + SS201 Nut)', nutKey: 'SS201Nut', innerKey: 'NylonInsert', isHcp: false },
    { seriesKey: '2200', seriesCode: '2200', seriesName: '2200 Series (Nylon Insert + SS304 Nut)', nutKey: 'SS304Nut', innerKey: 'NylonInsert', isHcp: false },
    { seriesKey: '2300', seriesCode: '2300', seriesName: '2300 Series (Brass Insert + Brass Nut N)', nutKey: 'BrassNutN', innerKey: 'BrassInsert', isHcp: false },
    { seriesKey: '2400', seriesCode: '2400', seriesName: '2400 Series (Brass Insert + Brass Nut PC)', nutKey: 'BrassNutPC', innerKey: 'BrassInsert', isHcp: false },
    { seriesKey: '2500', seriesCode: '2500', seriesName: '2500 Series (Brass Insert + SS304 Nut)', nutKey: 'SS304Nut', innerKey: 'BrassInsert', isHcp: false },
    { seriesKey: '2600', seriesCode: '2600', seriesName: '2600 Series (Brass Insert + Nylon Nut)', nutKey: 'NylonNut', innerKey: 'BrassInsert', isHcp: false },
    { seriesKey: '2900', seriesCode: '2900', seriesName: '2900 Series (Nylon Insert + SS304 Nut)', nutKey: 'SS304Nut', innerKey: 'SSInner', isHcp: true }
  ],
  calculateCostingMatrix
};
