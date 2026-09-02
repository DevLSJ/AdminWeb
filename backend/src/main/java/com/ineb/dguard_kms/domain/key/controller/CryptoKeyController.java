package com.ineb.dguard_kms.domain.key.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.ineb.dguard_kms.common.ApiResponse;
import com.ineb.dguard_kms.common.PageResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyCreateRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyDecryptRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyDecryptResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyDistributionRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyDistributionResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyEncryptRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyEncryptResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyHistoryResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyIntegrityReportResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyRotationPolicyRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyRotationResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyStatusChangeRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyUpdateRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyUsageSummaryResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyVersionResponse;
import com.ineb.dguard_kms.domain.key.entity.KeyStatus;
import com.ineb.dguard_kms.domain.key.service.CryptoKeyService;

import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/keys")
@Tag(name = "Keys")
public class CryptoKeyController {

    private final CryptoKeyService keyService;

    public CryptoKeyController(CryptoKeyService keyService) {
        this.keyService = keyService;
    }

    @GetMapping
    @Operation(summary = "키 목록 조회")
    public ApiResponse<PageResponse<KeyResponse>> findAll(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String algorithm,
            @RequestParam(required = false) KeyStatus status,
            @RequestParam(required = false) String purpose,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer expiringWithinDays,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {
        return ApiResponse.success(
                keyService.findAll(
                        keyword, algorithm, status, purpose, category, expiringWithinDays, page, size, sort
                ),
                "키 목록 조회에 성공했습니다."
        );
    }

    @GetMapping("/{keyUid}")
    @Operation(summary = "키 상세 조회")
    public ApiResponse<KeyResponse> find(@PathVariable UUID keyUid) {
        return ApiResponse.success(keyService.find(keyUid), "키 조회에 성공했습니다.");
    }

    @GetMapping("/{keyUid}/history")
    @Operation(summary = "키 상태 이력 조회")
    public ApiResponse<List<KeyHistoryResponse>> history(@PathVariable UUID keyUid) {
        return ApiResponse.success(keyService.history(keyUid), "키 상태 이력 조회에 성공했습니다.");
    }

    @GetMapping("/{keyUid}/usage")
    @Operation(summary = "키 사용 통계 조회")
    public ApiResponse<KeyUsageSummaryResponse> usage(@PathVariable UUID keyUid) {
        return ApiResponse.success(keyService.usage(keyUid), "키 사용 통계 조회에 성공했습니다.");
    }

    @GetMapping("/{keyUid}/versions")
    @Operation(summary = "키 버전 목록 조회")
    public ApiResponse<List<KeyVersionResponse>> versions(@PathVariable UUID keyUid) {
        return ApiResponse.success(keyService.versions(keyUid), "키 버전 조회에 성공했습니다.");
    }

    @PostMapping("/integrity/verify")
    @Operation(summary = "전체 키 무결성 검증", description = "메타데이터와 모든 키 버전의 HMAC 및 폐기 키 NULL 여부를 검사합니다.")
    @PreAuthorize("hasAnyRole('ADMIN', 'S.ADMIN')")
    public ApiResponse<KeyIntegrityReportResponse> verifyAllIntegrity() {
        return ApiResponse.success(keyService.verifyAllIntegrity(), "전체 키 무결성 검증이 완료되었습니다.");
    }

    @GetMapping("/integrity")
    @Operation(summary = "최근 시점 전체 키 무결성 리포트")
    @PreAuthorize("hasAnyRole('ADMIN', 'S.ADMIN')")
    public ApiResponse<KeyIntegrityReportResponse> integrityReport() {
        return ApiResponse.success(keyService.verifyAllIntegrity(), "전체 키 무결성 리포트 조회에 성공했습니다.");
    }

    @PostMapping
    @Operation(summary = "키 생성", description = "AES-256 키를 생성하고 암호화된 키 재료를 저장합니다.")
    @PreAuthorize("hasAnyRole('ADMIN', 'S.ADMIN')")
    public ApiResponse<KeyResponse> create(
            @Valid @RequestBody KeyCreateRequest request,
            Authentication authentication
    ) {
        return ApiResponse.success(keyService.create(request, authentication.getName()), "키 생성에 성공했습니다.");
    }

    @PutMapping("/{keyUid}")
    @Operation(summary = "키 메타정보 수정")
    @PreAuthorize("hasAnyRole('ADMIN', 'S.ADMIN')")
    public ApiResponse<KeyResponse> update(
            @PathVariable UUID keyUid,
            @Valid @RequestBody KeyUpdateRequest request,
            Authentication authentication
    ) {
        return ApiResponse.success(
                keyService.update(keyUid, request, authentication.getName()), "키 메타정보 수정에 성공했습니다."
        );
    }

    @DeleteMapping("/{keyUid}")
    @Operation(summary = "키 즉시 폐기", description = "모든 버전의 원시 키를 제로화하고 DESTROYED로 전환합니다. 메타데이터와 감사 이력은 보존합니다.")
    @PreAuthorize("hasAnyRole('ADMIN', 'S.ADMIN')")
    public ApiResponse<Void> delete(
            @PathVariable UUID keyUid,
            Authentication authentication
    ) {
        keyService.delete(keyUid, authentication.getName());
        return ApiResponse.success(null, "키 재료가 제로화되어 폐기되었습니다.");
    }

    @PatchMapping("/{keyUid}/rotation-policy")
    @Operation(summary = "자동 갱신 정책 변경")
    @PreAuthorize("hasAnyRole('ADMIN', 'S.ADMIN')")
    public ApiResponse<KeyResponse> updateRotationPolicy(
            @PathVariable UUID keyUid,
            @Valid @RequestBody KeyRotationPolicyRequest request,
            Authentication authentication
    ) {
        return ApiResponse.success(
                keyService.updateRotationPolicy(keyUid, request, authentication.getName()),
                "자동 갱신 정책 수정에 성공했습니다."
        );
    }

    @PatchMapping("/{keyUid}/status")
    @Operation(summary = "키 상태 변경")
    @PreAuthorize("hasAnyRole('ADMIN', 'S.ADMIN')")
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
    @Operation(summary = "키 갱신", description = "새 키 버전을 생성하고 이전 버전을 복호화 전용으로 전환합니다.")
    @PreAuthorize("hasAnyRole('ADMIN', 'S.ADMIN')")
    public ApiResponse<KeyRotationResponse> rotate(
            @PathVariable UUID keyUid,
            Authentication authentication
    ) {
        return ApiResponse.success(keyService.rotate(keyUid, authentication.getName()), "키 갱신에 성공했습니다.");
    }

    @PostMapping("/{keyUid}/distribute")
    @Operation(summary = "키 배포")
    @PreAuthorize("hasAnyRole('ADMIN', 'S.ADMIN')")
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
    @Operation(summary = "암호화 테스트")
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
    @Operation(summary = "복호화 테스트")
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
