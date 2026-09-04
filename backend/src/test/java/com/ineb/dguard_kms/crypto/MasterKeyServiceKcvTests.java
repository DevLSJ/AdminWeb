package com.ineb.dguard_kms.crypto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.security.SecureRandom;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import com.ineb.dguard_kms.domain.config.entity.CryptoConfigEntry;
import com.ineb.dguard_kms.domain.config.repository.CryptoConfigRepository;

@ExtendWith(OutputCaptureExtension.class)
class MasterKeyServiceKcvTests {

    @Test
    void rejectsMasterPassphrasesShorterThan32Utf8Bytes() {
        CryptoConfigRepository repository = mock(CryptoConfigRepository.class);
        TransactionTemplate transactions = mock(TransactionTemplate.class);
        MasterKeyService service = new MasterKeyService(
                repository,
                transactions,
                new SecureRandom(),
                environment("1234567890123456789012345678901")
        );

        assertThatThrownBy(service::initialize)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least 32 UTF-8 bytes");
    }

    @Test
    void rejectsAChangedPassphraseAgainstPersistedKcvAndLogsTheCause(CapturedOutput output) {
        AtomicReference<CryptoConfigEntry> persisted = new AtomicReference<>();
        CryptoConfigRepository repository = mock(CryptoConfigRepository.class);
        when(repository.findFirstByOrderByIdAsc()).thenAnswer(invocation -> Optional.ofNullable(persisted.get()));
        when(repository.count()).thenAnswer(invocation -> persisted.get() == null ? 0L : 1L);
        when(repository.save(any(CryptoConfigEntry.class))).thenAnswer(invocation -> {
            CryptoConfigEntry entry = invocation.getArgument(0);
            persisted.set(entry);
            return entry;
        });

        TransactionTemplate transactions = mock(TransactionTemplate.class);
        doAnswer(invocation -> {
            invocation.<java.util.function.Consumer<TransactionStatus>>getArgument(0)
                    .accept(mock(TransactionStatus.class));
            return null;
        }).when(transactions).executeWithoutResult(any());

        MasterKeyService firstBoot = new MasterKeyService(
                repository,
                transactions,
                new SecureRandom(),
                environment("correct-master-passphrase-for-kcv")
        );
        firstBoot.initialize();
        firstBoot.destroy();

        MasterKeyService wrongPassphraseBoot = new MasterKeyService(
                repository,
                transactions,
                new SecureRandom(),
                environment("wrong-master-passphrase-for-kcv--")
        );

        assertThatThrownBy(wrongPassphraseBoot::initialize)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("KCV verification failed");
        assertThat(output.getOut() + output.getErr())
                .contains("KCV verification failed")
                .contains("configured KMS master passphrase does not match")
                .contains("Application startup is aborted")
                .doesNotContain("correct-master-passphrase-for-kcv")
                .doesNotContain("wrong-master-passphrase-for-kcv");
    }

    private MockEnvironment environment(String passphrase) {
        return new MockEnvironment()
                .withProperty("kms.master.passphrase", passphrase)
                .withProperty("kms.master.pbkdf2.iterations", "210000")
                .withProperty("kms.master.pbkdf2.key-length", "256")
                .withProperty("kms.master.pbkdf2.algorithm", "PBKDF2WithHmacSHA256");
    }
}
