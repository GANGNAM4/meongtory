package com.my.backend.community.service;

import com.my.backend.community.entity.CommunityComment;
import com.my.backend.community.entity.CommunityPost;
import com.my.backend.community.repository.CommunityCommentRepository;
import com.my.backend.community.repository.CommunityPostRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Random;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class AutoCommentService {

    private final CommunityCommentRepository commentRepository;
    private final CommunityPostRepository postRepository;
    private final OpenAiService openAiService;

    // 기존 랜덤 댓글 멘트 (AI 실패 시 폴백용)
    private static final List<String> FALLBACK_COMMENT_MESSAGES = Arrays.asList(
        "좋은 글 감사합니다 🙌",
        "유익한 정보네요! 👍",
        "공감합니다 😊"
    );

    /**
     * 게시글 작성 후 AI 기반 자동 댓글 생성
     * @param postId 게시글 ID
     */
    public void createAutoComment(Long postId) {
        try {
            CommunityPost post = postRepository.findById(postId)
                    .orElseThrow(() -> new RuntimeException("Post not found"));

            // AI 기반 댓글 생성 시도
            String aiComment = openAiService.generateComment(post.getContent(), post.getCategory());
            
            // 자동 댓글 생성
            CommunityComment autoComment = CommunityComment.builder()
                    .post(post)
                    .author("Meongtory")
                    .ownerEmail("meongtory@meongtory.com") // Meongtory의 고유 식별자
                    .content(aiComment)
                    .build();

            commentRepository.save(autoComment);

            // 게시글의 댓글 수 증가
            post.setComments(post.getComments() + 1);
            postRepository.save(post);
        } catch (Exception e) {
            // 자동 댓글 생성 실패는 로그만 남기고 예외를 던지지 않음
            // (게시글 작성 자체는 성공해야 하므로)
            log.error("자동 댓글 생성 실패: {}", e.getMessage(), e);
        }
    }

    /**
     * 폴백용 랜덤 멘트 선택 (AI 실패 시 사용)
     * @return 선택된 멘트
     */
    private String getRandomFallbackMessage() {
        Random random = new Random();
        int index = random.nextInt(FALLBACK_COMMENT_MESSAGES.size());
        return FALLBACK_COMMENT_MESSAGES.get(index);
    }
}
