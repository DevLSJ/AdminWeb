package com.ineb.dguard_kms.domain.notice.service;

import org.springframework.http.HttpStatus;

public class NoticeFileOperationException extends RuntimeException {
    private final HttpStatus status;
    private final String errorCode;

    public NoticeFileOperationException(HttpStatus status, String errorCode, String message) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
    }

    public HttpStatus getStatus() { return status; }
    public String getErrorCode() { return errorCode; }
}
