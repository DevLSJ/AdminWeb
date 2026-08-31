package com.ineb.dguard_kms.domain.user.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ineb.dguard_kms.domain.user.entity.AppUser;

import jakarta.persistence.LockModeType;

public interface AppUserRepository extends JpaRepository<AppUser, Long>, JpaSpecificationExecutor<AppUser> {

    Optional<AppUser> findByUserUid(UUID userUid);

    boolean existsByPhoneSearchHash(String phoneSearchHash);

    boolean existsByEmailSearchHash(String emailSearchHash);

    boolean existsByPhoneSearchHashAndUserUidNot(String phoneSearchHash, UUID userUid);

    boolean existsByEmailSearchHashAndUserUidNot(String emailSearchHash, UUID userUid);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select appUser from AppUser appUser where appUser.userUid = :userUid")
    Optional<AppUser> findForUpdateByUserUid(@Param("userUid") UUID userUid);
}
