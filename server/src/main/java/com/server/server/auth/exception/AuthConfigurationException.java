package com.server.server.auth.exception;

public class AuthConfigurationException extends RuntimeException {

    public AuthConfigurationException(String message) {
        super(message);
    }

    public AuthConfigurationException(String message, Throwable cause) {
        super(message, cause);
    }
}
