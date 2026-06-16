const { sql, connectDB } = require('../config/db');

const getSignature = (username) => {
    const name = username || 'Admin';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const sig = `${name} - ${dateStr} ${timeStr}`;
    return sig.substring(0, 40);
};

// GET /api/stock-journal
exports.getJournals = async (req, res) => {
    try {
        const pool = await connectDB();
        const result = await pool.request()
            .query(`
                SELECT sj.*, i.ItemName 
                FROM StockJournal sj
                INNER JOIN ItemMaster i ON sj.ItemCode = i.ItemCode
                ORDER BY sj.SJID DESC
            `);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching stock journals:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/stock-journal
exports.createJournal = async (req, res) => {
    const { SJDate, SJType, ItemCode, Qty, Remarks, CreatedBy } = req.body;

    if (!SJDate || !SJType || !ItemCode || !Qty) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const pool = await connectDB();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const request = new sql.Request(transaction);

            // Fetch current stock
            const stockResult = await request
                .input('ItemCode', sql.VarChar(10), ItemCode)
                .query('SELECT ClosingStock FROM ItemMaster WHERE ItemCode = @ItemCode');

            if (stockResult.recordset.length === 0) {
                throw new Error('Item not found in ItemMaster');
            }

            const currentStock = stockResult.recordset[0].ClosingStock;
            const parsedQty = parseFloat(Qty);

            // Validate consumption stock availability
            if (SJType === 'Consumption' && currentStock < parsedQty) {
                throw new Error(`Insufficient stock for consumption. Available: ${currentStock}, Requested: ${parsedQty}`);
            }

            // Update Stock
            const updateStockReq = new sql.Request(transaction);
            if (SJType === 'Production') {
                await updateStockReq
                    .input('ItemCode', sql.VarChar(10), ItemCode)
                    .input('Qty', sql.Numeric(10, 3), parsedQty)
                    .query('UPDATE ItemMaster SET ClosingStock = ClosingStock + @Qty WHERE ItemCode = @ItemCode');
            } else if (SJType === 'Consumption') {
                await updateStockReq
                    .input('ItemCode', sql.VarChar(10), ItemCode)
                    .input('Qty', sql.Numeric(10, 3), parsedQty)
                    .query('UPDATE ItemMaster SET ClosingStock = ClosingStock - @Qty WHERE ItemCode = @ItemCode');
            } else {
                throw new Error('Invalid SJType. Must be Production or Consumption.');
            }

            // Insert Record
            const insertReq = new sql.Request(transaction);
            await insertReq
                .input('SJDate', sql.Date, SJDate)
                .input('SJType', sql.VarChar(15), SJType)
                .input('ItemCode', sql.VarChar(10), ItemCode)
                .input('Qty', sql.Numeric(10, 3), parsedQty)
                .input('Remarks', sql.VarChar(50), Remarks || null)
                .input('CreatedBy', sql.VarChar(40), getSignature(CreatedBy))
                .input('UpdatedBy', sql.VarChar(40), getSignature(CreatedBy))
                .query(`
                    INSERT INTO StockJournal (SJDate, SJType, ItemCode, Qty, Remarks, CreatedBy, UpdatedBy)
                    VALUES (@SJDate, @SJType, @ItemCode, @Qty, @Remarks, @CreatedBy, @UpdatedBy)
                `);

            await transaction.commit();
            res.status(201).json({ message: 'Stock Journal saved successfully' });
        } catch (innerError) {
            await transaction.rollback();
            throw innerError;
        }

    } catch (error) {
        console.error('Error creating stock journal:', error);
        res.status(400).json({ message: error.message || 'Server error' });
    }
};

// Helper to reverse a journal (called within SQL transaction)
const reverseJournal = async (transaction, id, deleteRecord = true) => {
    const recordReq = new sql.Request(transaction);
    const recordResult = await recordReq
        .input('SJID', sql.Numeric(8, 0), id)
        .query('SELECT SJType, ItemCode, Qty FROM StockJournal WHERE SJID = @SJID');

    if (recordResult.recordset.length === 0) {
        throw new Error('Stock Journal record not found');
    }

    const { SJType, ItemCode, Qty } = recordResult.recordset[0];
    const updateStockReq = new sql.Request(transaction);

    if (SJType === 'Production') {
        await updateStockReq
            .input('ItemCode', sql.VarChar(10), ItemCode)
            .input('Qty', sql.Numeric(10, 3), Qty)
            .query('UPDATE ItemMaster SET ClosingStock = ClosingStock - @Qty WHERE ItemCode = @ItemCode');
    } else if (SJType === 'Consumption') {
        await updateStockReq
            .input('ItemCode', sql.VarChar(10), ItemCode)
            .input('Qty', sql.Numeric(10, 3), Qty)
            .query('UPDATE ItemMaster SET ClosingStock = ClosingStock + @Qty WHERE ItemCode = @ItemCode');
    }

    if (deleteRecord) {
        const deleteReq = new sql.Request(transaction);
        await deleteReq
            .input('SJID', sql.Numeric(8, 0), id)
            .query('DELETE FROM StockJournal WHERE SJID = @SJID');
    }
};

// DELETE /api/stock-journal/:id
exports.deleteJournal = async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await connectDB();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            await reverseJournal(transaction, id);
            await transaction.commit();
            res.status(200).json({ message: 'Stock Journal deleted successfully' });
        } catch (innerError) {
            await transaction.rollback();
            throw innerError;
        }
    } catch (error) {
        console.error('Error deleting stock journal:', error);
        res.status(400).json({ message: error.message || 'Server error' });
    }
};

// PUT /api/stock-journal/:id
exports.updateJournal = async (req, res) => {
    const { id } = req.params;
    const { SJDate, SJType, ItemCode, Qty, Remarks, UpdatedBy } = req.body;

    if (!SJDate || !SJType || !ItemCode || !Qty) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const pool = await connectDB();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            await reverseJournal(transaction, id, false);

            const request = new sql.Request(transaction);
            const stockResult = await request
                .input('NewItemCode', sql.VarChar(10), ItemCode)
                .query('SELECT ClosingStock FROM ItemMaster WHERE ItemCode = @NewItemCode');

            if (stockResult.recordset.length === 0) throw new Error('Item not found in ItemMaster');

            const currentStock = stockResult.recordset[0].ClosingStock;
            const parsedQty = parseFloat(Qty);

            if (SJType === 'Consumption' && currentStock < parsedQty) {
                throw new Error(`Insufficient stock for consumption. Available: ${currentStock}, Requested: ${parsedQty}`);
            }

            const updateStockReq = new sql.Request(transaction);
            if (SJType === 'Production') {
                await updateStockReq
                    .input('ProdItemCode', sql.VarChar(10), ItemCode)
                    .input('ProdQty', sql.Numeric(10, 3), parsedQty)
                    .query('UPDATE ItemMaster SET ClosingStock = ClosingStock + @ProdQty WHERE ItemCode = @ProdItemCode');
            } else if (SJType === 'Consumption') {
                await updateStockReq
                    .input('ConsItemCode', sql.VarChar(10), ItemCode)
                    .input('ConsQty', sql.Numeric(10, 3), parsedQty)
                    .query('UPDATE ItemMaster SET ClosingStock = ClosingStock - @ConsQty WHERE ItemCode = @ConsItemCode');
            }

            const updateReq = new sql.Request(transaction);
            await updateReq
                .input('SJID', sql.Numeric(8, 0), id)
                .input('SJDate', sql.Date, SJDate)
                .input('SJType', sql.VarChar(15), SJType)
                .input('ItemCode', sql.VarChar(10), ItemCode)
                .input('Qty', sql.Numeric(10, 3), parsedQty)
                .input('Remarks', sql.VarChar(50), Remarks || null)
                .input('UpdatedBy', sql.VarChar(40), getSignature(UpdatedBy))
                .query(`
                    UPDATE StockJournal
                    SET SJDate = @SJDate,
                        SJType = @SJType,
                        ItemCode = @ItemCode,
                        Qty = @Qty,
                        Remarks = @Remarks,
                        UpdatedBy = @UpdatedBy
                    WHERE SJID = @SJID
                `);

            await transaction.commit();
            res.status(200).json({ message: 'Stock Journal updated successfully' });
        } catch (innerError) {
            await transaction.rollback();
            throw innerError;
        }

    } catch (error) {
        console.error('Error updating stock journal:', error);
        res.status(400).json({ message: error.message || 'Server error' });
    }
};
