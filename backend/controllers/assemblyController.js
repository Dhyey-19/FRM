const { sql, connectDB } = require('../config/db');

const getSignature = (username) => {
    const name = username || 'Admin';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const sig = `${name} - ${dateStr} ${timeStr}`;
    return sig.substring(0, 40);
};

// GET /api/assembly/next-no
exports.getNextAssemblyNo = async (req, res) => {
    try {
        const pool = await connectDB();
        const result = await pool.request()
            .query('SELECT ISNULL(MAX(AssemblyNo), 0) + 1 AS NextNo FROM AssemblyTransactions');
        
        res.status(200).json({ nextNo: result.recordset[0].NextNo });
    } catch (error) {
        console.error('Error fetching next assembly no:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/assembly
exports.createAssembly = async (req, res) => {
    const { AssemblyNo, AssemblyDate, ItemCode, Quantity, Remark, CreatedBy } = req.body;

    if (!AssemblyNo || !AssemblyDate || !ItemCode || !Quantity) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const pool = await connectDB();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // 1. Fetch child items from BOM_Master
            const bomResult = await transaction.request()
                .input('ParentItemCode', sql.VarChar(10), ItemCode)
                .query('SELECT ChildItemCode, Quantity AS BOMQuantity FROM BOM_Master WHERE ParentItemCode = @ParentItemCode');

            const childItems = bomResult.recordset;

            // 2. Check stock for all child items
            for (const child of childItems) {
                const requiredQty = child.BOMQuantity * Quantity;

                const stockResult = await transaction.request()
                    .input('ChildItemCode', sql.VarChar(10), child.ChildItemCode)
                    .query('SELECT ClosingStock FROM ItemMaster WHERE ItemCode = @ChildItemCode');

                if (stockResult.recordset.length === 0) {
                    throw new Error(`Child item ${child.ChildItemCode} not found in ItemMaster`);
                }

                const currentStock = stockResult.recordset[0].ClosingStock;
                if (currentStock < requiredQty) {
                    throw new Error(`Insufficient stock for child item ${child.ChildItemCode}. Required: ${requiredQty}, Available: ${currentStock}`);
                }
            }

            // 3. Deduct stock from child items
            for (const child of childItems) {
                const requiredQty = child.BOMQuantity * Quantity;

                await transaction.request()
                    .input('ChildItemCode', sql.VarChar(10), child.ChildItemCode)
                    .input('QtyToDeduct', sql.Numeric(12, 3), requiredQty)
                    .query('UPDATE ItemMaster SET ClosingStock = ClosingStock - @QtyToDeduct WHERE ItemCode = @ChildItemCode');
            }

            // 4. Increase stock for parent item
            await transaction.request()
                .input('ParentItemCode', sql.VarChar(10), ItemCode)
                .input('QtyToAdd', sql.Numeric(12, 3), Quantity)
                .query('UPDATE ItemMaster SET ClosingStock = ClosingStock + @QtyToAdd WHERE ItemCode = @ParentItemCode');

            // 5. Insert into AssemblyTransactions
            await transaction.request()
                .input('AssemblyNo', sql.Numeric(8, 0), AssemblyNo)
                .input('AssemblyDate', sql.Date, AssemblyDate)
                .input('ItemCode', sql.VarChar(10), ItemCode)
                .input('Quantity', sql.Numeric(8, 0), Quantity)
                .input('Remark', sql.VarChar(50), Remark || null)
                .input('CreatedBy', sql.VarChar(40), getSignature(CreatedBy))
                .input('UpdatedBy', sql.VarChar(40), getSignature(CreatedBy))
                .query(`
                    INSERT INTO AssemblyTransactions (AssemblyNo, AssemblyDate, ItemCode, Quantity, Remark, CreatedBy, UpdatedBy)
                    VALUES (@AssemblyNo, @AssemblyDate, @ItemCode, @Quantity, @Remark, @CreatedBy, @UpdatedBy)
                `);

            await transaction.commit();
            res.status(201).json({ message: 'Assembly transaction completed successfully' });
        } catch (innerError) {
            await transaction.rollback();
            throw innerError;
        }

    } catch (error) {
        console.error('Error creating assembly transaction:', error);
        res.status(400).json({ message: error.message || 'Server error' });
    }
};

// GET /api/assembly/today
exports.getTodayAssemblies = async (req, res) => {
    try {
        const pool = await connectDB();
        const result = await pool.request()
            .query(`
                SELECT a.Id, a.AssemblyNo, a.AssemblyDate, a.ItemCode, a.Quantity, CAST(a.Remark AS VARCHAR(50)) AS Remark, a.CreatedBy, a.UpdatedBy, i.ItemName 
                FROM AssemblyTransactions a
                INNER JOIN ItemMaster i ON a.ItemCode = i.ItemCode
                WHERE CAST(a.AssemblyDate AS DATE) = CAST(GETDATE() AS DATE)
                ORDER BY a.AssemblyNo DESC
            `);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching today assemblies:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/assembly/report
exports.getAllAssembliesReport = async (req, res) => {
    try {
        const pool = await connectDB();
        const result = await pool.request()
            .query(`
                SELECT a.Id, a.AssemblyNo, a.AssemblyDate, a.ItemCode, a.Quantity, CAST(a.Remark AS VARCHAR(50)) AS Remark, a.CreatedBy, a.UpdatedBy, i.ItemName 
                FROM AssemblyTransactions a
                INNER JOIN ItemMaster i ON a.ItemCode = i.ItemCode
                ORDER BY a.AssemblyDate DESC, a.AssemblyNo DESC
            `);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching all assemblies for report:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Helper function to reverse a transaction (called within a SQL transaction)
const reverseAssemblyTransaction = async (transaction, assemblyId, deleteRecord = true) => {
    // We create new requests for each query to avoid parameter conflicts
    
    const recordReq = new sql.Request(transaction);
    const recordResult = await recordReq
        .input('AssemblyId', sql.Int, assemblyId)
        .query('SELECT ItemCode, Quantity FROM AssemblyTransactions WHERE Id = @AssemblyId');

    if (recordResult.recordset.length === 0) {
        throw new Error('Assembly transaction not found');
    }

    const { ItemCode, Quantity } = recordResult.recordset[0];

    const bomReq = new sql.Request(transaction);
    const bomResult = await bomReq
        .input('ReverseParentCode', sql.VarChar(10), ItemCode)
        .query('SELECT ChildItemCode, Quantity AS BOMQuantity FROM BOM_Master WHERE ParentItemCode = @ReverseParentCode');
    
    const childItems = bomResult.recordset;

    const deductParentReq = new sql.Request(transaction);
    await deductParentReq
        .input('ReverseParentCode', sql.VarChar(10), ItemCode)
        .input('ReverseQtyToDeduct', sql.Numeric(12, 3), Quantity)
        .query('UPDATE ItemMaster SET ClosingStock = ClosingStock - @ReverseQtyToDeduct WHERE ItemCode = @ReverseParentCode');

    for (const child of childItems) {
        const qtyToAddBack = child.BOMQuantity * Quantity;
        const addChildReq = new sql.Request(transaction);
        await addChildReq
            .input('ReverseChildCode', sql.VarChar(10), child.ChildItemCode)
            .input('ReverseQtyToAdd', sql.Numeric(12, 3), qtyToAddBack)
            .query('UPDATE ItemMaster SET ClosingStock = ClosingStock + @ReverseQtyToAdd WHERE ItemCode = @ReverseChildCode');
    }

    if (deleteRecord) {
        const deleteReq = new sql.Request(transaction);
        await deleteReq
            .input('AssemblyId', sql.Int, assemblyId)
            .query('DELETE FROM AssemblyTransactions WHERE Id = @AssemblyId');
    }
};

// DELETE /api/assembly/:id
exports.deleteAssembly = async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await connectDB();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            await reverseAssemblyTransaction(transaction, id);
            await transaction.commit();
            res.status(200).json({ message: 'Assembly transaction deleted successfully' });
        } catch (innerError) {
            await transaction.rollback();
            throw innerError;
        }
    } catch (error) {
        console.error('Error deleting assembly transaction:', error);
        res.status(400).json({ message: error.message || 'Server error' });
    }
};

// PUT /api/assembly/:id
exports.updateAssembly = async (req, res) => {
    const { id } = req.params;
    const { AssemblyDate, ItemCode, Quantity, Remark, UpdatedBy } = req.body;

    if (!AssemblyDate || !ItemCode || !Quantity) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const pool = await connectDB();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const getNoReq = new sql.Request(transaction);
            const recordResult = await getNoReq
                .input('AssemblyIdForUpdate', sql.Int, id)
                .query('SELECT AssemblyNo FROM AssemblyTransactions WHERE Id = @AssemblyIdForUpdate');
            
            if (recordResult.recordset.length === 0) {
                throw new Error('Assembly transaction not found');
            }

            // Reverse the old transaction (but DO NOT delete the record, just revert stock)
            await reverseAssemblyTransaction(transaction, id, false);

            // Apply new transaction logic
            const applyReq = new sql.Request(transaction);
            const bomResult = await applyReq
                .input('NewParentItemCode', sql.VarChar(10), ItemCode)
                .query('SELECT ChildItemCode, Quantity AS BOMQuantity FROM BOM_Master WHERE ParentItemCode = @NewParentItemCode');
            const childItems = bomResult.recordset;

            for (const child of childItems) {
                const requiredQty = child.BOMQuantity * Quantity;
                const stockReq = new sql.Request(transaction);
                const stockResult = await stockReq
                    .input('CheckChildCode', sql.VarChar(10), child.ChildItemCode)
                    .query('SELECT ClosingStock FROM ItemMaster WHERE ItemCode = @CheckChildCode');

                if (stockResult.recordset.length === 0) throw new Error(`Child item ${child.ChildItemCode} not found in ItemMaster`);
                const currentStock = stockResult.recordset[0].ClosingStock;
                if (currentStock < requiredQty) throw new Error(`Insufficient stock for child item ${child.ChildItemCode}. Required: ${requiredQty}, Available: ${currentStock}`);
            }

            for (const child of childItems) {
                const requiredQty = child.BOMQuantity * Quantity;
                const deductReq = new sql.Request(transaction);
                await deductReq
                    .input('DeductChildCode', sql.VarChar(10), child.ChildItemCode)
                    .input('QtyToDeduct', sql.Numeric(12, 3), requiredQty)
                    .query('UPDATE ItemMaster SET ClosingStock = ClosingStock - @QtyToDeduct WHERE ItemCode = @DeductChildCode');
            }

            const addReq = new sql.Request(transaction);
            await addReq
                .input('AddParentCode', sql.VarChar(10), ItemCode)
                .input('QtyToAdd', sql.Numeric(12, 3), Quantity)
                .query('UPDATE ItemMaster SET ClosingStock = ClosingStock + @QtyToAdd WHERE ItemCode = @AddParentCode');

            const updateReq = new sql.Request(transaction);
            await updateReq
                .input('AssemblyId', sql.Int, id)
                .input('AssemblyDate', sql.Date, AssemblyDate)
                .input('ItemCode', sql.VarChar(10), ItemCode)
                .input('Quantity', sql.Numeric(8, 0), Quantity)
                .input('Remark', sql.VarChar(50), Remark || null)
                .input('UpdatedBy', sql.VarChar(40), getSignature(UpdatedBy))
                .query(`
                    UPDATE AssemblyTransactions
                    SET AssemblyDate = @AssemblyDate,
                        ItemCode = @ItemCode,
                        Quantity = @Quantity,
                        Remark = @Remark,
                        UpdatedBy = @UpdatedBy
                    WHERE Id = @AssemblyId
                `);

            await transaction.commit();
            res.status(200).json({ message: 'Assembly transaction updated successfully' });
        } catch (innerError) {
            await transaction.rollback();
            throw innerError;
        }

    } catch (error) {
        console.error('Error updating assembly transaction:', error);
        res.status(400).json({ message: error.message || 'Server error' });
    }
};
