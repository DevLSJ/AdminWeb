package com.ineb.dguard_kms.domain.auth.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ineb.dguard_kms.domain.auth.entity.AdminUser;

public interface AdminUserRepository extends JpaRepository<AdminUser, String> {
    Optional<AdminUser> findByLoginId(String loginId);

    boolean existsByLoginId(String loginId);
}
