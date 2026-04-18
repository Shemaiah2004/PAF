export function notFoundHandler(req, _res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

export function errorHandler(error, req, res, _next) {
  const status =
    error.name === "ValidationError"
      ? 400
      : error.name === "MongoServerError" && error.code === 11000
        ? 409
        : error.status ?? 500;
  const payload = {
    message:
      error.name === "MongoServerError" && error.code === 11000
        ? "A record with that value already exists."
        : error.message ?? "Internal server error.",
  };

  if (error.details) {
    payload.details = error.details;
  }

  console.error("[ticketing-api] Request failed", {
    method: req.method,
    path: req.originalUrl,
    status,
    message: payload.message,
    details: error.details,
    stack: error.stack,
  });

  res.status(status).json(payload);
}
