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

    public List<CommunityPost> getAllPosts() {
        return postRepository.findAll();
    }

    public CommunityPost getPostById(Long id) {
        CommunityPost post = postRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Post not found"));
        post.setViews(post.getViews() + 1);
        return postRepository.save(post);
    }

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
                .author(account.getName())          // 화면 표시용 이름
                .ownerEmail(account.getEmail())     // ✅ 수정/삭제 권한 확인용 이메일
                .category(dto.getCategory())
                .boardType(dto.getBoardType())
                .tags(dto.getTags())
                .images(imageUrls)
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
                .ownerEmail(post.getOwnerEmail())   // ✅ 프론트로 내려줌
                .category(post.getCategory())
                .boardType(post.getBoardType())
                .tags(post.getTags())
                .images(post.getImages())
                .likes(post.getLikes())
                .views(post.getViews())
                .comments(post.getComments())
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .build();
    }


    public CommunityPost updatePost(Long id, CommunityPostDto dto, List<MultipartFile> imgs) throws IOException {
        CommunityPost post = getPostById(id);

        // 이미지 업로드
        List<String> imageUrls = post.getImages() != null ? new ArrayList<>(post.getImages()) : new ArrayList<>();
        if (imgs != null && !imgs.isEmpty()) {
            for (MultipartFile file : imgs) {
                String uploadedUrl = s3Service.uploadFile(file);
                imageUrls.add(uploadedUrl);
            }
        }

        post.setTitle(dto.getTitle());
        post.setContent(dto.getContent());
        post.setCategory(dto.getCategory());
        post.setTags(dto.getTags());
        post.setImages(imageUrls);

        return postRepository.save(post);
    }

    // CommunityPostService.java
    public void deletePost(Long id) {
        CommunityPost post = postRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Post not found"));

        // 게시글 이미지가 있으면 S3에서 삭제
        if (post.getImages() != null && !post.getImages().isEmpty()) {
            for (String imageUrl : post.getImages()) {
                s3Service.deleteFile(imageUrl);
            }
        }

        // DB에서 게시글 삭제
        postRepository.deleteById(id);
    }



}
