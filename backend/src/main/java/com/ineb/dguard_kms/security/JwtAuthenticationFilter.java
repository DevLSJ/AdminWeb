package com.ineb.dguard_kms.security;

import java.io.IOException;

import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.ineb.dguard_kms.domain.auth.repository.AdminUserRepository;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenProvider tokenProvider;
    private final AdminUserRepository userRepository;

    public JwtAuthenticationFilter(JwtTokenProvider tokenProvider, AdminUserRepository userRepository) {
        this.tokenProvider = tokenProvider;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization != null && authorization.startsWith(BEARER_PREFIX)
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            String token = authorization.substring(BEARER_PREFIX.length());
            try {
                String loginId = tokenProvider.parseClaims(token).getSubject();
                // 유효한 JWT라도 DB 계정이 비활성화됐다면 즉시 접근을 차단한다.
                userRepository.findByLoginId(loginId)
                        .filter(user -> user.isActive())
                        .map(AdminUserDetails::new)
                        .ifPresent(details -> SecurityContextHolder.getContext().setAuthentication(
                                new UsernamePasswordAuthenticationToken(details, token, details.getAuthorities())
                        ));
            } catch (JwtException | IllegalArgumentException ignored) {
                // 잘못되거나 만료된 토큰은 인증 없이 다음 보안 필터가 401을 처리하게 한다.
                SecurityContextHolder.clearContext();
            }
        }
        filterChain.doFilter(request, response);
    }
}
