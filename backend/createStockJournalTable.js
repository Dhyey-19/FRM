require('dotenv').config();
const sql = require('mssql');

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: true,
    },
};

const createStockJournalTable = async () => {
    try {
        await sql.connect(dbConfig);
        console.log('Connected to database');

        await sql.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='StockJournal' and xtype='U')
            BEGIN
                CREATE TABLE dbo.StockJournal
                (
                    SJID            NUMERIC(8,0) IDENTITY(1,1) NOT NULL,
                    SJDate          DATE NOT NULL,
                    SJType          VARCHAR(15) NOT NULL,
                    
                    ItemCode        VARCHAR(10) NOT NULL,
                    Qty             NUMERIC(10,3) NOT NULL,
                    Remarks         VARCHAR(50) NULL,
                    CreatedBy       VARCHAR(40) NOT NULL,
                    UpdatedBy       VARCHAR(40) NULL,

                    CONSTRAINT PK_StockJournal
                        PRIMARY KEY (SJID),

                    CONSTRAINT FK_StockJournal_ItemMaster
                        FOREIGN KEY (ItemCode)
                        REFERENCES dbo.ItemMaster(ItemCode)
                );
                PRINT 'StockJournal table created successfully';
            END
            ELSE
            BEGIN
                PRINT 'StockJournal table already exists';
            END
        `);

        console.log('Table creation script executed');
    } catch (err) {
        console.error('Error creating tables:', err);
    } finally {
        await sql.close();
        console.log('Database connection closed');
    }
};

createStockJournalTable();
