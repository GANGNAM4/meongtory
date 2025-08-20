package com.my.backend.community.controller;

import com.my.backend.account.entity.Account;
import com.my.backend.community.dto.CommunityPostDto;
import com.my.backend.community.entity.CommunityPost;
import com.my.backend.community.service.CommunityPostService;
import com.my.backend.global.security.user.UserDetailsImpl;
import com.my.backend.s3.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/community/posts")
@RequiredArgsConstructor
public class CommunityPostController {

    private final CommunityPostService postService;

    @GetMapping
    public List<CommunityPostDto> getAllPosts() {
        return postService.getAllPosts().stream().map(post -> CommunityPostDto.builder()
                .id(post.getId())
                .title(post.getTitle())
                .content(post.getContent())
                .author(post.getAuthor())
                .ownerEmail(post.getOwnerEmail())
                .category(post.getCategory())
                .boardType(post.getBoardType())
                .views(post.getViews())
                .likes(post.getLikes())
                .comments(post.getComments())
                .tags(post.getTags())
                .images(post.getImages())
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .build()).collect(Collectors.toList());
    }
    @GetMapping("/{id}")
    public CommunityPostDto getPostById(@PathVariable Long id) {
        CommunityPost post = postService.getPostById(id);
        return CommunityPostDto.builder()
                .id(post.getId())
                .title(post.getTitle())
                .content(post.getContent())
                .author(post.getAuthor())
                .ownerEmail(post.getOwnerEmail())
                .category(post.getCategory())
                .boardType(post.getBoardType())
                .views(post.getViews())
                .likes(post.getLikes())
                .comments(post.getComments())
                .tags(post.getTags())
                .images(post.getImages())
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .build();
    }

    @PostMapping(value = "/create", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> createPost(
            @RequestPart(value = "postImg", required = false) List<MultipartFile> imgs,
            @RequestPart(value = "dto") CommunityPostDto dto,
            @AuthenticationPrincipal UserDetailsImpl userDetails
    ) {
        if (userDetails == null || userDetails.getAccount() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "로그인이 필요합니다."));
        }
        Account account = userDetails.getAccount();

        try {
            CommunityPostDto response = postService.createPost(dto, imgs, account);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "게시물 생성 중 오류 발생: " + e.getMessage()));
        }
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> updatePost(
            @PathVariable Long id,
            @RequestPart(value = "postImg", required = false) List<MultipartFile> imgs,
            @RequestPart(value = "dto") CommunityPostDto dto,
            @AuthenticationPrincipal UserDetailsImpl userDetails
    ) {
        if (userDetails == null || userDetails.getAccount() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "로그인이 필요합니다."));
        }

        Account account = userDetails.getAccount();
        try {
            CommunityPost existingPost = postService.getPostById(id);

            // ✅ 권한 확인 (작성자 본인 또는 ADMIN만 가능)
            if (!existingPost.getOwnerEmail().equals(account.getEmail()) &&
                    !"ADMIN".equals(account.getRole())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "수정 권한이 없습니다."));
            }

            CommunityPost updatedPost = postService.updatePost(id, dto, imgs);
            return ResponseEntity.ok(updatedPost);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }


    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletePost(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetailsImpl userDetails
    ) {
        if (userDetails == null || userDetails.getAccount() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "로그인이 필요합니다."));
        }

        Account account = userDetails.getAccount();
        CommunityPost post = postService.getPostById(id);

        // ✅ 권한 확인
        if (!post.getOwnerEmail().equals(account.getEmail()) &&
                !"ADMIN".equals(account.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "삭제 권한이 없습니다."));
        }

        postService.deletePost(id);
        return ResponseEntity.ok(Map.of("message", "삭제 완료"));
    }

}
