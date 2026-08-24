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
        return Jwts.parser()
                .verifyWith(signingKey)
                .clock(() -> Date.from(clock.instant()))
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
