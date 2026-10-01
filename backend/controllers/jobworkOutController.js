const { sql, connectDB } = require('../config/db');

const getSignature = (username) => {
    const name = username || 'System';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const sig = `${name} - ${dateStr} ${timeStr}`;
    return sig.substring(0, 40);
};

exports.getNextJobworkOutNo = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT ISNULL(MAX(TRY_CAST(JWOUTWARDNO AS INT)), 0) + 1 AS NextNo 
      FROM JobworkOutHeader
    `);
    
    let nextNo = result.recordset[0]?.NextNo;
    if (!nextNo || isNaN(nextNo)) {
      nextNo = 1;
    }
    res.status(200).json({ nextNo: String(nextNo) });
  } catch (error) {
    console.error('Error fetching next jobwork out no:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper to update stock for a detail row based on DeptID
async function applyJobworkOutStock(request, deptId, itemCode, quantity, netWt, multiplier = -1) {
  // multiplier = -1 means deduct stock (outward)
  // multiplier = +1 means add back stock (revert)
  const isStockDept = (!deptId || Number(deptId) === 1);
  if (isStockDept) {
    const qtyChange = multiplier * (Number(quantity) || 0);
    const wtChange = multiplier * (Number(netWt) || 0);
    await request.query(`
      UPDATE ItemMaster
      SET ClosingStock = ISNULL(ClosingStock, 0) + (${qtyChange})
      WHERE ItemCode = '${itemCode}' AND (UPPER(ISNULL(Unit, '')) NOT IN ('KG', 'KGS'));

      UPDATE ItemMaster
      SET ClosingStock = ISNULL(ClosingStock, 0) + (${wtChange})
      WHERE ItemCode = '${itemCode}' AND UPPER(ISNULL(Unit, '')) IN ('KG', 'KGS');
    `);
  } else {
    const pcsChange = multiplier * (Number(quantity) || 0);
    const wtChange = multiplier * (Number(netWt) || 0);
    const check = await request.query(`
      SELECT * FROM DepartmentStock WHERE DeptID = ${deptId} AND ItemCode = '${itemCode}'
    `);
    if (check.recordset.length > 0) {
      await request.query(`
        UPDATE DepartmentStock
        SET Pcs = ISNULL(Pcs, 0) + (${pcsChange}), Weight = ISNULL(Weight, 0) + (${wtChange})
        WHERE DeptID = ${deptId} AND ItemCode = '${itemCode}'
      `);
    } else {
      await request.query(`
        INSERT INTO DepartmentStock (DeptID, ItemCode, Pcs, Weight)
        VALUES (${deptId}, '${itemCode}', ${pcsChange}, ${wtChange})
      `);
    }
  }
}

exports.getJobworkOuts = async (req, res) => {
  try {
    const pool = await connectDB();
    
    // Fetch all headers with LedgerName and Department
    const headerResult = await pool.request().query(`
      SELECT h.*, l.LedgerName, ISNULL(dm.DeptName, 'Stock') AS DeptName 
      FROM JobworkOutHeader h
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      LEFT JOIN DepartmentMaster dm ON h.DeptID = dm.DeptID
      ORDER BY 
        h.JWOUTWARDDATE DESC,
        CASE WHEN TRY_CAST(h.JWOUTWARDNO AS INT) IS NOT NULL THEN 0 ELSE 1 END,
        TRY_CAST(h.JWOUTWARDNO AS INT) DESC,
        h.JWOUTWARDNO DESC
    `);
    
    // Fetch all details with ItemName and calculated AMOUNT
    const detailResult = await pool.request().query(`
      SELECT d.*, i.ItemName,
        CASE 
          WHEN UPPER(d.UNIT) IN ('KG', 'KGS') THEN (ISNULL(d.NETWT, 0) * ISNULL(d.RATE, 0))
          ELSE (ISNULL(d.QUANTITY, 0) * ISNULL(d.RATE, 0))
        END AS AMOUNT
      FROM JobworkOutDetail d
      LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode
    `);

    // Group details by JWOUTWARDID
    const detailsByHeaderId = detailResult.recordset.reduce((acc, detail) => {
      const headerId = detail.JWOUTWARDID;
      if (!acc[headerId]) {
        acc[headerId] = [];
      }
      acc[headerId].push(detail);
      return acc;
    }, {});

    // Attach details to headers
    const jobworkOuts = headerResult.recordset.map(header => ({
      ...header,
      Details: detailsByHeaderId[header.ID] || []
    }));

    res.status(200).json(jobworkOuts);
  } catch (error) {
    console.error('Error fetching jobwork outs:', error);
    res.status(500).json({ message: 'Server error fetching jobwork outs' });
  }
};

exports.addJobworkOut = async (req, res) => {
  const { Bill, JWOUTWARDNO, JWOUTWARDDATE, LEDGERID, DeptID, REMARK, CREATEDBY, Details } = req.body;

  if (!JWOUTWARDNO || !JWOUTWARDDATE || !LEDGERID || !Details || !Array.isArray(Details) || Details.length === 0) {
    return res.status(400).json({ message: 'JWOutwardNo, Date, Ledger, and at least one detail row are required' });
  }

  let pool;
  let transaction;
  try {
    pool = await connectDB();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const targetDeptId = DeptID ? parseInt(DeptID, 10) : 1;

      // 1. Insert Header
      const headerReq = new sql.Request(transaction);
      const headerRes = await headerReq
        .input('Bill', sql.Bit, Bill !== undefined ? (Bill !== false && Bill !== 0 && Bill !== '0' ? 1 : 0) : 1)
        .input('JWOUTWARDNO', sql.VarChar(10), JWOUTWARDNO)
        .input('JWOUTWARDDATE', sql.Date, JWOUTWARDDATE)
        .input('LEDGERID', sql.Numeric(10,0), LEDGERID)
        .input('DeptID', sql.Int, targetDeptId)
        .input('REMARK', sql.VarChar(100), REMARK || null)
        .input('CREATEDBY', sql.VarChar(40), getSignature(CREATEDBY))
        .input('UPDATEDBY', sql.VarChar(40), getSignature(CREATEDBY))
        .query(`
          INSERT INTO JobworkOutHeader (Bill, JWOUTWARDNO, JWOUTWARDDATE, LEDGERID, DeptID, REMARK, CREATEDBY, UPDATEDBY)
          OUTPUT INSERTED.ID
          VALUES (@Bill, @JWOUTWARDNO, @JWOUTWARDDATE, @LEDGERID, @DeptID, @REMARK, @CREATEDBY, @UPDATEDBY)
        `);

      const newJwOutwardId = headerRes.recordset[0].ID;

      // 2. Insert Details and Update Item Stock
      for (const d of Details) {
        if (!d.ITEMCODE) {
          throw new Error('Item Code is required for all detail rows');
        }
        
        const detailReq = new sql.Request(transaction);
        await detailReq
          .input('JWOUTWARDID', sql.Numeric(8,0), newJwOutwardId)
          .input('ITEMCODE', sql.VarChar(10), d.ITEMCODE)
          .input('GROSSWT', sql.Numeric(10,3), d.GROSSWT || 0)
          .input('NETWT', sql.Numeric(10,3), d.NETWT || 0)
          .input('TENPCSWT', sql.Numeric(10,3), d.TENPCSWT || null)
          .input('QUANTITY', sql.Numeric(10,2), d.QUANTITY || 0)
          .input('UNIT', sql.VarChar(10), d.UNIT || null)
          .input('RATE', sql.Numeric(10,2), d.RATE || 0)
          .input('PROCESS', sql.VarChar(20), d.PROCESS || null)
          .query(`
            INSERT INTO JobworkOutDetail (JWOUTWARDID, ITEMCODE, GROSSWT, NETWT, TENPCSWT, QUANTITY, UNIT, RATE, PROCESS)
            VALUES (@JWOUTWARDID, @ITEMCODE, @GROSSWT, @NETWT, @TENPCSWT, @QUANTITY, @UNIT, @RATE, @PROCESS);
          `);

        // Deduct stock from target department (Main Stock or DepartmentStock)
        await applyJobworkOutStock(detailReq, targetDeptId, d.ITEMCODE, d.QUANTITY, d.NETWT, -1);
      }

      await transaction.commit();
      res.status(201).json({ message: 'Job work out added successfully', id: newJwOutwardId });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error adding job work out:', error);
    res.status(500).json({ message: error.message || 'Server error adding job work out' });
  }
};

exports.updateJobworkOut = async (req, res) => {
  const { id } = req.params;
  const { Bill, JWOUTWARDNO, JWOUTWARDDATE, LEDGERID, DeptID, REMARK, UPDATEDBY, Details } = req.body;

  if (!JWOUTWARDNO || !JWOUTWARDDATE || !LEDGERID || !Details || !Array.isArray(Details) || Details.length === 0) {
    return res.status(400).json({ message: 'JWOutwardNo, Date, Ledger, and at least one detail row are required' });
  }

  let pool;
  let transaction;
  try {
    pool = await connectDB();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Fetch old Header to know old DeptID
      const oldHeaderReq = new sql.Request(transaction);
      const oldHeaderRes = await oldHeaderReq
        .input('ID', sql.Numeric(8,0), id)
        .query('SELECT DeptID FROM JobworkOutHeader WHERE ID = @ID');
      const oldDeptId = oldHeaderRes.recordset[0]?.DeptID ? parseInt(oldHeaderRes.recordset[0].DeptID, 10) : 1;

      // 2. Revert Old Details Stock
      const oldDetailsReq = new sql.Request(transaction);
      const oldDetailsRes = await oldDetailsReq
        .input('JWOUTWARDID', sql.Numeric(8,0), id)
        .query('SELECT * FROM JobworkOutDetail WHERE JWOUTWARDID = @JWOUTWARDID');

      for (const oldD of oldDetailsRes.recordset) {
        const revertReq = new sql.Request(transaction);
        await applyJobworkOutStock(revertReq, oldDeptId, oldD.ITEMCODE, oldD.QUANTITY, oldD.NETWT, +1);
      }

      // 3. Delete old details
      const deleteDetailsReq = new sql.Request(transaction);
      await deleteDetailsReq
        .input('JWOUTWARDID', sql.Numeric(8,0), id)
        .query('DELETE FROM JobworkOutDetail WHERE JWOUTWARDID = @JWOUTWARDID');

      // 4. Update Header with new DeptID
      const targetDeptId = DeptID ? parseInt(DeptID, 10) : 1;
      const headerReq = new sql.Request(transaction);
      await headerReq
        .input('ID', sql.Numeric(8,0), id)
        .input('Bill', sql.Bit, Bill !== undefined ? (Bill !== false && Bill !== 0 && Bill !== '0' ? 1 : 0) : 1)
        .input('JWOUTWARDNO', sql.VarChar(10), JWOUTWARDNO)
        .input('JWOUTWARDDATE', sql.Date, JWOUTWARDDATE)
        .input('LEDGERID', sql.Numeric(10,0), LEDGERID)
        .input('DeptID', sql.Int, targetDeptId)
        .input('REMARK', sql.VarChar(100), REMARK || null)
        .input('UPDATEDBY', sql.VarChar(40), getSignature(UPDATEDBY))
        .query(`
          UPDATE JobworkOutHeader 
          SET Bill = @Bill, JWOUTWARDNO = @JWOUTWARDNO, JWOUTWARDDATE = @JWOUTWARDDATE, 
              LEDGERID = @LEDGERID, DeptID = @DeptID, REMARK = @REMARK, UPDATEDBY = @UPDATEDBY
          WHERE ID = @ID
        `);

      // 5. Insert new details and apply stock changes to new department
      for (const d of Details) {
        if (!d.ITEMCODE) {
          throw new Error('Item Code is required for all detail rows');
        }
        
        const detailReq = new sql.Request(transaction);
        await detailReq
          .input('JWOUTWARDID', sql.Numeric(8,0), id)
          .input('ITEMCODE', sql.VarChar(10), d.ITEMCODE)
          .input('GROSSWT', sql.Numeric(10,3), d.GROSSWT || 0)
          .input('NETWT', sql.Numeric(10,3), d.NETWT || 0)
          .input('TENPCSWT', sql.Numeric(10,3), d.TENPCSWT || null)
          .input('QUANTITY', sql.Numeric(10,2), d.QUANTITY || 0)
          .input('UNIT', sql.VarChar(10), d.UNIT || null)
          .input('RATE', sql.Numeric(10,2), d.RATE || 0)
          .input('PROCESS', sql.VarChar(20), d.PROCESS || null)
          .query(`
            INSERT INTO JobworkOutDetail (JWOUTWARDID, ITEMCODE, GROSSWT, NETWT, TENPCSWT, QUANTITY, UNIT, RATE, PROCESS)
            VALUES (@JWOUTWARDID, @ITEMCODE, @GROSSWT, @NETWT, @TENPCSWT, @QUANTITY, @UNIT, @RATE, @PROCESS);
          `);

        await applyJobworkOutStock(detailReq, targetDeptId, d.ITEMCODE, d.QUANTITY, d.NETWT, -1);
      }

      await transaction.commit();
      res.status(200).json({ message: 'Job work out updated successfully' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error updating job work out:', error);
    res.status(500).json({ message: error.message || 'Server error updating job work out' });
  }
};

exports.deleteJobworkOut = async (req, res) => {
  const { id } = req.params;

  let pool;
  let transaction;
  try {
    pool = await connectDB();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Fetch Header to know DeptID
      const oldHeaderReq = new sql.Request(transaction);
      const oldHeaderRes = await oldHeaderReq
        .input('ID', sql.Numeric(8,0), id)
        .query('SELECT DeptID FROM JobworkOutHeader WHERE ID = @ID');
      const oldDeptId = oldHeaderRes.recordset[0]?.DeptID ? parseInt(oldHeaderRes.recordset[0].DeptID, 10) : 1;

      // 2. Revert stock updates
      const oldDetailsReq = new sql.Request(transaction);
      const oldDetailsRes = await oldDetailsReq
        .input('JWOUTWARDID', sql.Numeric(8,0), id)
        .query('SELECT ITEMCODE, QUANTITY, NETWT, UNIT FROM JobworkOutDetail WHERE JWOUTWARDID = @JWOUTWARDID');
      
      for (const oldD of oldDetailsRes.recordset) {
        const revertStockReq = new sql.Request(transaction);
        await applyJobworkOutStock(revertStockReq, oldDeptId, oldD.ITEMCODE, oldD.QUANTITY, oldD.NETWT, +1);
      }

      // 3. Delete details and header
      const deleteReq = new sql.Request(transaction);
      await deleteReq
        .input('ID', sql.Numeric(8,0), id)
        .query(`
          DELETE FROM JobworkOutDetail WHERE JWOUTWARDID = @ID;
          DELETE FROM JobworkOutHeader WHERE ID = @ID;
        `);

      await transaction.commit();
      res.status(200).json({ message: 'Job work out deleted successfully' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error deleting job work out:', error);
    res.status(500).json({ message: 'Server error deleting job work out' });
  }
};

exports.getJobworkOutReport = async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
        d.ID as RowId,
        h.JWOUTWARDNO, 
        h.JWOUTWARDDATE, 
        h.Bill,
        l.LedgerName, 
        ISNULL(dm.DeptName, 'Stock') AS FromDepartment,
        d.ITEMCODE, 
        i.ItemName, 
        d.UNIT, 
        d.QUANTITY, 
        d.GROSSWT, 
        d.NETWT, 
        d.RATE, 
        CASE 
          WHEN UPPER(d.UNIT) IN ('KG', 'KGS') THEN (ISNULL(d.NETWT, 0) * ISNULL(d.RATE, 0))
          ELSE (ISNULL(d.QUANTITY, 0) * ISNULL(d.RATE, 0))
        END AS AMOUNT,
        d.PROCESS
      FROM JobworkOutDetail d
      INNER JOIN JobworkOutHeader h ON d.JWOUTWARDID = h.ID
      LEFT JOIN LedgerMaster l ON h.LEDGERID = l.Id
      LEFT JOIN DepartmentMaster dm ON h.DeptID = dm.DeptID
      LEFT JOIN ItemMaster i ON d.ITEMCODE = i.ItemCode
      ORDER BY h.JWOUTWARDDATE DESC, h.JWOUTWARDNO DESC, d.ID ASC
    `);
    
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching jobwork out report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
