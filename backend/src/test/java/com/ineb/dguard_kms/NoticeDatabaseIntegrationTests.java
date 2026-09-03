package com.ineb.dguard_kms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.mock.web.MockMultipartFile;

import com.ineb.dguard_kms.domain.notice.repository.NoticeFileRepository;
import com.ineb.dguard_kms.domain.notice.repository.NoticeRepository;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:notice_database;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE")
@AutoConfigureMockMvc
@Import(TestUserInitializer.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class NoticeDatabaseIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired NoticeRepository noticeRepository;
    @Autowired NoticeFileRepository fileRepository;

    @Test
    void multipartNoticePersistsEncryptedFileAndEachDetailViewIncrementsCount() throws Exception {
        String token = login("admin", "admin");
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        byte[] original = ("confidential-attachment-" + suffix).getBytes(StandardCharsets.UTF_8);
        byte[] expectedDownload = original.clone();
        MockMultipartFile metadata = new MockMultipartFile("metadata", "metadata.json", MediaType.APPLICATION_JSON_VALUE,
                ("{\"title\":\"DB 공지 " + suffix + "\",\"content\":\"서버 연동 공지 본문\",\"exposeYn\":\"Y\"}").getBytes(StandardCharsets.UTF_8));
        MockMultipartFile file = new MockMultipartFile("files", "evidence.txt", MediaType.TEXT_PLAIN_VALUE, original);

        String body = mvc.perform(multipart("/api/notices").file(metadata).file(file).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode created = objectMapper.readTree(body).path("data");
        UUID noticeUid = UUID.fromString(created.path("noticeUid").asText());
        UUID fileUid = UUID.fromString(created.path("files").get(0).path("fileUid").asText());

        var storedNotice = noticeRepository.findByNoticeUid(noticeUid).orElseThrow();
        var storedFile = fileRepository.findByFileUid(fileUid).orElseThrow();
        assertThat(storedNotice.getViewCount()).isZero();
        assertThat(storedFile.getIv()).hasSize(12);
        assertThat(storedFile.getEncryptedContent()).isNotEqualTo(expectedDownload);
        assertThat(new String(storedFile.getEncryptedContent(), StandardCharsets.UTF_8)).doesNotContain("confidential-attachment");

        JsonNode first = detail(token, noticeUid);
        JsonNode second = detail(token, noticeUid);
        assertThat(first.path("viewCount").asLong()).isEqualTo(1);
        assertThat(second.path("viewCount").asLong()).isEqualTo(2);

        byte[] downloaded = mvc.perform(get("/api/files/{fileUid}/download", fileUid).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertThat(downloaded).isEqualTo(expectedDownload);

        String verifyBody = mvc.perform(get("/api/audit-logs/verify").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(objectMapper.readTree(verifyBody).path("data").path("valid").asBoolean()).isTrue();
    }

    @Test
    void adminManagesClientAndSuperAdminManagesAdminWithIntegrityResigned() throws Exception {
        String adminToken = login("dguard", "dguard");
        String superToken = login("admin", "admin");
        String accountsBody = mvc.perform(get("/api/admin-accounts").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode accounts = objectMapper.readTree(accountsBody).path("data");
        String clientUid = findAccount(accounts, "client").path("userUid").asText();
        String adminUid = findAccount(accounts, "dguard").path("userUid").asText();

        mvc.perform(patch("/api/admin-accounts/{uid}/status", clientUid).header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"INACTIVE\"}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/admin-accounts/{uid}/password", clientUid).header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"Client-New-Password-123!\"}"))
                .andExpect(status().isOk());
        mvc.perform(put("/api/admin-accounts/{uid}", adminUid).header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"시연 관리자\",\"role\":\"ADMIN\"}"))
                .andExpect(status().isForbidden());
        String updatedBody = mvc.perform(put("/api/admin-accounts/{uid}", adminUid).header("Authorization", "Bearer " + superToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"시연 관리자\",\"role\":\"ADMIN\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(objectMapper.readTree(updatedBody).path("data").path("integrityValid").asBoolean()).isTrue();
    }

    private JsonNode detail(String token, UUID noticeUid) throws Exception {
        String body = mvc.perform(get("/api/notices/{noticeUid}", noticeUid).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(body).path("data");
    }

    private String login(String loginId, String password) throws Exception {
        String body = mvc.perform(MockMvcRequestBuilders.post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"" + loginId + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(body).path("data").path("token").asText();
    }

    private JsonNode findAccount(JsonNode accounts, String loginId) {
        for (JsonNode account : accounts) if (loginId.equals(account.path("loginId").asText())) return account;
        throw new AssertionError("Account not found: " + loginId);
    }
}
