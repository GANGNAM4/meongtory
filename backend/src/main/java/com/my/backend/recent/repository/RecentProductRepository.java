package com.my.backend.recent.repository;

import com.my.backend.recent.entity.RecentProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RecentProductRepository extends JpaRepository<RecentProduct, Long> {
    
    @Query("SELECT rp FROM RecentProduct rp WHERE rp.account.id = :accountId AND rp.productType = :productType ORDER BY rp.viewedAt DESC")
    List<RecentProduct> findByAccountIdAndProductTypeOrderByViewedAtDesc(@Param("accountId") Long accountId, @Param("productType") String productType);
    
    @Query("SELECT rp FROM RecentProduct rp WHERE rp.account.id = :accountId AND rp.productType = :productType AND (rp.insuranceProduct.id = :productId OR rp.storeProduct.id = :productId OR rp.naverProduct.id = :productId)")
    RecentProduct findByAccountIdAndProductTypeAndProductId(@Param("accountId") Long accountId, @Param("productType") String productType, @Param("productId") Long productId);
    
    void deleteByAccountIdAndProductType(Long accountId, String productType);
} 