package com.my.backend.community.service;

import com.my.backend.community.dto.CommunityCommentDto;
import com.my.backend.community.entity.CommunityComment;
import com.my.backend.community.entity.CommunityPost;
import com.my.backend.community.repository.CommunityCommentRepository;
import com.my.backend.community.repository.CommunityPostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CommunityCommentService {

    private final CommunityCommentRepository commentRepository;
    private final CommunityPostRepository postRepository;

    public List<CommunityCommentDto> getCommentsByPostId(Long postId) {
        CommunityPost post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));
        return commentRepository.findByPost(post).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public CommunityCommentDto createComment(Long postId, CommunityCommentDto dto) {
        CommunityPost post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));

        CommunityComment comment = CommunityComment.builder()
                .post(post)
                .author(dto.getAuthor())
                .content(dto.getContent())
                .build();

        return toDto(commentRepository.save(comment));
    }

    public void deleteComment(Long commentId) {
        commentRepository.deleteById(commentId);
    }

    private CommunityCommentDto toDto(CommunityComment comment) {
        return CommunityCommentDto.builder()
                .id(comment.getId())
                .postId(comment.getPost().getId())
                .author(comment.getAuthor())
                .content(comment.getContent())
                .createdAt(comment.getCreatedAt())
                .updatedAt(comment.getUpdatedAt())
                .build();
    }

    public CommunityCommentDto updateComment(Long commentId, CommunityCommentDto dto) {
        CommunityComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Comment not found"));

        comment.setContent(dto.getContent());
        comment.setAuthor(dto.getAuthor());
        return toDto(commentRepository.save(comment));
    }

}
