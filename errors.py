from flask import Flask, jsonify


class AppError(Exception):
    """Base application error."""
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class ValidationError(AppError):
    """Raised when request validation fails (HTTP 400)."""
    def __init__(self, message: str = "Validation error"):
        super().__init__(message, status_code=400)


class NotFoundError(AppError):
    """Raised when a resource is not found (HTTP 404)."""
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=404)


def register_error_handlers(app: Flask) -> None:
    """Register error handlers on the given Flask app for unified JSON error responses."""
    from werkzeug.exceptions import HTTPException

    @app.errorhandler(AppError)
    def handle_app_error(error: AppError):
        response = jsonify({"error": error.message})
        response.status_code = error.status_code
        return response

    @app.errorhandler(HTTPException)
    def handle_http_exception(error: HTTPException):
        response = jsonify({"error": error.description})
        response.status_code = error.code
        return response

    @app.errorhandler(Exception)
    def handle_generic_exception(error: Exception):
        # Log the full exception to server logs if needed
        # app.logger.error('Unhandled Exception: %s', error, exc_info=True)
        response = jsonify({"error": "Internal server error"})
        response.status_code = 500
        return response
