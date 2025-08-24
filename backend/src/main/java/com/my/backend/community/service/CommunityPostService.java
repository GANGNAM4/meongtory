package com.my.backend.community.service;

import com.my.backend.account.entity.Account;
import com.my.backend.community.dto.CommunityPostDto;
import com.my.backend.community.entity.CommunityPost;
import com.my.backend.community.repository.CommunityPostRepository;
import com.my.backend.s3.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CommunityPostService {

    private final CommunityPostRepository postRepository;
    private final S3Service s3Service;

    // 게시글 전체 조회 (최신순)
    public List<CommunityPost> getAllPosts() {
        return postRepository.findAllByOrderByCreatedAtDesc();
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

    // 게시글 생성
    public CommunityPostDto createPost(CommunityPostDto dto, List<MultipartFile> imgs, Account account) throws IOException {
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

        postRepository.save(post);

        return CommunityPostDto.builder()
                .id(post.getId())
                .title(post.getTitle())
                .content(post.getContent())
                .author(post.getAuthor())
                .ownerEmail(post.getOwnerEmail())
                .category(post.getCategory())
                .boardType(post.getBoardType())
                .tags(post.getTags())
                .images(post.getImages())
                .sharedFromDiaryId(post.getSharedFromDiaryId())
                .likes(post.getLikes())
                .views(post.getViews())
                .comments(post.getComments())
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .build();
    }

    // 게시글 수정
    public CommunityPost updatePost(Long id, CommunityPostDto dto, List<MultipartFile> imgs) throws IOException {
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
}
