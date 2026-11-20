const ALLOWED_SIZES = ['SMALL', 'MEDIUM', 'LARGE'];

async function getStockForUpdate(connection, fruitId, packagingSize) {
    const [rows] = await connection.execute(
        `SELECT available_quantity FROM stock
         WHERE fruit_id = ? AND packaging_size = ? FOR UPDATE`,
        [fruitId, packagingSize]
    );
    return rows.length ? Number(rows[0].available_quantity) : 0;
}

async function increaseStock(connection, fruitId, packagingSize, quantity) {
    await connection.execute(
        `INSERT INTO stock (fruit_id, packaging_size, available_quantity)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE available_quantity = available_quantity + ?`,
        [fruitId, packagingSize, quantity, quantity]
    );
}

async function decreaseStock(connection, fruitId, packagingSize, quantity) {
    const [result] = await connection.execute(
        `UPDATE stock SET available_quantity = available_quantity - ?
         WHERE fruit_id = ? AND packaging_size = ? AND available_quantity >= ?`,
        [quantity, fruitId, packagingSize, quantity]
    );
    return result.affectedRows === 1;
}

module.exports = { ALLOWED_SIZES, getStockForUpdate, increaseStock, decreaseStock };
