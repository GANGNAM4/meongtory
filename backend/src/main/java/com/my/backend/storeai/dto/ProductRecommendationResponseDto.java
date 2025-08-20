package com.my.backend.storeai.dto;

import com.my.backend.store.entity.Category;
import com.my.backend.store.entity.ProductSource;
import com.my.backend.storeai.enums.RecommendationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductRecommendationResponseDto {
    // Product 정보
    private Long productId;
    private String name;
    private String description;
    private Long price;
    private String imageUrl;
    private Category category;
    private ProductSource source;
    private String externalProductUrl;
    private String externalMallName;
    
    // 추천 관련 정보
    private String recommendationReason;
    private String aiExplanation;
    private Double matchScore;
    private RecommendationType recommendationType;
    private Boolean isAiGenerated;
    
    // 펫 정보 (추천 대상)
    private Long myPetId;
    private String petName;
    private String petBreed;
    private Integer petAge;
}

