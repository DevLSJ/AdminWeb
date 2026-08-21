package com.ineb.dguard_kms.domain.key.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ineb.dguard_kms.common.ApiResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyCreateRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyDecryptRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyDecryptResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyDistributionRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyDistributionResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyEncryptRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyEncryptResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyHistoryResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyRotationResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyStatusChangeRequest;
import com.ineb.dguard_kms.domain.key.service.CryptoKeyService;

import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/keys")
public class CryptoKeyController {

    private final CryptoKeyService keyService;

    public CryptoKeyController(CryptoKeyService keyService) {
        this.keyService = keyService;
    }

    @GetMapping
    public ApiResponse<List<KeyResponse>> findAll() {
        return ApiResponse.success(keyService.findAll(), "키 목록 조회에 성공했습니다.");
    }

    @GetMapping("/{keyUid}")
    public ApiResponse<KeyResponse> find(@PathVariable UUID keyUid) {
        return ApiResponse.success(keyService.find(keyUid), "키 조회에 성공했습니다.");
    }

    @GetMapping("/{keyUid}/history")
    public ApiResponse<List<KeyHistoryResponse>> history(@PathVariable UUID keyUid) {
        return ApiResponse.success(keyService.history(keyUid), "키 상태 이력 조회에 성공했습니다.");
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<KeyResponse> create(
            @Valid @RequestBody KeyCreateRequest request,
            Authentication authentication
    ) {
        return ApiResponse.success(keyService.create(request, authentication.getName()), "키 생성에 성공했습니다.");
    }

    @PatchMapping("/{keyUid}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<KeyResponse> changeStatus(
            @PathVariable UUID keyUid,
            @Valid @RequestBody KeyStatusChangeRequest request,
            Authentication authentication
    ) {
        return ApiResponse.success(
                keyService.changeStatus(keyUid, request, authentication.getName()),
                "키 상태 변경에 성공했습니다."
        );
    }

    @PostMapping("/{keyUid}/rotate")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<KeyRotationResponse> rotate(
            @PathVariable UUID keyUid,
            Authentication authentication
    ) {
        return ApiResponse.success(keyService.rotate(keyUid, authentication.getName()), "키 갱신에 성공했습니다.");
    }

    @PostMapping("/{keyUid}/distribute")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<KeyDistributionResponse> distribute(
            @PathVariable UUID keyUid,
            @Valid @RequestBody KeyDistributionRequest request,
            Authentication authentication
    ) {
        return ApiResponse.success(
                keyService.distribute(keyUid, request, authentication.getName()),
                "키 배포에 성공했습니다."
        );
    }

    @PostMapping("/{keyUid}/test/encrypt")
    public ApiResponse<KeyEncryptResponse> encrypt(
            @PathVariable UUID keyUid,
            @Valid @RequestBody KeyEncryptRequest request,
            Authentication authentication
    ) {
        return ApiResponse.success(
                keyService.encrypt(keyUid, request, authentication.getName()),
                "암호화에 성공했습니다."
        );
    }

    @PostMapping("/{keyUid}/test/decrypt")
    public ApiResponse<KeyDecryptResponse> decrypt(
            @PathVariable UUID keyUid,
            @Valid @RequestBody KeyDecryptRequest request,
            Authentication authentication
    ) {
        return ApiResponse.success(
                keyService.decrypt(keyUid, request, authentication.getName()),
                "복호화에 성공했습니다."
        );
    }
}
