package com.ineb.dguard_kms.domain.user.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ineb.dguard_kms.common.PageResponse;
import com.ineb.dguard_kms.domain.auth.service.AdminAccountService;
import com.ineb.dguard_kms.domain.auth.dto.AdminAccountResponse;
import com.ineb.dguard_kms.domain.user.dto.ManagedUserResponse;
import com.ineb.dguard_kms.domain.user.dto.UserResponse;
import com.ineb.dguard_kms.domain.user.repository.UserDisplayNumberRepository;

@Service
public class ManagedUserService {

    private final AdminAccountService adminAccountService;
    private final AppUserService appUserService;
    private final UserDisplayNumberRepository displayNumbers;

    public ManagedUserService(AdminAccountService adminAccountService, AppUserService appUserService, UserDisplayNumberRepository displayNumbers) {
        this.adminAccountService = adminAccountService;
        this.appUserService = appUserService;
        this.displayNumbers = displayNumbers;
    }

    @Transactional
    public PageResponse<ManagedUserResponse> search(
            String name,
            String phone,
            String email,
            String status,
            int page,
            int size
    ) {
        List<UserResponse> appUsers = new ArrayList<>(appUserService.searchAllForManagement(name, phone, email, status));
        String nameFilter = isBlank(name) ? null : name.trim().toLowerCase(Locale.ROOT);
        String statusFilter = isBlank(status) || "ALL".equalsIgnoreCase(status) ? null : status.trim().toUpperCase(Locale.ROOT);
        List<AdminAccountResponse> loginAccounts = adminAccountService.searchContacts(phone, email).stream()
                .filter(account -> nameFilter == null
                        || account.name().toLowerCase(Locale.ROOT).contains(nameFilter)
                        || account.loginId().toLowerCase(Locale.ROOT).contains(nameFilter))
                .filter(account -> statusFilter == null || account.status().equals(statusFilter))
                .toList();
        Set<UUID> appUserUids = appUsers.stream().map(UserResponse::userUid).collect(Collectors.toSet());
        for (AdminAccountResponse account : loginAccounts) {
            if (!appUserUids.contains(account.userUid()) && appUserService.exists(account.userUid())) {
                appUsers.add(appUserService.get(account.userUid()));
                appUserUids.add(account.userUid());
            }
        }
        Map<UUID, AdminAccountResponse> loginByUserUid = loginAccounts.stream()
                .collect(Collectors.toMap(AdminAccountResponse::userUid, Function.identity(), (first, ignored) -> first));
        List<ManagedUserResponse> users = appUsers.stream()
                .map(user -> ManagedUserResponse.from(user, loginByUserUid.get(user.userUid())))
                .collect(Collectors.toCollection(ArrayList::new));
        loginAccounts.stream().filter(account -> !appUserUids.contains(account.userUid()))
                .map(ManagedUserResponse::from).forEach(users::add);

        users.sort(Comparator.comparing(ManagedUserResponse::createdAt)
                .thenComparing(ManagedUserResponse::accountType).thenComparing(user -> user.userUid().toString()).reversed());
        int fromIndex = (int) Math.min((long) page * size, users.size());
        int toIndex = Math.min(fromIndex + size, users.size());
        int totalPages = users.isEmpty() ? 0 : (users.size() + size - 1) / size;
        List<ManagedUserResponse> selected = users.subList(fromIndex, toIndex);
        var numbers = displayNumbers.findFor(selected);
        return new PageResponse<>(selected.stream().map(user -> user.withDisplayNumber(
                numbers.get(user.accountType() + ":" + user.userUid()))).toList(), page, size, users.size(), totalPages);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
