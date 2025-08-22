package com.my.backend.community.service;

import com.my.backend.account.entity.Account;
import com.my.backend.community.dto.CommunityCommentDto;
import com.my.backend.community.entity.CommunityComment;
import com.my.backend.community.entity.CommunityPost;
import com.my.backend.community.repository.CommunityCommentRepository;
import com.my.backend.community.repository.CommunityPostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class CommunityCommentService {

    private final CommunityCommentRepository commentRepository;
    private final CommunityPostRepository postRepository;

    // 댓글 목록 조회
    public List<CommunityCommentDto> getCommentsByPostId(Long postId) {
        return commentRepository.findByPostId(postId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    // 댓글 생성
    public CommunityCommentDto createComment(Long postId, CommunityCommentDto dto, Account account) {
        CommunityPost post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));

        CommunityComment comment = CommunityComment.builder()
                .post(post)
                .author(account.getName())        // 화면에 표시될 이름
                .ownerEmail(account.getEmail())   // 고유 식별자
                .content(dto.getContent())
                .build();

        return toDto(commentRepository.save(comment));
    }

    // 댓글 수정
    public CommunityCommentDto updateComment(Long commentId, CommunityCommentDto dto, Account account) {
        CommunityComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Comment not found"));


        if (!comment.getOwnerEmail().equals(account.getEmail())
                && !"ROLE_ADMIN".equals(account.getRole())) {
            throw new RuntimeException("본인 댓글만 수정할 수 있습니다.");
        }

        comment.setContent(dto.getContent());
        comment.setUpdatedAt(LocalDateTime.now());
        return toDto(commentRepository.save(comment));
    }

    // 댓글 삭제
    public void deleteComment(Long commentId, Account account) {
        CommunityComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Comment not found"));

        if (!comment.getOwnerEmail().equals(account.getEmail())
                && !"ROLE_ADMIN".equals(account.getRole())) {
            throw new RuntimeException("본인 댓글만 삭제할 수 있습니다.");
        }

        commentRepository.delete(comment);
    }

    // Entity → DTO 변환
    private CommunityCommentDto toDto(CommunityComment comment) {
        return CommunityCommentDto.builder()
                .id(comment.getId())
                .postId(comment.getPost().getId())
                .author(comment.getAuthor())
                .ownerEmail(comment.getOwnerEmail())
                .content(comment.getContent())
                .createdAt(comment.getCreatedAt())
                .updatedAt(comment.getUpdatedAt())
                .build();
    }
}
