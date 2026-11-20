const pool = require('../config/db');

function httpError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

exports.topFruits = async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            `SELECT f.fruit_id, f.fruit_name, SUM(sd.quantity) AS boxes_sold
             FROM sales_details sd
             JOIN fruits f ON f.fruit_id = sd.fruit_id
             GROUP BY f.fruit_id, f.fruit_name
             ORDER BY boxes_sold DESC
             LIMIT 5`
        );
        res.json(rows);
    } catch (error) { next(error); }
};

exports.revenueByDate = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
            throw httpError('Provide startDate and endDate in YYYY-MM-DD format, with startDate not later than endDate.');
        }
        const [rows] = await pool.execute(
            `SELECT COALESCE(SUM(total_amount), 0) AS total_revenue, COUNT(*) AS number_of_sales
             FROM sales WHERE DATE(sale_date) BETWEEN ? AND ?`,
            [startDate, endDate]
        );
        res.json({ startDate, endDate, ...rows[0] });
    } catch (error) { next(error); }
};

exports.topVendor = async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            `SELECT v.vendor_id, v.vendor_name, v.phone_number,
                    SUM(sd.quantity) AS boxes_purchased
             FROM sales_details sd
             JOIN sales s ON s.sale_id = sd.sale_id
             JOIN vendors v ON v.vendor_id = s.vendor_id
             GROUP BY v.vendor_id, v.vendor_name, v.phone_number
             ORDER BY boxes_purchased DESC
             LIMIT 1`
        );
        res.json(rows[0] || { message: 'No sales have been recorded yet.' });
    } catch (error) { next(error); }
};

exports.stockReport = async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            `SELECT f.fruit_name, s.packaging_size, s.available_quantity
             FROM stock s JOIN fruits f ON f.fruit_id = s.fruit_id
             ORDER BY f.fruit_name, FIELD(s.packaging_size, 'SMALL', 'MEDIUM', 'LARGE')`
        );
        res.json(rows);
    } catch (error) { next(error); }
};

exports.vendorBalance = async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            `SELECT v.vendor_id, v.vendor_name,
                    COALESCE(SUM(s.total_amount), 0) AS total_purchases,
                    COALESCE(SUM(s.amount_paid), 0) AS total_paid,
                    COALESCE(SUM(s.total_amount - s.amount_paid), 0) AS outstanding_balance
             FROM vendors v LEFT JOIN sales s ON s.vendor_id = v.vendor_id
             WHERE v.vendor_id = ?
             GROUP BY v.vendor_id, v.vendor_name`,
            [req.params.id]
        );
        if (!rows.length) throw httpError('Vendor not found.', 404);
        res.json(rows[0]);
    } catch (error) { next(error); }
};

exports.allOutstandingBalances = async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            `SELECT v.vendor_id, v.vendor_name,
                    COALESCE(SUM(s.total_amount), 0) AS total_purchases,
                    COALESCE(SUM(s.amount_paid), 0) AS total_paid,
                    COALESCE(SUM(s.total_amount - s.amount_paid), 0) AS outstanding_balance
             FROM vendors v LEFT JOIN sales s ON s.vendor_id = v.vendor_id
             GROUP BY v.vendor_id, v.vendor_name
             ORDER BY outstanding_balance DESC`
        );
        res.json(rows);
    } catch (error) { next(error); }
};
