package com.ineb.dguard_kms.common;

import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.ineb.dguard_kms.domain.key.service.KeyOperationException;
import com.ineb.dguard_kms.domain.user.service.UserOperationException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuthentication(AuthenticationException exception) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.failure("아이디 또는 비밀번호가 올바르지 않습니다", "AUTHENTICATION_FAILED"));
    }

    @ExceptionHandler({ MethodArgumentNotValidException.class, BindException.class })
    public ResponseEntity<ApiResponse<Void>> handleValidation(BindException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getDefaultMessage() == null ? error.getField() + " 입력값을 확인하세요." : error.getDefaultMessage())
                .distinct()
                .collect(Collectors.joining(" "));
        return ResponseEntity.badRequest().body(ApiResponse.failure(message, "VALIDATION_FAILED"));
    }

    @ExceptionHandler(KeyOperationException.class)
    public ResponseEntity<ApiResponse<Void>> handleKeyOperation(KeyOperationException exception) {
        return ResponseEntity.status(exception.getStatus())
                .body(ApiResponse.failure(exception.getMessage(), exception.getErrorCode()));
    }

    @ExceptionHandler(UserOperationException.class)
    public ResponseEntity<ApiResponse<Void>> handleUserOperation(UserOperationException exception) {
        return ResponseEntity.status(exception.getStatus())
                .body(ApiResponse.failure(exception.getMessage(), exception.getErrorCode()));
    }

    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> handleStatus(org.springframework.web.server.ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode())
                .body(ApiResponse.failure(exception.getReason(), "HTTP_" + exception.getStatusCode().value()));
    }

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleUploadSize(org.springframework.web.multipart.MaxUploadSizeExceededException exception) {
        return ResponseEntity.badRequest().body(ApiResponse.failure("첨부파일은 개별 10MB, 요청당 101MB 이하여야 합니다.", "UPLOAD_TOO_LARGE"));
    }

    @ExceptionHandler(org.springframework.dao.OptimisticLockingFailureException.class)
    public ResponseEntity<ApiResponse<Void>> handleConcurrentSettingsUpdate(org.springframework.dao.OptimisticLockingFailureException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.failure("다른 관리자가 변경했습니다. 새로고침 후 다시 저장하세요.", "SETTINGS_VERSION_CONFLICT"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.failure(exception.getMessage(), "INVALID_REQUEST"));
    }
}
