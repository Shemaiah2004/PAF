package com.server.server.exception;

public class InvalidTicketTransitionException extends RuntimeException {
    public InvalidTicketTransitionException(String message) {
        super(message);
    }
}
