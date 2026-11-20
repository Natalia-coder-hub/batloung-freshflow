function errorHandler(err, req, res, next) {
    console.error(err.message);

    res.status(err.statusCode || 500).json({
        success: false,
        message: err.statusCode
            ? err.message
            : 'An unexpected server error occurred.'
    });
}

module.exports = errorHandler;