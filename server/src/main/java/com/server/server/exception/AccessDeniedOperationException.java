package com.server.server.exception;

public class AccessDeniedOperationException extends RuntimeException {
    public AccessDeniedOperationException(String message) {
        super(message);
    }
}
