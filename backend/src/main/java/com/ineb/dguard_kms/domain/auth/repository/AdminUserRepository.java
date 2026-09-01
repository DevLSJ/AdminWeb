package com.ineb.dguard_kms.domain.auth.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import com.ineb.dguard_kms.domain.auth.entity.AdminUser;

import jakarta.persistence.LockModeType;

public interface AdminUserRepository extends JpaRepository<AdminUser, Long> {
    Optional<AdminUser> findByLoginId(String loginId);

    Optional<AdminUser> findByUserUid(java.util.UUID userUid);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<AdminUser> findForUpdateByUserUid(java.util.UUID userUid);

    boolean existsByLoginId(String loginId);
}
