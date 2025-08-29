package com.my.backend.community.service;

import com.my.backend.account.entity.Account;
import com.my.backend.community.dto.CommunityPostDto;
import com.my.backend.community.entity.CommunityPost;
import com.my.backend.community.entity.PostView;
import com.my.backend.community.repository.CommunityPostRepository;
import com.my.backend.community.repository.PostViewRepository;
import com.my.backend.community.util.EnhancedProfanityFilter;
import com.my.backend.global.exception.BadWordException;
import com.my.backend.s3.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class CommunityPostService {

    private final CommunityPostRepository postRepository;
    private final PostViewRepository postViewRepository;
    private final S3Service s3Service;
    private final EnhancedProfanityFilter profanityFilter;
    private final AutoCommentService autoCommentService;

    // 게시글 전체 조회 (최신순) - 페이징 지원
    public Page<CommunityPost> getAllPosts(Pageable pageable) {
        return postRepository.findAll(pageable);
    }

    // 게시글 boardType별 조회 (최신순) - 페이징 지원
    public Page<CommunityPost> getPostsByBoardType(String boardType, Pageable pageable) {
        return postRepository.findByBoardType(boardType, pageable);
    }

    // 기존 메서드들 (하위 호환성 유지)
    public List<CommunityPost> getAllPosts() {
        return postRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<CommunityPost> getPostsByBoardType(String boardType) {
        return postRepository.findByBoardTypeOrderByCreatedAtDesc(boardType);
    }

    // 게시글 상세 조회 (조회 수 증가 포함)
    public CommunityPost getPostById(Long id) {
        CommunityPost post = postRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Post not found"));
        post.setViews(post.getViews() + 1);
        return postRepository.save(post);
    }

    // 조회수 증가 없는 게시글 단순 조회
    public CommunityPost findPostById(Long id) {
        return postRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Post not found"));
    }

    /**
     * 조회수 증가 메서드
     * @param postId 게시글 ID
     * @param currentUserEmail 현재 사용자 이메일
     * @param ipAddress 클라이언트 IP 주소
     */
    public void increaseViewCount(Long postId, String currentUserEmail, String ipAddress) {
        CommunityPost post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("게시글을 찾을 수 없습니다."));

        // 1분 전 시간 계산
        LocalDateTime oneMinuteAgo = LocalDateTime.now().minusMinutes(1);

        // 작성자인 경우: 최초 1회만 증가 (조회수가 0일 때만)
        if (currentUserEmail != null && post.getOwnerEmail().equals(currentUserEmail)) {
            if (post.getViews() == 0) {
                post.increaseViews();
                postRepository.save(post);
                
                // 조회 기록 저장
                PostView postView = PostView.builder()
                        .postId(postId)
                        .userEmail(currentUserEmail)
                        .ipAddress(ipAddress)
                        .build();
                postViewRepository.save(postView);
            }
            return;
        }

        // 로그인한 사용자의 경우: 이메일로 중복 체크
        if (currentUserEmail != null) {
            // 최근 1분 내에 같은 사용자가 같은 게시글을 조회했는지 확인
            if (postViewRepository.findRecentViewByUser(postId, currentUserEmail, oneMinuteAgo).isPresent()) {
                return; // 중복 조회이므로 조회수 증가하지 않음
            }
        } else {
            // 비로그인 사용자의 경우: IP 주소로 중복 체크
            if (postViewRepository.findRecentViewByIp(postId, ipAddress, oneMinuteAgo).isPresent()) {
                return; // 중복 조회이므로 조회수 증가하지 않음
            }
        }

        // 조회수 증가
        post.increaseViews();
        postRepository.save(post);

        // 조회 기록 저장
        PostView postView = PostView.builder()
                .postId(postId)
                .userEmail(currentUserEmail)
                .ipAddress(ipAddress)
                .build();
        postViewRepository.save(postView);
    }



    // 게시글 생성
    public CommunityPostDto createPost(CommunityPostDto dto, List<MultipartFile> imgs, Account account) throws IOException {
        // 비속어 필터링 체크
        if (profanityFilter.containsProfanity(dto.getTitle()) || profanityFilter.containsProfanity(dto.getContent())) {
            throw new BadWordException("🚫 비속어를 사용하지 말아주세요.");
        }

        List<String> imageUrls = new ArrayList<>();
        if (imgs != null && !imgs.isEmpty()) {
            for (MultipartFile file : imgs) {
                String uploadedUrl = s3Service.uploadFile(file);
                imageUrls.add(uploadedUrl);
            }
        }
        dto.setImages(imageUrls);

        CommunityPost post = CommunityPost.builder()
                .title(dto.getTitle())
                .content(dto.getContent())
                .author(account.getName())
                .ownerEmail(account.getEmail())
                .category(dto.getCategory())
                .boardType(dto.getBoardType())
                .tags(dto.getTags())
                .images(imageUrls)
                .sharedFromDiaryId(dto.getSharedFromDiaryId())
                .likes(0)
                .views(0)
                .comments(0)
                .build();

        CommunityPost savedPost = postRepository.save(post);

        // 자동 댓글 생성 (비동기로 처리하여 게시글 작성 속도에 영향 없도록)
        try {
            autoCommentService.createAutoComment(savedPost.getId());
        } catch (Exception e) {
            // 자동 댓글 생성 실패는 로그만 남기고 게시글 작성은 계속 진행
            System.err.println("자동 댓글 생성 실패: " + e.getMessage());
        }

        return CommunityPostDto.builder()
                .id(savedPost.getId())
                .title(savedPost.getTitle())
                .content(savedPost.getContent())
                .author(savedPost.getAuthor())
                .ownerEmail(savedPost.getOwnerEmail())
                .category(savedPost.getCategory())
                .boardType(savedPost.getBoardType())
                .tags(savedPost.getTags())
                .images(savedPost.getImages())
                .sharedFromDiaryId(savedPost.getSharedFromDiaryId())
                .likes(savedPost.getLikes())
                .views(savedPost.getViews())
                .comments(savedPost.getComments())
                .createdAt(savedPost.getCreatedAt())
                .updatedAt(savedPost.getUpdatedAt())
                .build();
    }

    // 게시글 수정
    public CommunityPost updatePost(Long id, CommunityPostDto dto, List<MultipartFile> imgs) throws IOException {
        // 비속어 필터링 체크
        if (profanityFilter.containsProfanity(dto.getTitle()) || profanityFilter.containsProfanity(dto.getContent())) {
            throw new BadWordException("🚫 비속어를 사용하지 말아주세요.");
        }

        CommunityPost post = findPostById(id);

        // 기존 이미지 리스트 불러오기
        List<String> imageUrls = post.getImages() != null ? new ArrayList<>(post.getImages()) : new ArrayList<>();

        // 삭제할 이미지 처리
        if (dto.getImagesToDelete() != null && !dto.getImagesToDelete().isEmpty()) {
            for (String fileName : dto.getImagesToDelete()) {
                s3Service.deleteFile(fileName);
                imageUrls.removeIf(url -> url.contains(fileName));
            }
        }

        // 새 이미지 업로드
        if (imgs != null && !imgs.isEmpty()) {
            for (MultipartFile file : imgs) {
                String uploadedUrl = s3Service.uploadFile(file);
                imageUrls.add(uploadedUrl);
            }
        }

        // 게시글 기본 필드 수정
        post.setTitle(dto.getTitle());
        post.setContent(dto.getContent());
        post.setCategory(dto.getCategory());
        post.setTags(dto.getTags());
        post.setImages(imageUrls);

        return postRepository.save(post);
    }

    // 게시글 삭제
    public void deletePost(Long id) {
        CommunityPost post = findPostById(id);

        if (post.getImages() != null && !post.getImages().isEmpty()) {
            for (String imageUrl : post.getImages()) {
                s3Service.deleteFile(imageUrl);
            }
        }

        postRepository.delete(post);
    }

    public CommunityPost save(CommunityPost post) {
        return postRepository.save(post);
    }
    
    // 검색 기능
    public Page<CommunityPost> searchPosts(String keyword, String category, Pageable pageable) {
        if (keyword == null || keyword.isBlank()) {
            if (category == null || category.isBlank()) {
                return postRepository.findAll(pageable);
            } else {
                return postRepository.findByBoardType(category, pageable);
            }
        } else {
            if (category == null || category.isBlank()) {
                return postRepository
                    .findByTitleContainingIgnoreCaseOrContentContainingIgnoreCase(keyword, keyword, pageable);
            } else {
                return postRepository
                    .findByBoardTypeAndTitleContainingIgnoreCaseOrBoardTypeAndContentContainingIgnoreCase(
                        category, keyword, category, keyword, pageable);
            }
        }
    }
}
