const { sql, connectDB } = require('./backend/config/db');

async function checkSchema() {
    try {
        const pool = await connectDB();
        const result = await pool.request().query(`
            SELECT TABLE_NAME, COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE COLUMN_NAME IN ('CreatedBy', 'UpdatedBy')
            ORDER BY TABLE_NAME, COLUMN_NAME
        `);
        console.log("TABLES WITH CreatedBy/UpdatedBy:");
        const tables = {};
        result.recordset.forEach(row => {
            if (!tables[row.TABLE_NAME]) tables[row.TABLE_NAME] = [];
            tables[row.TABLE_NAME].push(row.COLUMN_NAME);
        });
        console.log(JSON.stringify(tables, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
