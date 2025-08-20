package com.my.backend.store.dto;

import com.my.backend.store.entity.Category;
import com.my.backend.store.entity.Product;
import lombok.*;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductDto {
    private Long id;
    private String name;
    private String description;
    private Long price;
    private Long stock;
    private String imageUrl;
    private Category category;
    private LocalDate registrationDate;
    private String registeredBy;
    
    // Product 엔티티를 받는 생성자 추가
    public ProductDto(Product product) {
        this.id = product.getId();
        this.name = product.getName();
        this.description = product.getDescription();
        this.price = product.getPrice();
        this.stock = product.getStock();
        this.imageUrl = product.getImageUrl();
        this.category = product.getCategory();
        this.registrationDate = product.getRegistrationDate();
        this.registeredBy = product.getRegisteredBy();
    }
}