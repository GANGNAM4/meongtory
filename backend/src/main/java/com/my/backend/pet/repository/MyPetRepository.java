package com.my.backend.pet.repository;

import com.my.backend.pet.entity.MyPet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MyPetRepository extends JpaRepository<MyPet, Long> {
    
    // 사용자의 모든 펫 조회 (최신순)
    List<MyPet> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);
    
    // 사용자의 펫 개수 조회
    Long countByOwnerId(Long ownerId);
    
    // 특정 펫이 해당 사용자의 것인지 확인
    Optional<MyPet> findByMyPetIdAndOwnerId(Long myPetId, Long ownerId);
    
    // 특정 펫이 해당 사용자의 것인지 확인 (boolean)
    boolean existsByMyPetIdAndOwnerId(Long myPetId, Long ownerId);
    
    // 사용자의 모든 펫 조회 (간단한 버전)
    List<MyPet> findByOwnerId(Long ownerId);
    
    // 사용자의 펫 이름으로 검색 (자동완성용)
    @Query("SELECT mp FROM MyPet mp WHERE mp.owner.id = :ownerId AND mp.name LIKE %:keyword%")
    List<MyPet> findByOwnerIdAndNameContaining(@Param("ownerId") Long ownerId, @Param("keyword") String keyword);
} 