package com.my.backend.store.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotEmpty;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BulkAllOrderRequestDto {
    @NotNull(message = "accountId는 필수입니다.")
    private Long accountId;
    
    @NotEmpty(message = "주문할 상품 목록은 비어있을 수 없습니다.")
    private List<OrderItemDto> items;
    
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class OrderItemDto {
        @NotNull(message = "상품 타입은 필수입니다.")
        private String type; // "regular" 또는 "naver"
        
        private Long productId; // 일반 상품 ID (type이 "regular"일 때)
        private Long naverProductId; // 네이버 상품 ID (type이 "naver"일 때)
        
        @NotNull(message = "수량은 필수입니다.")
        private Integer quantity;
        
        private String name; // 상품명 (로깅용)
    }
}
