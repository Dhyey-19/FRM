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

const createAssemblyTables = async () => {
    try {
        await sql.connect(dbConfig);
        console.log('Connected to database');

        // Create AssemblyTransactions table
        await sql.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AssemblyTransactions' and xtype='U')
            BEGIN
                CREATE TABLE dbo.AssemblyTransactions
                (
                    Id              INT IDENTITY(1,1) NOT NULL,
                    AssemblyNo      NUMERIC(8,0) NOT NULL,
                    AssemblyDate    DATE NOT NULL,

                    ItemCode        VARCHAR(10) NOT NULL,
                    Quantity        NUMERIC(8,0) NOT NULL,

                    CreatedBy       VARCHAR(40) NOT NULL,
                    UpdatedBy       VARCHAR(40) NULL,

                    CONSTRAINT PK_AssemblyTransactions
                        PRIMARY KEY (Id),

                    CONSTRAINT FK_AssemblyTransactions_ItemMaster
                        FOREIGN KEY (ItemCode)
                        REFERENCES dbo.ItemMaster(ItemCode)
                );
                PRINT 'AssemblyTransactions table created successfully';
            END
            ELSE
            BEGIN
                PRINT 'AssemblyTransactions table already exists';
            END
        `);

        // Create BOM_Master table
        await sql.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BOM_Master' and xtype='U')
            BEGIN
                CREATE TABLE [dbo].[BOM_Master](
                    [ParentItemCode] [varchar](10) NOT NULL,
                    [ChildItemCode] [varchar](10) NOT NULL,
                    [Quantity] [numeric](5, 3) NOT NULL
                ) ON [PRIMARY];
                
                ALTER TABLE [dbo].[BOM_Master] ADD  CONSTRAINT [PK_BOM_Master] PRIMARY KEY CLUSTERED 
                (
                    [ParentItemCode] ASC,
                    [ChildItemCode] ASC
                )WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY];
                
                ALTER TABLE [dbo].[BOM_Master] ADD  DEFAULT ((0)) FOR [Quantity];
                
                ALTER TABLE [dbo].[BOM_Master]  WITH CHECK ADD  CONSTRAINT [FK_BOM_ChildItem] FOREIGN KEY([ChildItemCode])
                REFERENCES [dbo].[ItemMaster] ([ItemCode]);
                
                ALTER TABLE [dbo].[BOM_Master] CHECK CONSTRAINT [FK_BOM_ChildItem];
                
                ALTER TABLE [dbo].[BOM_Master]  WITH CHECK ADD  CONSTRAINT [FK_BOM_ParentItem] FOREIGN KEY([ParentItemCode])
                REFERENCES [dbo].[ItemMaster] ([ItemCode]);
                
                ALTER TABLE [dbo].[BOM_Master] CHECK CONSTRAINT [FK_BOM_ParentItem];

                PRINT 'BOM_Master table created successfully';
            END
            ELSE
            BEGIN
                PRINT 'BOM_Master table already exists';
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

createAssemblyTables();
