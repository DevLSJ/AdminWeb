package com.ineb.dguard_kms.domain.notice.service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.ineb.dguard_kms.common.PageResponse;
import com.ineb.dguard_kms.crypto.CryptoUtil;
import com.ineb.dguard_kms.domain.audit.service.AuditLogService;
import com.ineb.dguard_kms.domain.notice.dto.NoticeCreateRequest;
import com.ineb.dguard_kms.domain.notice.dto.NoticeFileDownload;
import com.ineb.dguard_kms.domain.notice.dto.NoticeResponse;
import com.ineb.dguard_kms.domain.notice.dto.NoticeUpdateRequest;
import com.ineb.dguard_kms.domain.notice.entity.Notice;
import com.ineb.dguard_kms.domain.notice.entity.NoticeFile;
import com.ineb.dguard_kms.domain.notice.repository.NoticeFileRepository;
import com.ineb.dguard_kms.domain.notice.repository.NoticeRepository;

@Service
public class NoticeService {
    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;
    private static final int MAX_FILES = 10;

    private final com.ineb.dguard_kms.domain.auth.repository.AdminUserRepository authorRepository;
    private final NoticeRepository noticeRepository;
    private final NoticeFileRepository fileRepository;
    private final CryptoUtil cryptoUtil;
    private final AuditLogService auditLogService;

    public NoticeService(NoticeRepository noticeRepository, NoticeFileRepository fileRepository, CryptoUtil cryptoUtil, AuditLogService auditLogService, com.ineb.dguard_kms.domain.auth.repository.AdminUserRepository authorRepository) {
        this.authorRepository = authorRepository;
        this.noticeRepository = noticeRepository;
        this.fileRepository = fileRepository;
        this.cryptoUtil = cryptoUtil;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public PageResponse<NoticeResponse> search(String title, String category, String exposeYn, int page, int size, String actor, String role) {
        Specification<Notice> spec = (root, query, builder) -> {
            var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
            if (title != null && !title.isBlank()) predicates.add(builder.like(builder.lower(root.get("title")), "%" + title.trim().toLowerCase() + "%"));
            if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) predicates.add(builder.equal(root.get("category"), normalizeCategory(category)));
            if (exposeYn != null && !exposeYn.isBlank() && !"ALL".equalsIgnoreCase(exposeYn)) predicates.add(builder.equal(root.get("exposeYn"), normalizeExpose(exposeYn)));
            if ("CLIENT".equals(role)) predicates.add(builder.or(builder.equal(root.get("exposeYn"), "Y"), builder.equal(root.get("createdBy"), actor)));
            return builder.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        Sort pinnedFirst = Sort.by(Sort.Order.desc("category"), Sort.Order.desc("createdAt"));
        var result = noticeRepository.findAll(spec, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), pinnedFirst))
                .map(this::response);
        return PageResponse.from(result);
    }

    @Transactional
    public NoticeResponse get(UUID noticeUid, String actor, String role) {
        Notice notice = noticeRepository.findForUpdateByNoticeUid(noticeUid).orElseThrow(() -> notFound("게시글"));
        assertReadable(notice, actor, role);
        notice.incrementViewCount();
        noticeRepository.saveAndFlush(notice);
        auditLogService.append(actor, "NOTICE_VIEW", "NOTICE", noticeUid.toString(), "게시글 상세 조회 및 조회수 증가");
        return response(notice);
    }

    @Transactional
    public NoticeResponse create(NoticeCreateRequest request, List<MultipartFile> files, String actor, String role) {
        String category = normalizeCategory(request.category());
        assertCategoryWritable(category, role);
        Notice notice = noticeRepository.saveAndFlush(new Notice(request.title().trim(), request.content().trim(), category, normalizeExpose(request.exposeYn()), actor));
        saveFiles(notice, files);
        auditLogService.append(actor, "NOTICE_CREATE", "NOTICE", notice.getNoticeUid().toString(), "게시글 등록 및 첨부파일 암호화 저장");
        return response(notice);
    }

    @Transactional
    public NoticeResponse update(UUID noticeUid, NoticeUpdateRequest request, List<MultipartFile> files, String actor, String role) {
        Notice notice = noticeRepository.findForUpdateByNoticeUid(noticeUid).orElseThrow(() -> notFound("게시글"));
        assertManageable(notice, actor, role);
        String category = normalizeCategory(request.category());
        assertCategoryWritable(category, role);
        notice.update(request.title().trim(), request.content().trim(), category, normalizeExpose(request.exposeYn()));
        noticeRepository.saveAndFlush(notice);
        saveFiles(notice, files);
        auditLogService.append(actor, "NOTICE_UPDATE", "NOTICE", noticeUid.toString(), "게시글 수정 및 신규 첨부파일 암호화 저장");
        return response(notice);
    }

    @Transactional
    public void delete(UUID noticeUid, String actor, String role) {
        Notice notice = noticeRepository.findForUpdateByNoticeUid(noticeUid).orElseThrow(() -> notFound("게시글"));
        assertManageable(notice, actor, role);
        fileRepository.deleteAllByNoticeId(notice.getId());
        noticeRepository.delete(notice);
        auditLogService.append(actor, "NOTICE_DELETE", "NOTICE", noticeUid.toString(), "게시글 및 암호화 첨부파일 삭제");
    }

    @Transactional
    public NoticeFileDownload downloadFile(UUID fileUid, String actor, String role) {
        NoticeFile file = fileRepository.findByFileUid(fileUid).orElseThrow(() -> notFound("첨부파일"));
        Notice notice = noticeRepository.findById(file.getNoticeId()).orElseThrow(() -> notFound("게시글"));
        assertReadable(notice, actor, role);
        byte[] ciphertext = file.getEncryptedContent();
        if (ciphertext == null) throw new ResponseStatusException(HttpStatus.GONE, "기존 첨부파일 본문이 없습니다.");
        byte[] plaintext = cryptoUtil.decrypt(new CryptoUtil.EncryptedPayload(file.getIv(), ciphertext));
        Arrays.fill(ciphertext, (byte) 0);
        auditLogService.append(actor, "FILE_DOWNLOAD", "NOTICE_FILE", fileUid.toString(), "암호화 첨부파일 복호화 다운로드");
        return new NoticeFileDownload(file.getOriginalName(), file.getContentType(), plaintext);
    }

    @Transactional
    public void deleteFile(UUID fileUid, String actor, String role) {
        NoticeFile file = fileRepository.findByFileUid(fileUid).orElseThrow(() -> notFound("첨부파일"));
        Notice notice = noticeRepository.findById(file.getNoticeId()).orElseThrow(() -> notFound("게시글"));
        assertManageable(notice, actor, role);
        fileRepository.delete(file);
        auditLogService.append(actor, "FILE_DELETE", "NOTICE_FILE", fileUid.toString(), "암호화 첨부파일 삭제");
    }

    private void saveFiles(Notice notice, List<MultipartFile> files) {
        if (files == null || files.isEmpty()) return;
        if (files.size() > MAX_FILES) throw new IllegalArgumentException("첨부파일은 최대 10개까지 등록할 수 있습니다.");
        for (MultipartFile file : files) {
            if (file.isEmpty()) continue;
            if (file.getSize() > MAX_FILE_SIZE) throw new IllegalArgumentException("첨부파일은 개별 10MB 이하여야 합니다.");
            byte[] plaintext = null;
            byte[] ciphertext = null;
            byte[] iv = null;
            try {
                plaintext = file.getBytes();
                CryptoUtil.EncryptedPayload encrypted = cryptoUtil.encrypt(plaintext);
                ciphertext = encrypted.ciphertext();
                iv = encrypted.iv();
                String originalName = file.getOriginalFilename() == null ? "attachment" : file.getOriginalFilename().replaceAll("[\\r\\n]", "_");
                fileRepository.save(new NoticeFile(notice.getId(), originalName, file.getContentType(), file.getSize(), iv, ciphertext));
            } catch (IOException exception) {
                throw new IllegalArgumentException("첨부파일을 읽지 못했습니다.", exception);
            } finally {
                if (plaintext != null) Arrays.fill(plaintext, (byte) 0);
                if (ciphertext != null) Arrays.fill(ciphertext, (byte) 0);
                if (iv != null) Arrays.fill(iv, (byte) 0);
            }
        }
        fileRepository.flush();
    }

    private NoticeResponse response(Notice notice) { return NoticeResponse.from(notice, fileRepository.findAllByNoticeIdOrderByCreatedAtAsc(notice.getId()), authorRepository.findByLoginId(notice.getCreatedBy()).map(author -> author.getRole()).orElse("CLIENT")); }
    private String normalizeCategory(String value) { return value == null || value.isBlank() ? "GENERAL" : switch (value.trim().toUpperCase()) { case "NOTICE" -> "NOTICE"; case "GENERAL" -> "GENERAL"; default -> throw new IllegalArgumentException("게시글 구분은 NOTICE 또는 GENERAL이어야 합니다."); }; }
    private String normalizeExpose(String value) { return value == null || value.isBlank() ? "Y" : switch (value.trim().toUpperCase()) { case "Y" -> "Y"; case "N" -> "N"; default -> throw new IllegalArgumentException("노출 상태는 Y 또는 N이어야 합니다."); }; }
    private void assertCategoryWritable(String category, String role) { if ("NOTICE".equals(category) && !isAdmin(role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "공지사항은 관리자만 작성할 수 있습니다."); }
    private void assertReadable(Notice notice, String actor, String role) { if ("CLIENT".equals(role) && !"Y".equals(notice.getExposeYn()) && !notice.getCreatedBy().equals(actor)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "숨김 게시글을 조회할 권한이 없습니다."); }
    private void assertManageable(Notice notice, String actor, String role) { if (("NOTICE".equals(notice.getCategory()) && !isAdmin(role)) || (!isAdmin(role) && !notice.getCreatedBy().equals(actor))) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "게시글을 관리할 권한이 없습니다."); }
    private boolean isAdmin(String role) { return "S.ADMIN".equals(role) || "ADMIN".equals(role); }
    private ResponseStatusException notFound(String target) { return new ResponseStatusException(HttpStatus.NOT_FOUND, target + "을 찾을 수 없습니다."); }
}
