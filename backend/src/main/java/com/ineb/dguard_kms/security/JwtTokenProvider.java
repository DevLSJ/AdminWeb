package com.ineb.dguard_kms.security;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Component
public class JwtTokenProvider {

    private final SecretKey signingKey;
    private final long expirationMillis;
    private final Clock clock;

    public JwtTokenProvider(Environment environment) {
        String configuredSecret = environment.getRequiredProperty("jwt.secret");
        byte[] secret = configuredSecret.getBytes(StandardCharsets.UTF_8);
        // HS256 서명 키는 최소 256비트 이상이어야 한다.
        if (secret.length < 32) {
            throw new IllegalStateException("JWT secret must contain at least 32 bytes");
        }
        this.signingKey = Keys.hmacShaKeyFor(secret);
        Arrays.fill(secret, (byte) 0);
        this.expirationMillis = environment.getProperty("jwt.expiration-ms", Long.class, 3_600_000L);
        this.clock = Clock.systemUTC();
    }

    public String createToken(AdminUserDetails user) {
        Instant issuedAt = clock.instant();
        Instant expiresAt = issuedAt.plusMillis(expirationMillis);
        // exp는 프론트 세션 타이머와 서버의 만료 검증이 공유하는 기준 시각이다.
        return Jwts.builder()
                .subject(user.getUsername())
                .claim("uid", user.getUserUid().toString())
                .claim("name", user.getName())
                .claim("role", user.getRole())
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }

    public Claims parseClaims(String token) throws JwtException {
        // 서명, 토큰 형식, exp 만료 검증이 모두 성공한 경우에만 Claims를 반환한다.
        return Jwts.parser()
                .verifyWith(signingKey)
                .clock(() -> Date.from(clock.instant()))
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
