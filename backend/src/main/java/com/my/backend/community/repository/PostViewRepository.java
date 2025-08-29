package com.my.backend.community.repository;

import com.my.backend.community.entity.PostView;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface PostViewRepository extends JpaRepository<PostView, Long> {

    /**
     * 특정 사용자가 특정 게시글을 최근 1분 내에 조회했는지 확인
     */
    @Query("SELECT pv FROM PostView pv WHERE pv.postId = :postId AND pv.userEmail = :userEmail AND pv.viewedAt >= :oneMinuteAgo")
    Optional<PostView> findRecentViewByUser(@Param("postId") Long postId, 
                                           @Param("userEmail") String userEmail, 
                                           @Param("oneMinuteAgo") LocalDateTime oneMinuteAgo);

    /**
     * 특정 IP가 특정 게시글을 최근 1분 내에 조회했는지 확인 (비로그인 사용자용)
     */
    @Query("SELECT pv FROM PostView pv WHERE pv.postId = :postId AND pv.ipAddress = :ipAddress AND pv.viewedAt >= :oneMinuteAgo")
    Optional<PostView> findRecentViewByIp(@Param("postId") Long postId, 
                                         @Param("ipAddress") String ipAddress, 
                                         @Param("oneMinuteAgo") LocalDateTime oneMinuteAgo);
}
