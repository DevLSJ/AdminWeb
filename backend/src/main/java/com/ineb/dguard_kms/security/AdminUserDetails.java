package com.ineb.dguard_kms.security;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import com.ineb.dguard_kms.domain.auth.entity.AdminUser;

public class AdminUserDetails implements UserDetails {

    private final UUID userUid;
    private final String loginId;
    private final String name;
    private final String role;
    private final boolean active;

    public AdminUserDetails(AdminUser user) {
        this.userUid = user.getUserUid();
        this.loginId = user.getLoginId();
        this.name = user.getName();
        this.role = user.getRole();
        this.active = user.isActive();
    }

    public UUID getUserUid() {
        return userUid;
    }

    public String getName() {
        return name;
    }

    public String getRole() {
        return role;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }

    @Override
    public String getPassword() {
        return "";
    }

    @Override
    public String getUsername() {
        return loginId;
    }

    @Override
    public boolean isEnabled() {
        return active;
    }
}
