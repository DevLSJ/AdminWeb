package com.ineb.dguard_kms.domain.key.service;

import org.springframework.http.HttpStatus;

public class KeyOperationException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;

    public KeyOperationException(HttpStatus status, String message, String errorCode) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
    }

    public HttpStatus getStatus() { return status; }
    public String getErrorCode() { return errorCode; }
}
