package com.my.backend.community.controller;

import com.my.backend.account.entity.Account;
import com.my.backend.community.dto.CommunityPostDto;
import com.my.backend.community.entity.CommunityPost;
import com.my.backend.community.service.CommunityPostService;
import com.my.backend.global.security.user.UserDetailsImpl;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/community/posts")
@RequiredArgsConstructor
@Slf4j
public class CommunityPostController {

    private static final Logger logger = LoggerFactory.getLogger(CommunityPostController.class);
    private final CommunityPostService postService;

    @GetMapping
    public Page<CommunityPostDto> getAllPosts(@RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "7") int size,
                                             @RequestParam(required = false) String boardType) {
        logger.info("Fetching community posts with page: {}, size: {}, boardType: {}", page, size, boardType);
        
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<CommunityPost> postsPage;
        
        if (boardType != null && !boardType.trim().isEmpty()) {
            postsPage = postService.getPostsByBoardType(boardType, pageable);
        } else {
            postsPage = postService.getAllPosts(pageable);
        }
        
        logger.info("Retrieved {} posts from page {} of {}", postsPage.getContent().size(), page, postsPage.getTotalPages());
        return postsPage.map(post -> CommunityPostDto.builder()
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
                .sharedFromDiaryId(post.getSharedFromDiaryId())
                .build());
    }

    @GetMapping("/{id}")
    public CommunityPostDto getPostById(@PathVariable Long id, 
                                       @AuthenticationPrincipal UserDetailsImpl userDetails,
                                       HttpServletRequest request) {
        logger.info("Fetching post with id: {}", id);
        
        String currentUserEmail = null;
        if (userDetails != null && userDetails.getAccount() != null) {
            currentUserEmail = userDetails.getAccount().getEmail();
        }
        
        // 클라이언트 IP 주소 가져오기
        String ipAddress = getClientIpAddress(request);
        
        // 조회수 증가 처리
        postService.increaseViewCount(id, currentUserEmail, ipAddress);
        
        // 게시글 조회 (조회수 증가 없는 메서드 사용)
        CommunityPost post = postService.findPostById(id);
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
    ) throws IOException {
        logger.info("Creating new post by user: {}", userDetails != null ? userDetails.getUsername() : "anonymous");
        if (userDetails == null || userDetails.getAccount() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "로그인이 필요합니다."));
        }
        Account account = userDetails.getAccount();

        CommunityPostDto response = postService.createPost(dto, imgs, account);
        return ResponseEntity.ok(response);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> updatePost(
            @PathVariable Long id,
            @RequestPart(value = "postImg", required = false) List<MultipartFile> imgs,
            @RequestPart(value = "dto") CommunityPostDto dto,
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            HttpServletRequest request
    ) throws IOException {
        log.info("Content-Type received: {}", request.getContentType());
        log.info("Updating post with id: {}", id);
        if (userDetails == null || userDetails.getAccount() == null) {
            log.warn("Unauthorized access attempt: userDetails={}", userDetails);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "로그인이 필요합니다."));
        }

        Account account = userDetails.getAccount();
        
        CommunityPost existingPost = postService.getPostById(id);

        if (!Objects.equals(existingPost.getOwnerEmail(), account.getEmail()) &&
                !"ADMIN".equals(account.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "수정 권한이 없습니다."));
        }

        CommunityPost updatedPost = postService.updatePost(id, dto, imgs);
        return ResponseEntity.ok(updatedPost);
    }

    @PutMapping("/{id}/like")
    public ResponseEntity<?> likePost(@PathVariable Long id, @AuthenticationPrincipal UserDetailsImpl userDetails) {
        logger.info("Liking post with id: {}", id);
        try {
            CommunityPost post = postService.getPostById(id);
            post.setLikes(post.getLikes() + 1);
            postService.save(post);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            logger.error("Error liking post: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "좋아요 처리 중 오류 발생: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletePost(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetailsImpl userDetails
    ) {
        logger.info("Deleting post with id: {}", id);
        if (userDetails == null || userDetails.getAccount() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "로그인이 필요합니다."));
        }

        Account account = userDetails.getAccount();
        try {
            // ✅ 조회수 증가 없는 메서드로 가져오기
            CommunityPost post = postService.findPostById(id);

            if (!Objects.equals(post.getOwnerEmail(), account.getEmail()) &&
                    !"ADMIN".equals(account.getRole())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "삭제 권한이 없습니다."));
            }

            postService.deletePost(id);
            return ResponseEntity.ok(Map.of("message", "삭제 완료"));
        } catch (Exception e) {
            logger.error("Error deleting post: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/search")
    public Page<CommunityPostDto> searchPosts(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "7") int size) {
        logger.info("Searching posts with keyword: {}, category: {}, page: {}, size: {}", keyword, category, page, size);
        
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<CommunityPost> postsPage = postService.searchPosts(keyword, category, pageable);
        
        logger.info("Retrieved {} posts from search", postsPage.getContent().size());
        return postsPage.map(post -> CommunityPostDto.builder()
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
                .sharedFromDiaryId(post.getSharedFromDiaryId())
                .build());
    }

    /**
     * 클라이언트의 실제 IP 주소를 가져오는 메서드
     */
    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty() && !"unknown".equalsIgnoreCase(xForwardedFor)) {
            return xForwardedFor.split(",")[0].trim();
        }
        
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty() && !"unknown".equalsIgnoreCase(xRealIp)) {
            return xRealIp;
        }
        
        return request.getRemoteAddr();
    }

}
