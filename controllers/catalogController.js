
const pool = require('../config/db');

function httpError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function handleError(next, error) {
    next(error);
}

// ---------------- SUPPLIERS ----------------
exports.getSuppliers = async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM suppliers ORDER BY supplier_id DESC'
        );
        res.json(rows);
    } catch (error) {
        handleError(next, error);
    }
};

exports.getSupplierById = async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM suppliers WHERE supplier_id = ?',
            [req.params.id]
        );

        if (!rows.length) throw httpError('Supplier not found.', 404);

        res.json(rows[0]);
    } catch (error) {
        handleError(next, error);
    }
};

exports.createSupplier = async (req, res, next) => {
    try {
        const { businessName, contactPerson, phone, province, address } = req.body;

        if (![businessName, contactPerson, phone, province, address].every(
            v => typeof v === 'string' && v.trim()
        )) {
            throw httpError(
                'Business name, contact person, phone, province and address are required.'
            );
        }

        const [result] = await pool.execute(
            `INSERT INTO suppliers
             (business_name, contact_person, phone, province, address)
             VALUES (?, ?, ?, ?, ?)`,
            [
                businessName.trim(),
                contactPerson.trim(),
                phone.trim(),
                province,
                address.trim()
            ]
        );

        res.status(201).json({
            message: 'Supplier registered successfully.',
            supplierId: result.insertId
        });
    } catch (error) {
        handleError(next, error);
    }
};

exports.updateSupplier = async (req, res, next) => {
    try {
        const { businessName, contactPerson, phone, province, address } = req.body;

        if (![businessName, contactPerson, phone, province, address].every(
            v => typeof v === 'string' && v.trim()
        )) {
            throw httpError(
                'Provide business name, contact person, phone, province and address.'
            );
        }

        const [result] = await pool.execute(
            `UPDATE suppliers
             SET business_name=?, contact_person=?, phone=?, province=?, address=?
             WHERE supplier_id=?`,
            [
                businessName.trim(),
                contactPerson.trim(),
                phone.trim(),
                province,
                address.trim(),
                req.params.id
            ]
        );

        if (!result.affectedRows) throw httpError('Supplier not found.', 404);

        res.json({ message: 'Supplier updated successfully.' });
    } catch (error) {
        handleError(next, error);
    }
};

exports.deleteSupplier = async (req, res, next) => {
    try {
        const [used] = await pool.execute(
            'SELECT COUNT(*) AS total FROM purchases WHERE supplier_id = ?',
            [req.params.id]
        );

        if (Number(used[0].total) > 0) {
            throw httpError(
                'This supplier has purchase records and cannot be deleted.',
                409
            );
        }

        const [result] = await pool.execute(
            'DELETE FROM suppliers WHERE supplier_id = ?',
            [req.params.id]
        );

        if (!result.affectedRows) throw httpError('Supplier not found.', 404);

        res.json({ message: 'Supplier deleted successfully.' });
    } catch (error) {
        handleError(next, error);
    }
};

 // ---------------- FRUITS (NORMALIZED) ----------------

 exports.getFruits = async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                f.fruit_id,
                f.fruit_name,
                f.description,
                f.status,

                MAX(CASE
                    WHEN fp.packaging_size = 'SMALL'
                    THEN fp.selling_price
                END) AS small_price,

                MAX(CASE
                    WHEN fp.packaging_size = 'MEDIUM'
                    THEN fp.selling_price
                END) AS medium_price,

                MAX(CASE
                    WHEN fp.packaging_size = 'LARGE'
                    THEN fp.selling_price
                END) AS large_price

            FROM fruits f

            LEFT JOIN fruit_prices fp
                ON f.fruit_id = fp.fruit_id

            WHERE f.status = 'AVAILABLE'

            GROUP BY
                f.fruit_id,
                f.fruit_name,
                f.description,
                f.status

            ORDER BY f.fruit_name
        `);

        res.json(rows);
    } catch (error) {
        next(error);
    }
};


exports.createFruit = async (req, res, next) => {
    const connection = await pool.getConnection();

    try {
        const {
            fruitName,
            description = '',
            smallPrice,
            mediumPrice,
            largePrice
        } = req.body;

        const prices = [
            Number(smallPrice),
            Number(mediumPrice),
            Number(largePrice)
        ];

        if (
            typeof fruitName !== 'string' ||
            !fruitName.trim() ||
            prices.some(price => !Number.isFinite(price) || price < 0)
        ) {
            throw httpError(
                'Provide a fruit name and three valid non-negative prices.'
            );
        }

        await connection.beginTransaction();

        const [result] = await connection.execute(
            `INSERT INTO fruits
             (fruit_name, description, status)
             VALUES (?, ?, 'ACTIVE')`,
            [fruitName.trim(), description.trim()]
        );

        const fruitId = result.insertId;

        await connection.execute(
            `INSERT INTO fruit_prices
             (fruit_id, packaging_size, selling_price)
             VALUES
             (?, 'SMALL', ?),
             (?, 'MEDIUM', ?),
             (?, 'LARGE', ?)`,
            [
                fruitId, prices[0],
                fruitId, prices[1],
                fruitId, prices[2]
            ]
        );

        await connection.commit();

        res.status(201).json({
            message: 'Fruit registered successfully.',
            fruitId
        });

    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};



exports.updateFruit = async (req, res, next) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const fruitId = Number(req.params.id);

        const fruitName = req.body.fruitName ?? req.body.fruit_name;
        const description = req.body.description ?? '';

        const status = String(
            req.body.status ?? 'AVAILABLE'
        ).toUpperCase();

        const prices = [
            Number(req.body.smallPrice ?? req.body.small_price),
            Number(req.body.mediumPrice ?? req.body.medium_price),
            Number(req.body.largePrice ?? req.body.large_price)
        ];

        if (
            !Number.isInteger(fruitId) ||
            typeof fruitName !== 'string' ||
            !fruitName.trim() ||
            typeof description !== 'string' ||
            !['AVAILABLE', 'UNAVAILABLE'].includes(status) ||
            prices.some(price => !Number.isFinite(price) || price < 0)
        ) {
            throw httpError(
                'Provide a fruit name, valid status and three valid prices.'
            );
        }

        await connection.beginTransaction();

        // 1. Get the original fruit information
        const [fruitRows] = await connection.execute(
            `SELECT fruit_id, fruit_name, description, status
             FROM fruits
             WHERE fruit_id = ?
             FOR UPDATE`,
            [fruitId]
        );

        if (!fruitRows.length) {
            throw httpError('Fruit not found.', 404);
        }

        const oldFruit = fruitRows[0];

        // 2. Get the original prices
        const [oldPriceRows] = await connection.execute(
            `SELECT packaging_size, selling_price
             FROM fruit_prices
             WHERE fruit_id = ?`,
            [fruitId]
        );

        const oldPrices = {};

        oldPriceRows.forEach(price => {
            oldPrices[price.packaging_size.toLowerCase() + '_price'] =
                Number(price.selling_price);
        });

        const oldValues = {
            fruit_name: oldFruit.fruit_name,
            description: oldFruit.description,
            status: oldFruit.status,
            ...oldPrices
        };

        // 3. Update the fruit
        await connection.execute(
            `UPDATE fruits
             SET fruit_name = ?,
                 description = ?,
                 status = ?
             WHERE fruit_id = ?`,
            [
                fruitName.trim(),
                description.trim(),
                status,
                fruitId
            ]
        );

        // 4. Update the three selling prices
        await connection.execute(
            `INSERT INTO fruit_prices
             (fruit_id, packaging_size, selling_price)
             VALUES
             (?, 'SMALL', ?),
             (?, 'MEDIUM', ?),
             (?, 'LARGE', ?)
             ON DUPLICATE KEY UPDATE
             selling_price = VALUES(selling_price)`,
            [
                fruitId, prices[0],
                fruitId, prices[1],
                fruitId, prices[2]
            ]
        );

        // 5. Prepare the new information
        const newValues = {
            fruit_name: fruitName.trim(),
            description: description.trim(),
            status: status,
            small_price: prices[0],
            medium_price: prices[1],
            large_price: prices[2]
        };

        // 6. Save the editing history
        await connection.execute(
            `INSERT INTO activity_logs
             (module_name, record_id, record_name, action_type,
              old_values, new_values, changed_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                'Fruits',
                fruitId,
                fruitName.trim(),
                'UPDATED',
                JSON.stringify(oldValues),
                JSON.stringify(newValues),
                'Administrator'
            ]
        );

        // 7. Save all changes together
        await connection.commit();

        res.json({
            message: 'Fruit updated successfully. Editing history recorded.'
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        next(error);

    } finally {
        if (connection) {
            connection.release();
        }
    }
};



// ---------------- STOCK ----------------
exports.getStock = async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                f.fruit_id,
                f.fruit_name,

                COALESCE(MAX(CASE
                    WHEN s.packaging_size = 'SMALL'
                    THEN s.available_quantity
                END), 0) AS small_quantity,

                COALESCE(MAX(CASE
                    WHEN s.packaging_size = 'MEDIUM'
                    THEN s.available_quantity
                END), 0) AS medium_quantity,

                COALESCE(MAX(CASE
                    WHEN s.packaging_size = 'LARGE'
                    THEN s.available_quantity
                END), 0) AS large_quantity,

                CASE
                    WHEN COALESCE(SUM(s.available_quantity), 0) > 0
                    THEN 'AVAILABLE'
                    ELSE 'UNAVAILABLE'
                END AS overall_status

            FROM fruits f

            LEFT JOIN stock s
                ON f.fruit_id = s.fruit_id

            WHERE f.status = 'AVAILABLE'

            GROUP BY f.fruit_id, f.fruit_name
            ORDER BY f.fruit_name
        `);

        const formattedRows = rows.map(fruit => ({
            ...fruit,
            small_status:
                Number(fruit.small_quantity) > 0 ? 'AVAILABLE' :'UNAVAILABLE',
            medium_status:
                Number(fruit.medium_quantity) > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
            large_status:
                Number(fruit.large_quantity) > 0 ? 'AVAILABLE' : 'UNAVAILABLE'
        }));

        res.json(formattedRows);
    } catch (error) {
        handleError(next, error);
    }
};

exports.getLowStock = async (req, res, next) => {
    try {
        const limit = Number(process.env.LOW_STOCK_LIMIT || 8);

        const [rows] = await pool.execute(
            `SELECT
                f.fruit_id,
                f.fruit_name,
                s.packaging_size,
                s.available_quantity
             FROM stock s
             JOIN fruits f ON f.fruit_id = s.fruit_id
             WHERE s.available_quantity <= ?
             ORDER BY s.available_quantity ASC, f.fruit_name`,
            [limit]
        );

        res.json({
            threshold: limit,
            count: rows.length,
            items: rows
        });
    } catch (error) {
        handleError(next, error);
    }
};

// ---------------- VENDORS ----------------
exports.getVendors = async (req, res, next) => {
    try {
        const search = (req.query.search || '').trim();
        let rows;

        if (search) {
            [rows] = await pool.execute(
                `SELECT * FROM vendors
                 WHERE vendor_name LIKE ? OR phone_number LIKE ?
                 ORDER BY vendor_id DESC`,
                [`%${search}%`, `%${search}%`]
            );
        } else {
            [rows] = await pool.query(
                'SELECT * FROM vendors ORDER BY vendor_id DESC'
            );
        }

        res.json(rows);
    } catch (error) {
        handleError(next, error);
    }
};

exports.createVendor = async (req, res, next) => {
    try {
        const { vendorName, phoneNumber, location, registrationDate } = req.body;

        if (![vendorName, phoneNumber, location].every(
            v => typeof v === 'string' && v.trim()
        )) {
            throw httpError(
                'Vendor name, phone number and location are required.'
            );
        }

        const date = registrationDate || new Date().toISOString().slice(0, 10);

        const [result] = await pool.execute(
            `INSERT INTO vendors
             (vendor_name, phone_number, location, registration_date)
             VALUES (?, ?, ?, ?)`,
            [
                vendorName.trim(),
                phoneNumber.trim(),
                location.trim(),
                date
            ]
        );

        res.status(201).json({
            message: 'Vendor registered successfully.',
            vendorId: result.insertId
        });
    } catch (error) {
        handleError(next, error);
    }
};

exports.updateVendor = async (req, res, next) => {
    try {
        const { vendorName, phoneNumber, location, registrationDate } = req.body;

        if (![vendorName, phoneNumber, location, registrationDate].every(
            v => typeof v === 'string' && v.trim()
        )) {
            throw httpError(
                'Provide vendor name, phone number, location and registration date.'
            );
        }

        const [result] = await pool.execute(
            `UPDATE vendors
             SET vendor_name=?, phone_number=?, location=?, registration_date=?
             WHERE vendor_id=?`,
            [
                vendorName.trim(),
                phoneNumber.trim(),
                location.trim(),
                registrationDate,
                req.params.id
            ]
        );

        if (!result.affectedRows) throw httpError('Vendor not found.', 404);

        res.json({ message: 'Vendor updated successfully.' });
    } catch (error) {
        handleError(next, error);
    }
};
