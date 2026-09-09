package com.ineb.dguard_kms.domain.user.repository;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import com.ineb.dguard_kms.domain.user.dto.ManagedUserResponse;

/** Rank both account tables before filtering, since their individual IDs can overlap. */
@Repository
public class UserDisplayNumberRepository {
    private final NamedParameterJdbcTemplate jdbc;
    public UserDisplayNumberRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }
    public Map<String, Long> findFor(List<ManagedUserResponse> users) {
        if (users.isEmpty()) return Map.of();
        var numbers = new HashMap<String, Long>();
        jdbc.query("""
                SELECT account_type, user_uid, display_number FROM (
                    SELECT account_type, user_uid,
                           ROW_NUMBER() OVER (ORDER BY created_at, account_type, user_uid) AS display_number
                    FROM (
                        SELECT 'ADMIN_ACCOUNT' AS account_type, user_uid, created_at FROM admin_user
                        UNION ALL
                        SELECT 'APP_USER' AS account_type, user_uid, created_at FROM app_user
                    ) accounts
                ) numbered WHERE user_uid IN (:uids)
                """, Map.of("uids", users.stream().map(ManagedUserResponse::userUid).toList()),
                (org.springframework.jdbc.core.RowCallbackHandler) row -> numbers.put(
                        row.getString("account_type") + ":" + row.getString("user_uid"), row.getLong("display_number")));
        return numbers;
    }
}
