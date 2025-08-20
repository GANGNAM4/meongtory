package com.my.backend.community.repository;

import com.my.backend.community.entity.CommunityComment;
import com.my.backend.community.entity.CommunityPost;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommunityCommentRepository extends JpaRepository<CommunityComment, Long> {
    List<CommunityComment> findByPost(CommunityPost post);
}

