package com.my.backend.community.controller;

import com.my.backend.community.dto.CommunityCommentDto;
import com.my.backend.community.service.CommunityCommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/community/comments")
@RequiredArgsConstructor
public class CommunityCommentController {

    private final CommunityCommentService commentService;

    @GetMapping("/{postId}")
    public List<CommunityCommentDto> getComments(@PathVariable Long postId) {
        return commentService.getCommentsByPostId(postId);
    }

    @PostMapping("/{postId}")
    public CommunityCommentDto createComment(@PathVariable Long postId, @RequestBody CommunityCommentDto dto) {
        return commentService.createComment(postId, dto);
    }

    @DeleteMapping("/{commentId}")
    public void deleteComment(@PathVariable Long commentId) {
        commentService.deleteComment(commentId);
    }

    @PutMapping("/{commentId}")
    public CommunityCommentDto updateComment(@PathVariable Long commentId, @RequestBody CommunityCommentDto dto) {
        return commentService.updateComment(commentId, dto);
    }

}
