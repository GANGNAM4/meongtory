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
    private Long productId;
    private String productType;
    private String company;
    private String productName;
    private String description;
    private String logoUrl;
    private LocalDateTime viewedAt;
} 