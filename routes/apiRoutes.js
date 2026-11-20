
const express = require('express');
const router = express.Router();

const pool = require('../config/db');

const transactionController = require('../controllers/transactionController');
const catalogController = require('../controllers/catalogController');
const reportController = require('../controllers/reportController');

// DATABASE HEALTH CHECK
router.get('/health', async (req, res) => {
    try {
        const [result] = await pool.query(
            'SELECT DATABASE() AS databaseName'
        );

        res.status(200).json({
            success: true,
            message: 'Database connected successfully!',
            database: result[0].databaseName
        });

    } catch (error) {
        res.status(503).json({
            success: false,
            message: 'Database connection failed.'
        });
    }
});

// SUPPLIER ROUTES
router.get('/suppliers', catalogController.getSuppliers);
router.get('/suppliers/:id', catalogController.getSupplierById);
router.post('/suppliers', catalogController.createSupplier);
router.put('/suppliers/:id', catalogController.updateSupplier);
router.delete('/suppliers/:id', catalogController.deleteSupplier);

// FRUIT ROUTES
router.get('/fruits', catalogController.getFruits);
router.post('/fruits', catalogController.createFruit);
router.put('/fruits/:id', catalogController.updateFruit);

// STOCK ROUTES
router.get('/stock', catalogController.getStock);
router.get('/stock/low', catalogController.getLowStock);

// VENDOR ROUTES
router.get('/vendors', catalogController.getVendors);
router.post('/vendors', catalogController.createVendor);
router.put('/vendors/:id', catalogController.updateVendor);

// PURCHASE ROUTES
router.get('/purchases', transactionController.getPurchases);
router.post('/purchases', transactionController.createPurchase);

// SALES ROUTES
router.get('/sales', transactionController.getSales);
router.post('/sales', transactionController.createSale);

// PAYMENT ROUTES
router.post('/sales/:saleId/payments', transactionController.recordPayment);

// REPORT ROUTES
router.get('/reports/top-fruits', reportController.topFruits);
router.get('/reports/revenue', reportController.revenueByDate);
router.get('/reports/top-vendor', reportController.topVendor);
router.get('/reports/stock', reportController.stockReport);
router.get('/reports/vendor-balance/:id', reportController.vendorBalance);
router.get('/reports/outstanding-balances', reportController.allOutstandingBalances);

module.exports = router;
