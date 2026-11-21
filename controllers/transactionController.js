
const pool = require('../config/db');
const stockModel = require('../models/stockModels');

function httpError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function validPositiveId(value) {
    return Number.isInteger(Number(value)) && Number(value) > 0;
}

// GET ALL PURCHASES
exports.getPurchases = async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                p.purchase_id,
                p.supplier_id,
                s.business_name,
                p.purchase_date,
                p.total_amount,
                pd.purchase_detail_id,
                pd.fruit_id,
                f.fruit_name,
                pd.quantity,
                pd.unit_cost,
                pd.packaging_size
            FROM purchases p
            JOIN suppliers s ON p.supplier_id = s.supplier_id
            JOIN purchase_details pd ON p.purchase_id = pd.purchase_id
            JOIN fruits f ON pd.fruit_id = f.fruit_id
            ORDER BY p.purchase_date DESC
        `);

        res.json(rows);
    } catch (error) {
        next(error);
    }
};

// RECORD A PURCHASE
exports.createPurchase = async (req, res, next) => {
    const connection = await pool.getConnection();

    try {
        const { supplierId, items } = req.body;

        if (!validPositiveId(supplierId) || !Array.isArray(items) || items.length === 0) {
            throw httpError('A valid supplierId and at least one purchase item are required.');
        }

        await connection.beginTransaction();

        const [supplier] = await connection.execute(
            'SELECT supplier_id FROM suppliers WHERE supplier_id=?',
            [supplierId]
        );

        if (!supplier.length) throw httpError('Supplier does not exist.', 404);

        let total = 0;
        const preparedItems = [];

        for (const item of items) {
            const fruitId = Number(item.fruitId);
            const quantity = Number(item.quantity);
            const unitCost = Number(item.unitCost);
            const packagingSize = String(item.packagingSize || '').toUpperCase();

            if (
                !validPositiveId(fruitId) ||
                !Number.isInteger(quantity) ||
                quantity <= 0 ||
                !Number.isFinite(unitCost) ||
                unitCost < 0 ||
                !stockModel.ALLOWED_SIZES.includes(packagingSize)
            ) {
                throw httpError('Each item needs a valid fruitId, positive whole-number quantity, non-negative unitCost and valid packagingSize.');
            }

            const [fruit] = await connection.execute(
                "SELECT fruit_id FROM fruits WHERE fruit_id=? AND status='ACTIVE'",
                [fruitId]
            );

            if (!fruit.length) {
                throw httpError(`Active fruit with ID ${fruitId} was not found.`, 404);
            }

            total += quantity * unitCost;

            preparedItems.push({
                fruitId,
                quantity,
                unitCost,
                packagingSize
            });
        }

        total = Number(total.toFixed(2));

        const [purchaseResult] = await connection.execute(
            'INSERT INTO purchases (supplier_id, total_amount) VALUES (?, ?)',
            [supplierId, total]
        );

        const purchaseId = purchaseResult.insertId;

        for (const item of preparedItems) {
            await connection.execute(
                `INSERT INTO purchase_details
                (purchase_id, fruit_id, quantity, unit_cost, packaging_size)
                VALUES (?, ?, ?, ?, ?)`,
                [
                    purchaseId,
                    item.fruitId,
                    item.quantity,
                    item.unitCost,
                    item.packagingSize
                ]
            );

            await stockModel.increaseStock(
                connection,
                item.fruitId,
                item.packagingSize,
                item.quantity
            );
        }

        await connection.commit();

        res.status(201).json({
            message: 'Purchase recorded and stock increased.',
            purchaseId,
            totalAmount: total
        });

    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};

// GET ALL SALES
exports.getSales = async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                s.sale_id,
                s.vendor_id,
                v.vendor_name,
                s.sale_date,
                s.payment_method,
                s.payment_status,
                s.total_amount,
                s.amount_paid,
                (s.total_amount - s.amount_paid) AS outstanding_balance,
                sd.sales_detail_id,
                sd.fruit_id,
                f.fruit_name,
                sd.packaging_size,
                sd.quantity,
                sd.unit_price
            FROM sales s
            JOIN vendors v ON s.vendor_id = v.vendor_id
            JOIN sales_details sd ON s.sale_id = sd.sale_id
            JOIN fruits f ON sd.fruit_id = f.fruit_id
            ORDER BY s.sale_date DESC
        `);

        res.json(rows);
    } catch (error) {
        next(error);
    }
};

// RECORD A SALE
exports.createSale = async (req, res, next) => {
    const connection = await pool.getConnection();

    try {
        const {
            vendorId,
            items,
            paymentMethod = 'CASH',
            amountPaid = 0
        } = req.body;

        const method = String(paymentMethod).toUpperCase();
        const paid = Number(amountPaid);
        const allowedMethods = ['CASH', 'MOBILE_MONEY', 'CREDIT'];

        if (!validPositiveId(vendorId) || !Array.isArray(items) || items.length === 0) {
            throw httpError('A valid vendorId and at least one sale item are required.');
        }

        if (!allowedMethods.includes(method)) {
            throw httpError('Payment method must be CASH, MOBILE_MONEY or CREDIT.');
        }

        if (!Number.isFinite(paid) || paid < 0) {
            throw httpError('amountPaid must be zero or a positive amount.');
        }

        await connection.beginTransaction();

        const [vendor] = await connection.execute(
            'SELECT vendor_id FROM vendors WHERE vendor_id=?',
            [vendorId]
        );

        if (!vendor.length) throw httpError('Vendor does not exist.', 404);

        let total = 0;
        const preparedItems = [];

        for (const item of items) {
            const fruitId = Number(item.fruitId);
            const quantity = Number(item.quantity);
            const packagingSize = String(item.packagingSize || '').toUpperCase();

            if (
                !validPositiveId(fruitId) ||
                !Number.isInteger(quantity) ||
                quantity <= 0 ||
                !stockModel.ALLOWED_SIZES.includes(packagingSize)
            ) {
                throw httpError('Each sale item needs a valid fruitId, positive whole-number quantity and valid packagingSize.');
            }

            const priceColumn = {
                SMALL: 'small_price',
                MEDIUM: 'medium_price',
                LARGE: 'large_price'
            }[packagingSize];

            const [fruitRows] = await connection.execute(
                `SELECT fruit_id, fruit_name, ${priceColumn} AS unit_price
                 FROM fruits
                 WHERE fruit_id=? AND status='ACTIVE'`,
                [fruitId]
            );

            if (!fruitRows.length) {
                throw httpError(`Active fruit with ID ${fruitId} was not found.`, 404);
            }

            const available = await stockModel.getStockForUpdate(
                connection,
                fruitId,
                packagingSize
            );

            if (available < quantity) {
                throw httpError(
                    `Not enough ${packagingSize.toLowerCase()} stock for ${fruitRows[0].fruit_name}. Available: ${available}; requested: ${quantity}. The entire sale was cancelled.`,
                    400
                );
            }

            const unitPrice = Number(fruitRows[0].unit_price);

            const reduced = await stockModel.decreaseStock(
                connection,
                fruitId,
                packagingSize,
                quantity
            );

            if (!reduced) {
                throw httpError('Stock changed during this sale. Please try again.', 409);
            }

            total += quantity * unitPrice;

            preparedItems.push({
                fruitId,
                quantity,
                packagingSize,
                unitPrice
            });
        }

        total = Number(total.toFixed(2));

        if (paid > total) {
            throw httpError('The amount paid cannot be greater than the sale total.');
        }

        const paymentStatus =
            paid >= total ? 'PAID' :
            paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

        const [saleResult] = await connection.execute(
            `INSERT INTO sales
            (vendor_id, payment_method, payment_status, total_amount, amount_paid)
            VALUES (?, ?, ?, ?, ?)`,
            [vendorId, method, paymentStatus, total, paid]
        );

        const saleId = saleResult.insertId;

        for (const item of preparedItems) {
            await connection.execute(
                `INSERT INTO sales_details
                (sale_id, fruit_id, packaging_size, quantity, unit_price)
                VALUES (?, ?, ?, ?, ?)`,
                [
                    saleId,
                    item.fruitId,
                    item.packagingSize,
                    item.quantity,
                    item.unitPrice
                ]
            );
        }

        await connection.commit();

        res.status(201).json({
            message: 'Sale completed successfully.',
            saleId,
            totalAmount: total,
            amountPaid: paid,
            outstandingBalance: Number((total - paid).toFixed(2)),
            paymentStatus
        });

    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};

// RECORD A PAYMENT
exports.recordPayment = async (req, res, next) => {
    const connection = await pool.getConnection();

    try {
        const saleId = Number(req.params.saleId);
        const amount = Number(req.body.amount);
        const method = String(req.body.paymentMethod || '').toUpperCase();

        if (!validPositiveId(saleId) || !Number.isFinite(amount) || amount <= 0) {
            throw httpError('Provide a valid sale ID and a payment amount greater than zero.');
        }

        if (!['CASH', 'MOBILE_MONEY', 'CREDIT'].includes(method)) {
            throw httpError('Payment method must be CASH, MOBILE_MONEY or CREDIT.');
        }

        await connection.beginTransaction();

        const [rows] = await connection.execute(
            'SELECT * FROM sales WHERE sale_id=? FOR UPDATE',
            [saleId]
        );

        if (!rows.length) throw httpError('Sale not found.', 404);

        const sale = rows[0];
        const outstanding = Number(sale.total_amount) - Number(sale.amount_paid);

        if (amount > outstanding) {
            throw httpError(`Payment exceeds the outstanding balance of ${outstanding.toFixed(2)}.`);
        }

        const newPaid = Number((Number(sale.amount_paid) + amount).toFixed(2));
        const status =
            newPaid >= Number(sale.total_amount) ? 'PAID' : 'PARTIALLY_PAID';

        await connection.execute(
            `UPDATE sales
             SET amount_paid=?, payment_status=?, payment_method=?
             WHERE sale_id=?`,
            [newPaid, status, method, saleId]
        );

        await connection.commit();

        res.json({
            message: 'Payment recorded successfully.',
            saleId,
            amountPaid: newPaid,
            outstandingBalance: Number(
                (Number(sale.total_amount) - newPaid).toFixed(2)
            ),
            paymentStatus: status
        });

    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};
