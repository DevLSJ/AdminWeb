package com.ineb.dguard_kms.config;

import java.math.BigDecimal;

import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeIn;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.models.media.Schema;

@Configuration
@OpenAPIDefinition(
        info = @Info(
                title = "D'Guard KMS API",
                version = "v1",
                description = """
                        D'Guard KMS 관리자 웹을 위한 인증, 키 관리 및 감사 로그 API입니다.

                        ## 개발 스택

                        | 영역 | 구성 |
                        | --- | --- |
                        | Frontend | React 19, TypeScript, MUI, Vite |
                        | Backend | Java 21, Spring Boot, Spring Security, Spring Data JPA |
                        | Database | PostgreSQL 17, Flyway |
                        | 보안 | JWT, PBKDF2-HMAC-SHA256, AES-256-GCM, HMAC-SHA256 |
                        | 배포 | Docker Compose, Nginx, GitHub Actions |

                        ## 아키텍처

                        | 계층 | 역할 |
                        | --- | --- |
                        | React 관리자 웹 | JWT를 Bearer 헤더에 담아 `/api/*` 요청을 전송 |
                        | Nginx | 정적 웹 제공 및 `/api/*`를 Spring Boot로 역방향 프록시 |
                        | Spring Boot API | 인증·인가, 키 수명주기, 암복호화, 감사 로그 처리 |
                        | PostgreSQL | 사용자 해시, 키 메타데이터·암호화된 키 재료, 감사 로그 저장 |

                        ## 키 상태

                        | 화면 표시 | API 값 | 의미 |
                        | --- | --- | --- |
                        | 생성됨 | `CREATED` | 생성되어 활성화 대기 중인 키 |
                        | 활성화 | `ACTIVE` | 암복호화와 배포가 가능한 키 |
                        | 비활성 | `DEACTIVATED` | 암복호화는 차단하고 회전 정책은 유지하는 키 |
                        | 침해 | `COMPROMISED` | 키 유출·침해가 의심되어 폐기만 가능한 키 |
                        | 폐기 | `DESTROYED` | 원시 키가 제로화되어 복구할 수 없는 최종 상태 |

                        배포는 생명주기 상태를 변경하지 않고 별도 운영·감사 이력으로 기록합니다.

                        ## 접근 제어

                        | 대상 | 권한 |
                        | --- | --- |
                        | 로그인·로그아웃, Swagger 문서 | 토큰 없이 접근 가능 |
                        | 내 정보·세션 연장·키 조회·암복호화 테스트 | 유효한 JWT 필요 |
                        | 키 생성·수정·상태 변경·갱신·배포 | `ADMIN` 역할 필요 |
                        | 감사 로그 조회·무결성 검증 | `ADMIN` 역할 필요 |

                        우측 상단 **Authorize**에 `Bearer <JWT>` 형식으로 토큰을 입력하면
                        인증이 필요한 API를 Swagger UI에서 호출할 수 있습니다.
                        """
        ),
        tags = {
                @Tag(name = "Authentication", description = "JWT 로그인 및 세션 관리"),
                @Tag(name = "Keys", description = "암호키 생성, 조회, 상태·버전·배포 관리"),
                @Tag(name = "Audit logs", description = "감사 로그 검색 및 체인 무결성 검증")
        },
        security = @SecurityRequirement(name = "bearerAuth")
)
@SecurityScheme(
        name = "bearerAuth",
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT",
        in = SecuritySchemeIn.HEADER,
        description = "로그인 응답의 JWT를 Bearer 토큰으로 입력합니다."
)
public class OpenApiConfig {

    @Bean
    OpenApiCustomizer keyRotationPolicySchemaCustomizer() {
        return openApi -> {
            if (openApi.getComponents() == null || openApi.getComponents().getSchemas() == null) return;
            var requestSchema = openApi.getComponents().getSchemas().get("KeyRotationPolicyRequest");
            if (requestSchema == null || requestSchema.getProperties() == null) return;
            Object daysProperty = requestSchema.getProperties().get("days");
            if (!(daysProperty instanceof Schema<?> daysSchema)) return;
            daysSchema.setMinimum(BigDecimal.valueOf(30));
            daysSchema.setMaximum(BigDecimal.valueOf(90));
            daysSchema.setMultipleOf(BigDecimal.valueOf(30));
        };
    }
}
