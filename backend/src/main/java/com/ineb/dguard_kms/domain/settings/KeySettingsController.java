package com.ineb.dguard_kms.domain.settings;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import com.ineb.dguard_kms.common.ApiResponse;

@RestController
@RequestMapping("/api/settings")
@PreAuthorize("isAuthenticated()")
public class KeySettingsController {
    private final KeySettingsService service;
    public KeySettingsController(KeySettingsService service) { this.service = service; }
    @GetMapping("/key-codes")
    public ApiResponse<List<KeySettingsService.CodeResponse>> codes() {
        return ApiResponse.success(service.codes(), "공통코드를 조회했습니다.");
    }
    @GetMapping("/key-policy")
    public ApiResponse<KeySettingsService.PolicyResponse> policy() {
        return ApiResponse.success(service.policy(), "키 정책을 조회했습니다.");
    }
    @PatchMapping("/key-codes/{group}/{code}")
    @PreAuthorize("hasRole('S.ADMIN')")
    public ApiResponse<KeySettingsService.CodeResponse> updateCode(@PathVariable String group, @PathVariable String code,
            @Valid @RequestBody CodeUpdate request, Authentication actor) {
        return ApiResponse.success(service.updateCode(group, code, request, actor.getName()), "공통코드를 저장했습니다.");
    }
    @PutMapping("/key-policy")
    @PreAuthorize("hasRole('S.ADMIN')")
    public ApiResponse<KeySettingsService.PolicyResponse> updatePolicy(@Valid @RequestBody PolicyUpdate request, Authentication actor) {
        return ApiResponse.success(service.updatePolicy(request, actor.getName()), "키 정책을 저장했습니다.");
    }
    public record PolicyUpdate(@NotNull @Min(1) @Max(3650) Integer defaultValidityDays,
            @NotNull @Min(1) @Max(365) Integer expiryWarningDays, @NotNull @PositiveOrZero Long version,
            @NotBlank @Size(min=2, max=200) String reason) { }
    public record CodeUpdate(@NotBlank @Size(max=80) String label, @NotNull @Size(max=200) String description,
            @NotNull @Min(0) @Max(999) Integer sortOrder, @NotNull Boolean enabled,
            @NotNull @PositiveOrZero Long version, @NotBlank @Size(min=2, max=200) String reason) { }
}
