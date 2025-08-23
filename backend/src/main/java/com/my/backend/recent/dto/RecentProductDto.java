package com.my.backend.recent.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecentProductDto {
    private Long id;
    private Long productId; // 일반 상품과 보험 상품용
    private String naverProductId; // 네이버 상품용
    private String productType;
    private String company;
    private String productName;
    private String description;
    private String logoUrl;
    private Long price; 
    private LocalDateTime viewedAt;
} 