package com.ineb.dguard_kms.crypto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

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
    void rejectsAChangedPassphraseAgainstPersistedKcvAndLogsTheCause(CapturedOutput output) {
        Map<String, CryptoConfigEntry> persisted = new HashMap<>();
        CryptoConfigRepository repository = mock(CryptoConfigRepository.class);
        when(repository.findById(anyString())).thenAnswer(invocation ->
                Optional.ofNullable(persisted.get(invocation.getArgument(0, String.class))));
        when(repository.saveAll(any())).thenAnswer(invocation -> {
            Iterable<CryptoConfigEntry> entries = invocation.getArgument(0);
            entries.forEach(entry -> persisted.put(entry.getConfigKey(), entry));
            return entries;
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
