package com.my.backend.store.dto;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NaverProductDto {
    private Long id;
    private String productId;
    private String title;
    private String description;
    private Long price;
    private String imageUrl;
    private String mallName;
    private String productUrl;
    private String brand;
    private String maker;
    private String category1;
    private String category2;
    private String category3;
    private String category4;
    private Integer reviewCount;
    private Double rating;
    private Integer searchCount;
    private Integer stock; // 네이버 상품은 재고 무제한
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long relatedProductId;
    
    public NaverProductDto(com.my.backend.store.entity.NaverProduct naverProduct) {
        this.id = naverProduct.getId();
        this.productId = naverProduct.getProductId();
        this.title = naverProduct.getTitle();
        this.description = naverProduct.getDescription();
        this.price = naverProduct.getPrice();
        this.imageUrl = naverProduct.getImageUrl();
        this.mallName = naverProduct.getMallName();
        this.productUrl = naverProduct.getProductUrl();
        this.brand = naverProduct.getBrand();
        this.maker = naverProduct.getMaker();
        this.category1 = naverProduct.getCategory1();
        this.category2 = naverProduct.getCategory2();
        this.category3 = naverProduct.getCategory3();
        this.category4 = naverProduct.getCategory4();
        this.reviewCount = naverProduct.getReviewCount();
        this.rating = naverProduct.getRating();
        this.searchCount = naverProduct.getSearchCount();
        this.stock = 999; // 네이버 상품은 재고 무제한으로 설정
        this.createdAt = naverProduct.getCreatedAt();
        this.updatedAt = naverProduct.getUpdatedAt();
        this.relatedProductId = naverProduct.getRelatedProduct() != null ? naverProduct.getRelatedProduct().getId() : null;
    }
}
