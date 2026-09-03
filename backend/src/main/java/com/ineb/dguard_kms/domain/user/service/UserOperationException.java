package com.ineb.dguard_kms.domain.user.service;

import java.util.UUID;

import org.springframework.http.HttpStatus;

public class UserOperationException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;

    private UserOperationException(HttpStatus status, String errorCode, String message) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
    }

    public static UserOperationException notFound(UUID userUid) {
        return new UserOperationException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다: " + userUid);
    }

    public static UserOperationException duplicate(String field) {
        return new UserOperationException(HttpStatus.CONFLICT, "USER_DUPLICATE", "이미 등록된 " + field + "입니다.");
    }

    public static UserOperationException integrityViolation(UUID userUid) {
        return new UserOperationException(
                HttpStatus.CONFLICT,
                "USER_INTEGRITY_VIOLATION",
                "사용자 개인정보 무결성 검증에 실패했습니다. 원문 조회와 변경을 차단합니다: " + userUid
        );
    }

    public static UserOperationException forbidden(String message) {
        return new UserOperationException(HttpStatus.FORBIDDEN, "FORBIDDEN", message);
    }

    public HttpStatus getStatus() { return status; }
    public String getErrorCode() { return errorCode; }
}
