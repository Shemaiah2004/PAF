package com.server.server.user.exception;

public class InvalidRoleRequestException extends RuntimeException {

    public InvalidRoleRequestException(String message) {
        super(message);
    }
}
