package com.ineb.dguard_kms.domain.settings;

import java.util.List;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** H2 create-drop development/test profiles have no Flyway data migration. */
@Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "spring.flyway.enabled", havingValue = "false")
public class KeySettingsInitializer implements ApplicationRunner {
    private final CommonCodeRepository codes;
    private final KeyPolicyRepository policies;
    public KeySettingsInitializer(CommonCodeRepository codes, KeyPolicyRepository policies) { this.codes = codes; this.policies = policies; }
    @Override @Transactional
    public void run(ApplicationArguments args) {
        if (!policies.existsById(1L)) policies.save(new KeyPolicy());
        var defaults = List.of(
            new CommonCode("ALGORITHM", "AES", "대칭키 · AES-256-GCM", "AES-256-GCM", 10, true),
            new CommonCode("ALGORITHM", "RSA", "공개키 · RSA-2048-SHA256", "RSA-2048-SHA256", 20, true),
            new CommonCode("ALGORITHM", "HMAC", "메시지 인증 · HMAC", "기존 키 조회 전용", 30, false),
            new CommonCode("PURPOSE", "ENCRYPT", "암복호화", "데이터 암복호화", 10, true),
            new CommonCode("PURPOSE", "SIGN", "서명", "기존 키 조회 전용", 20, false),
            new CommonCode("PURPOSE", "AUTH", "인증", "기존 키 조회 전용", 30, false),
            new CommonCode("PURPOSE", "WRAP", "키 래핑", "키 래핑", 40, true),
            new CommonCode("STATUS", "CREATED", "생성됨", "활성화 전 키", 10, true),
            new CommonCode("STATUS", "ACTIVE", "활성화", "암복호화 가능", 20, true),
            new CommonCode("STATUS", "DEACTIVATED", "비활성", "암복호화 중지", 30, true),
            new CommonCode("STATUS", "COMPROMISED", "침해", "폐기만 가능", 40, true),
            new CommonCode("STATUS", "DESTROYED", "폐기", "키 재료 제거 완료", 50, true)
        );
        for (CommonCode entry : defaults) if (!codes.existsById(entry.getGroup() + ":" + entry.getCode())) codes.save(entry);
    }
}
