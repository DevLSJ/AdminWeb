package com.ineb.dguard_kms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import com.ineb.dguard_kms.domain.dashboard.service.DashboardService;
import com.ineb.dguard_kms.domain.key.dto.KeyCreateRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyDecryptRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyEncryptRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyStatusChangeRequest;
import com.ineb.dguard_kms.domain.key.entity.KeyStatus;
import com.ineb.dguard_kms.domain.key.repository.CryptoKeyRepository;
import com.ineb.dguard_kms.domain.key.repository.KeyMaterialRepository;
import com.ineb.dguard_kms.domain.key.service.CryptoKeyService;
import com.ineb.dguard_kms.domain.key.service.KeyOperationException;

@SpringBootTest
@Import(TestUserInitializer.class)
class EnterpriseKmsIntegrationTests {

    @Autowired
    private CryptoKeyService keyService;

    @Autowired
    private CryptoKeyRepository keyRepository;

    @Autowired
    private KeyMaterialRepository materialRepository;

    @Autowired
    private DashboardService dashboardService;

    @Test
    void aesCbcLifecycleEnforcesOperationSpecificStateAndNullsMaterialOnDestroy() {
        UUID keyUid = create("AES", "CBC", 128);
        activate(keyUid);

        var encrypted = keyService.encrypt(keyUid, new KeyEncryptRequest("enterprise-secret"), "admin");
        assertThat(encrypted.iv()).isNotBlank();

        keyService.changeStatus(
                keyUid, new KeyStatusChangeRequest(KeyStatus.DEACTIVATED, "복호화 전용 전환"), "admin"
        );
        assertThat(keyService.decrypt(
                keyUid, new KeyDecryptRequest(encrypted.ciphertext(), encrypted.iv(), encrypted.version()), "admin"
        ).plaintext()).isEqualTo("enterprise-secret");
        assertThatThrownBy(() -> keyService.encrypt(keyUid, new KeyEncryptRequest("blocked"), "admin"))
                .isInstanceOfSatisfying(KeyOperationException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo("KEY_ENCRYPT_NOT_ALLOWED"));

        keyService.changeStatus(
                keyUid, new KeyStatusChangeRequest(KeyStatus.REACTIVATED, "암호화 전용 재활성화"), "admin"
        );
        assertThat(keyService.encrypt(keyUid, new KeyEncryptRequest("new-data"), "admin").ciphertext()).isNotBlank();
        assertThatThrownBy(() -> keyService.decrypt(
                keyUid, new KeyDecryptRequest(encrypted.ciphertext(), encrypted.iv(), encrypted.version()), "admin"
        )).isInstanceOfSatisfying(KeyOperationException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo("KEY_DECRYPT_NOT_ALLOWED"));

        keyService.changeStatus(
                keyUid, new KeyStatusChangeRequest(KeyStatus.DEACTIVATED, "폐기 준비"), "admin"
        );
        keyService.changeStatus(keyUid, new KeyStatusChangeRequest(KeyStatus.DESTROYED, "완전 폐기"), "admin");

        var key = keyRepository.findByKeyUid(keyUid).orElseThrow();
        assertThat(key.getPublicKey()).isNull();
        assertThat(materialRepository.findAllByCryptoKeyOrderByKeyVersionDesc(key))
                .allSatisfy(material -> {
                    assertThat(material.getWrappedKey()).isNull();
                    assertThat(material.getWrappingIv()).isNull();
                    assertThat(material.isDestroyed()).isTrue();
                });
        assertThat(keyService.verifyAllIntegrity().invalidKeys()).isZero();
    }

    @Test
    void rsaOaepSupportsPublicKeyEncryptionAndPrivateKeyDecryption() {
        UUID keyUid = create("RSA", "OAEP_SHA256", 2048);
        activate(keyUid);

        var encrypted = keyService.encrypt(keyUid, new KeyEncryptRequest("rsa-secret"), "admin");
        assertThat(encrypted.iv()).isNull();
        assertThat(keyService.decrypt(
                keyUid, new KeyDecryptRequest(encrypted.ciphertext(), null, encrypted.version()), "admin"
        ).plaintext()).isEqualTo("rsa-secret");
    }

    @Test
    void dashboardReturnsZeroFilledDailyAndMonthlyTrendSeries() {
        LocalDate today = LocalDate.now();
        var daily = dashboardService.usageTrend(today.minusDays(2), today, "DAY");
        var monthly = dashboardService.usageTrend(today.minusMonths(1), today, "MONTH");

        assertThat(daily.points()).hasSize(3);
        assertThat(monthly.points()).hasSizeBetween(1, 2);
        assertThat(dashboardService.summary().totalKeys()).isGreaterThanOrEqualTo(0);
    }

    private UUID create(String algorithm, String mode, int size) {
        return keyService.create(new KeyCreateRequest(
                "ENTERPRISE-" + algorithm + "-" + UUID.randomUUID(),
                algorithm,
                mode,
                size,
                "DATA_ENCRYPTION",
                LocalDate.now().plusYears(1),
                30
        ), "admin").keyUid();
    }

    private void activate(UUID keyUid) {
        keyService.changeStatus(
                keyUid, new KeyStatusChangeRequest(KeyStatus.ACTIVE, "테스트 활성화"), "admin"
        );
    }
}
