package com.ineb.dguard_kms.domain.notice.controller;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.ineb.dguard_kms.common.ApiResponse;
import com.ineb.dguard_kms.common.PageResponse;
import com.ineb.dguard_kms.domain.notice.dto.NoticeCreateRequest;
import com.ineb.dguard_kms.domain.notice.dto.NoticeFileDownload;
import com.ineb.dguard_kms.domain.notice.dto.NoticeResponse;
import com.ineb.dguard_kms.domain.notice.dto.NoticeUpdateRequest;
import com.ineb.dguard_kms.domain.notice.service.NoticeService;
import com.ineb.dguard_kms.security.AdminUserDetails;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api")
@PreAuthorize("isAuthenticated()")
public class NoticeController {
    private final NoticeService service;

    public NoticeController(NoticeService service) { this.service = service; }

    @GetMapping("/notices")
    public ApiResponse<PageResponse<NoticeResponse>> list(@RequestParam(required = false) String title, @RequestParam(required = false) String exposeYn, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size, @AuthenticationPrincipal AdminUserDetails actor) {
        return ApiResponse.success(service.search(title, exposeYn, page, size, actor.getUsername(), actor.getRole()), "공지 목록을 조회했습니다.");
    }

    @GetMapping("/notices/{noticeUid}")
    public ApiResponse<NoticeResponse> get(@PathVariable UUID noticeUid, @AuthenticationPrincipal AdminUserDetails actor) {
        return ApiResponse.success(service.get(noticeUid, actor.getUsername(), actor.getRole()), "공지를 조회하고 조회수를 증가했습니다.");
    }

    @PostMapping(value = "/notices", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<NoticeResponse> create(@Valid @RequestPart("metadata") NoticeCreateRequest request, @RequestPart(value = "files", required = false) List<MultipartFile> files, @AuthenticationPrincipal AdminUserDetails actor) {
        return ApiResponse.success(service.create(request, files, actor.getUsername()), "공지를 등록했습니다.");
    }

    @PutMapping(value = "/notices/{noticeUid}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<NoticeResponse> update(@PathVariable UUID noticeUid, @Valid @RequestPart("metadata") NoticeUpdateRequest request, @RequestPart(value = "files", required = false) List<MultipartFile> files, @AuthenticationPrincipal AdminUserDetails actor) {
        return ApiResponse.success(service.update(noticeUid, request, files, actor.getUsername(), actor.getRole()), "공지를 수정했습니다.");
    }

    @DeleteMapping("/notices/{noticeUid}")
    public ApiResponse<Void> delete(@PathVariable UUID noticeUid, @AuthenticationPrincipal AdminUserDetails actor) {
        service.delete(noticeUid, actor.getUsername(), actor.getRole());
        return ApiResponse.success(null, "공지를 삭제했습니다.");
    }

    @GetMapping("/files/{fileUid}/download")
    public ResponseEntity<byte[]> download(@PathVariable UUID fileUid, @AuthenticationPrincipal AdminUserDetails actor) {
        NoticeFileDownload file = service.downloadFile(fileUid, actor.getUsername(), actor.getRole());
        MediaType mediaType;
        try { mediaType = file.contentType() == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(file.contentType()); }
        catch (IllegalArgumentException ignored) { mediaType = MediaType.APPLICATION_OCTET_STREAM; }
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(file.originalName(), StandardCharsets.UTF_8).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(file.content());
    }

    @DeleteMapping("/files/{fileUid}")
    public ApiResponse<Void> deleteFile(@PathVariable UUID fileUid, @AuthenticationPrincipal AdminUserDetails actor) {
        service.deleteFile(fileUid, actor.getUsername(), actor.getRole());
        return ApiResponse.success(null, "첨부파일을 삭제했습니다.");
    }
}
