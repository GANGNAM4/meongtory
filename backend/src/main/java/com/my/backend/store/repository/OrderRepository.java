package com.my.backend.store.repository;

import com.my.backend.store.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {
    boolean existsByMerchantOrderId(String merchantOrderId);
    
    java.util.Optional<Order> findByMerchantOrderId(String merchantOrderId);

    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
    
    List<Order> findByAccountId(Long accountId);
    
    // 중복 주문 방지를 위한 메서드
    List<Order> findByAccountIdAndProductIdAndCreatedAtAfter(Long accountId, Long productId, LocalDateTime createdAt);
    
    // 네이버 상품 중복 주문 방지를 위한 메서드
    List<Order> findByAccountIdAndNaverProductIdAndCreatedAtAfter(Long accountId, Long naverProductId, LocalDateTime createdAt);
    
    // 상품 ID로 주문 조회 (상품 삭제 시 사용)
    List<Order> findByProduct_Id(Long productId);
    
    // 네이버 상품 ID로 주문 조회 (네이버 상품 삭제 시 사용)
    List<Order> findByNaverProduct_Id(Long naverProductId);
    
    // 결제 성공 시 관련 주문들을 찾기 위한 메서드
    List<Order> findByAccountAndStatusAndCreatedAtBetween(
        com.my.backend.account.entity.Account account, 
        com.my.backend.store.entity.OrderStatus status, 
        LocalDateTime startTime, 
        LocalDateTime endTime
    );
}
