/**
 * MediNexus One - Centralized Error Handler
 * 
 * Intercepts uncaught errors, formats structured JSON responses,
 * and hides sensitive internal stack traces from client responses in production.
 */

export function errorHandler(err, req, res, _next) {
  const statusCode = err.status || err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const isProduction = process.env.NODE_ENV === "production";

  console.error(`[Error] [${req.method}] ${req.url} -> ${statusCode}:`, err.message);

  res.status(statusCode).json({
    error: err.name || "InternalServerError",
    message: err.message || "An unexpected error occurred. Please try again later.",
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    ...(isProduction ? {} : { stack: err.stack }),
  });
}
