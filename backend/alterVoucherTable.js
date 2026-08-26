const { sql, connectDB } = require('./config/db');

async function alterTable() {
  try {
    const pool = await connectDB();
    
    // Check if Bill column exists in VoucherEntry
    const checkColumnQuery = `
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'[dbo].[VoucherEntry]') 
          AND name = 'Bill'
      )
      BEGIN
        ALTER TABLE [dbo].[VoucherEntry] ADD [Bill] BIT NULL DEFAULT 1;
        PRINT 'Added Bill column to VoucherEntry';
      END
      ELSE
      BEGIN
        PRINT 'Bill column already exists in VoucherEntry';
      END
    `;
    await pool.request().query(checkColumnQuery);

    // Backfill Purchase vouchers from InwardHeader.Bill
    await pool.request().query(`
      UPDATE v
      SET v.Bill = ISNULL(h.Bill, 1)
      FROM VoucherEntry v
      INNER JOIN InwardHeader h ON v.Remark = h.INWARDNO
      WHERE v.VoucherType = 'Purchase' AND (v.Through = 'Inward' OR v.Through IS NULL);
    `);

    // Backfill Sales vouchers from OutwardHeader.Bill
    await pool.request().query(`
      UPDATE v
      SET v.Bill = ISNULL(h.Bill, 1)
      FROM VoucherEntry v
      INNER JOIN OutwardHeader h ON v.Remark = h.OUTWARDNO
      WHERE v.VoucherType = 'Sales' AND (v.Through = 'Outward' OR v.Through IS NULL);
    `);

    // Default remaining NULL records to 1 (With Bill)
    await pool.request().query(`
      UPDATE VoucherEntry
      SET Bill = 1
      WHERE Bill IS NULL;
    `);

    console.log('Successfully altered VoucherEntry and backfilled Bill column.');
  } catch (error) {
    console.error('Error altering VoucherEntry table:', error);
  } finally {
    process.exit();
  }
}

alterTable();
