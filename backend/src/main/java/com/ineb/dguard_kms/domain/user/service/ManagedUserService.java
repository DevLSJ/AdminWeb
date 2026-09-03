package com.ineb.dguard_kms.domain.user.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ineb.dguard_kms.common.PageResponse;
import com.ineb.dguard_kms.domain.auth.service.AdminAccountService;
import com.ineb.dguard_kms.domain.user.dto.ManagedUserResponse;

@Service
public class ManagedUserService {

    private final AdminAccountService adminAccountService;
    private final AppUserService appUserService;

    public ManagedUserService(AdminAccountService adminAccountService, AppUserService appUserService) {
        this.adminAccountService = adminAccountService;
        this.appUserService = appUserService;
    }

    @Transactional
    public PageResponse<ManagedUserResponse> search(
            String name,
            String phone,
            String status,
            int page,
            int size
    ) {
        List<ManagedUserResponse> users = new ArrayList<>();
        appUserService.searchAllForManagement(name, phone, status).stream()
                .map(ManagedUserResponse::from)
                .forEach(users::add);

        if (isBlank(phone)) {
            String nameFilter = isBlank(name) ? null : name.trim().toLowerCase(Locale.ROOT);
            String statusFilter = isBlank(status) || "ALL".equalsIgnoreCase(status) ? null : status.trim().toUpperCase(Locale.ROOT);
            adminAccountService.list().stream()
                    .filter(account -> nameFilter == null
                            || account.name().toLowerCase(Locale.ROOT).contains(nameFilter)
                            || account.loginId().toLowerCase(Locale.ROOT).contains(nameFilter))
                    .filter(account -> statusFilter == null || account.status().equals(statusFilter))
                    .map(ManagedUserResponse::from)
                    .forEach(users::add);
        }

        users.sort(Comparator.comparing(ManagedUserResponse::createdAt).reversed());
        int fromIndex = (int) Math.min((long) page * size, users.size());
        int toIndex = Math.min(fromIndex + size, users.size());
        int totalPages = users.isEmpty() ? 0 : (users.size() + size - 1) / size;
        return new PageResponse<>(List.copyOf(users.subList(fromIndex, toIndex)), page, size, users.size(), totalPages);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
