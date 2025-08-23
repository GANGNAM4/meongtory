package com.my.backend.recent.entity;

import com.my.backend.account.entity.Account;
import com.my.backend.account.entity.BaseEntity;
import com.my.backend.insurance.entity.InsuranceProduct;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "recent_products")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecentProduct extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "insurance_product_id", nullable = true)
    private InsuranceProduct insuranceProduct;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_product_id", nullable = true)
    private com.my.backend.store.entity.Product storeProduct;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "naver_product_id", nullable = true)
    private com.my.backend.store.entity.NaverProduct naverProduct;

    @Column(name = "viewed_at", nullable = false)
    private LocalDateTime viewedAt;

    @Column(name = "product_type", nullable = false)
    private String productType; // "insurance" 또는 "store"

    @PrePersist
    protected void onCreate() {
        viewedAt = LocalDateTime.now();
    }
} 