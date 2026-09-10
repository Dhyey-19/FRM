const { connectDB } = require('./config/db');

async function alterOutwardDiscount() {
  let pool;
  try {
    pool = await connectDB();
    console.log('Connected to database. Applying migrations for Outward discount...');

    // Add DISCOUNT column to OutwardDetail if not exists
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'OutwardDetail' AND COLUMN_NAME = 'DISCOUNT'
      )
      BEGIN
        ALTER TABLE OutwardDetail ADD DISCOUNT NUMERIC(5,2) NULL DEFAULT 0;
        PRINT 'Added DISCOUNT to OutwardDetail';
      END
      ELSE
      BEGIN
        PRINT 'DISCOUNT already exists in OutwardDetail';
      END
    `);

    // Add CDPER and CDAMOUNT to OutwardHeader if not exists
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'OutwardHeader' AND COLUMN_NAME = 'CDPER'
      )
      BEGIN
        ALTER TABLE OutwardHeader ADD CDPER NUMERIC(5,2) NULL DEFAULT 0;
        PRINT 'Added CDPER to OutwardHeader';
      END
      ELSE
      BEGIN
        PRINT 'CDPER already exists in OutwardHeader';
      END

      IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'OutwardHeader' AND COLUMN_NAME = 'CDAMOUNT'
      )
      BEGIN
        ALTER TABLE OutwardHeader ADD CDAMOUNT NUMERIC(12,2) NULL DEFAULT 0;
        PRINT 'Added CDAMOUNT to OutwardHeader';
      END
      ELSE
      BEGIN
        PRINT 'CDAMOUNT already exists in OutwardHeader';
      END
    `);

    console.log('Outward discount schema migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

alterOutwardDiscount();
