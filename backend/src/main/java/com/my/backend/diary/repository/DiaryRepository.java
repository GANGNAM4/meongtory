package com.my.backend.diary.repository;

import com.my.backend.account.entity.Account;
import com.my.backend.diary.entity.Diary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DiaryRepository extends JpaRepository<Diary, Long> {
    List<Diary> findByUser(Account user);
    List<Diary> findByUserAndIsDeletedFalseOrderByCreatedAtDesc(Account user);
    List<Diary> findByIsDeletedFalseOrderByCreatedAtDesc();
    
    @Query(value = "SELECT * FROM diary d WHERE :category = ANY(d.categories) AND d.is_deleted = false ORDER BY d.created_at DESC", nativeQuery = true)
    List<Diary> findByCategory(@Param("category") String category);
    
    @Query(value = "SELECT * FROM diary d WHERE :category = ANY(d.categories) AND d.user_id = :userId AND d.is_deleted = false ORDER BY d.created_at DESC", nativeQuery = true)
    List<Diary> findByCategoryAndUser(@Param("category") String category, @Param("userId") Long userId);
    
    // MyPet과 연관된 다이어리 삭제
    @Modifying
    @Query("DELETE FROM Diary d WHERE d.pet.myPetId = :myPetId")
    int deleteByMyPetId(@Param("myPetId") Long myPetId);
}
