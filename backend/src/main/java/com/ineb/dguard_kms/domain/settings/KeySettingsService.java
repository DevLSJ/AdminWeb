package com.ineb.dguard_kms.domain.settings;

import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ineb.dguard_kms.domain.audit.service.AuditLogService;
import com.ineb.dguard_kms.domain.key.entity.KeyStatus;
import com.ineb.dguard_kms.domain.key.service.KeyOperationException;

@Service
@Transactional(readOnly = true)
public class KeySettingsService {
    public static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final Map<String, List<String>> PURPOSES = Map.of("AES", List.of("ENCRYPT", "WRAP"), "RSA", List.of("ENCRYPT"));
    private final CommonCodeRepository codes;
    private final KeyPolicyRepository policies;
    private final AuditLogService audit;
    private final Clock clock;
    public KeySettingsService(CommonCodeRepository codes, KeyPolicyRepository policies, AuditLogService audit, Clock keyPolicyClock) {
        this.codes = codes; this.policies = policies; this.audit = audit; this.clock = keyPolicyClock;
    }
    public LocalDate today() { return LocalDate.now(clock.withZone(KST)); }
    public LocalDate defaultExpiry() { return today().plusDays(policyEntity().getDefaultValidityDays()); }
    public int warningDays() { return policyEntity().getExpiryWarningDays(); }
    public int resolveWarningDays(Integer requested) {
        int days = requested == null ? warningDays() : requested;
        if (days < 1 || days > 365) throw invalid("만료 알림일은 1~365일이어야 합니다.");
        return days;
    }
    public PolicyResponse policy() { return policyResponse(policyEntity()); }
    public List<CodeResponse> codes() {
        return codes.findAll().stream().sorted(Comparator.comparing(CommonCode::getGroup).thenComparingInt(CommonCode::getSortOrder).thenComparing(CommonCode::getCode))
                .map(this::codeResponse).toList();
    }
    public String validateSelection(String algorithm, String purpose, boolean newKey) {
        String normalized = purpose.trim().toUpperCase(Locale.ROOT);
        if ("DATA_ENCRYPTION".equals(normalized)) normalized = "ENCRYPT";
        if (!PURPOSES.getOrDefault(algorithm, List.of()).contains(normalized)) throw invalid("알고리즘에 허용되지 않는 키 용도입니다.");
        if (newKey && !codeEntity("ALGORITHM", algorithm).isEnabled()) throw invalid("신규 생성이 중지된 알고리즘입니다.");
        if (!codeEntity("PURPOSE", normalized).isEnabled()) throw invalid("신규 선택이 중지된 키 용도입니다.");
        return normalized;
    }
    @Transactional
    public PolicyResponse updatePolicy(KeySettingsController.PolicyUpdate request, String actor) {
        requireReason(request.reason());
        KeyPolicy policy = policyEntity();
        checkVersion(policy.getVersion(), request.version());
        if (request.defaultValidityDays() < 1 || request.defaultValidityDays() > 3650 || request.expiryWarningDays() < 1 || request.expiryWarningDays() > 365) throw invalid("정책 일수 범위를 확인하세요.");
        String before = "validity=" + policy.getDefaultValidityDays() + ", warning=" + policy.getExpiryWarningDays();
        policy.update(request.defaultValidityDays(), request.expiryWarningDays(), actor);
        policies.saveAndFlush(policy);
        audit.append(actor, "KEY_POLICY_UPDATE", "KEY_POLICY", "1", before + " → validity=" + policy.getDefaultValidityDays() + ", warning=" + policy.getExpiryWarningDays() + "; reason=" + request.reason().trim());
        return policyResponse(policy);
    }
    @Transactional
    public CodeResponse updateCode(String group, String code, KeySettingsController.CodeUpdate request, String actor) {
        requireReason(request.reason());
        CommonCode entry = codeEntity(group, code);
        checkVersion(entry.getVersion(), request.version());
        if ("STATUS".equals(group) && !request.enabled()) throw invalid("상태 코드는 비활성화할 수 없습니다.");
        if (!"STATUS".equals(group) && !isSupported(group, code) && request.enabled()) throw invalid("조회 전용 코드는 신규 선택을 허용할 수 없습니다.");
        String before = describe(entry);
        entry.update(request.label(), request.description(), request.sortOrder(), request.enabled());
        codes.saveAndFlush(entry);
        audit.append(actor, "COMMON_CODE_UPDATE", "COMMON_CODE", group + ":" + code,
                before + " → " + describe(entry) + "; reason=" + request.reason().trim());
        return codeResponse(entry);
    }
    private String describe(CommonCode entry) {
        return "label=" + entry.getLabel() + ", description=" + entry.getDescription() + ", order=" + entry.getSortOrder() + ", enabled=" + entry.isEnabled();
    }
    private KeyPolicy policyEntity() { return policies.findById(1L).orElseThrow(() -> new IllegalStateException("키 정책이 초기화되지 않았습니다.")); }
    private CommonCode codeEntity(String group, String code) { return codes.findById(group + ":" + code).orElseThrow(() -> new KeyOperationException(HttpStatus.NOT_FOUND, "공통코드가 없습니다.", "CODE_NOT_FOUND")); }
    private boolean isSupported(String group, String code) { return "ALGORITHM".equals(group) ? PURPOSES.containsKey(code) : "PURPOSE".equals(group) && List.of("ENCRYPT", "WRAP").contains(code); }
    private PolicyResponse policyResponse(KeyPolicy p) { return new PolicyResponse(p.getDefaultValidityDays(), p.getExpiryWarningDays(), today(), today().plusDays(p.getDefaultValidityDays()), p.getVersion(), p.getUpdatedBy(), p.getUpdatedAt()); }
    private CodeResponse codeResponse(CommonCode c) {
        boolean status = "STATUS".equals(c.getGroup());
        return new CodeResponse(c.getGroup(), c.getCode(), c.getLabel(), c.getDescription(), c.getSortOrder(), c.isEnabled(),
                isSupported(c.getGroup(), c.getCode()), c.getVersion(), PURPOSES.getOrDefault(c.getCode(), List.of()),
                status ? KeyStatus.valueOf(c.getCode()).allowedTransitions().stream().map(Enum::name).sorted().toList() : List.of());
    }
    private void checkVersion(long actual, Long expected) { if (expected == null || actual != expected) throw new KeyOperationException(HttpStatus.CONFLICT, "다른 관리자가 변경했습니다. 새로고침 후 다시 저장하세요.", "SETTINGS_VERSION_CONFLICT"); }
    private void requireReason(String reason) { if (reason == null || reason.trim().length() < 2 || reason.trim().length() > 200) throw invalid("변경 사유는 2~200자여야 합니다."); }
    private KeyOperationException invalid(String message) { return new KeyOperationException(HttpStatus.BAD_REQUEST, message, "INVALID_KEY_POLICY"); }
    public record PolicyResponse(int defaultValidityDays, int expiryWarningDays, LocalDate today, LocalDate defaultExpireAt, long version, String updatedBy, Instant updatedAt) { }
    public record CodeResponse(String group, String code, String label, String description, int sortOrder, boolean enabled, boolean selectable, long version, List<String> allowedPurposes, List<String> allowedTransitions) { }
}
