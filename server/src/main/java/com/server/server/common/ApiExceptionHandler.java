package com.server.server.common;

import com.server.server.auth.exception.AuthConfigurationException;
import com.server.server.auth.exception.DuplicateEmailException;
import com.server.server.auth.exception.ForbiddenAccessException;
import com.server.server.auth.exception.InvalidCredentialsException;
import com.server.server.user.exception.InvalidRoleRequestException;
import com.server.server.user.exception.RoleRequestNotFoundException;
import com.server.server.user.exception.UserNotFoundException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(DuplicateEmailException.class)
    public ResponseEntity<ApiError> handleDuplicateEmail(DuplicateEmailException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(exception.getMessage()));
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ApiError> handleInvalidCredentials(InvalidCredentialsException exception) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ApiError(exception.getMessage()));
    }

    @ExceptionHandler(ForbiddenAccessException.class)
    public ResponseEntity<ApiError> handleForbiddenAccess(ForbiddenAccessException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ApiError(exception.getMessage()));
    }

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ApiError> handleUserNotFound(UserNotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(exception.getMessage()));
    }

    @ExceptionHandler(RoleRequestNotFoundException.class)
    public ResponseEntity<ApiError> handleRoleRequestNotFound(RoleRequestNotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(exception.getMessage()));
    }

    @ExceptionHandler(InvalidRoleRequestException.class)
    public ResponseEntity<ApiError> handleInvalidRoleRequest(InvalidRoleRequestException exception) {
        return ResponseEntity.badRequest().body(new ApiError(exception.getMessage()));
    }

    @ExceptionHandler(AuthConfigurationException.class)
    public ResponseEntity<ApiError> handleAuthConfiguration(AuthConfigurationException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(new ApiError(exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        FieldError fieldError = exception.getBindingResult().getFieldError();
        String message = fieldError != null ? fieldError.getDefaultMessage() : "Invalid request";
        return ResponseEntity.badRequest().body(new ApiError(message));
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ApiError> handleDatabaseError(DataAccessException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ApiError("MongoDB connection is unavailable. Check MONGODB_URI or MONGODB_PASSWORD."));
    }
}
