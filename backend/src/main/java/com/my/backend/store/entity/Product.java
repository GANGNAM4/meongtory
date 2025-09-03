
package com.my.backend.store.entity;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import com.fasterxml.jackson.annotation.JsonSetter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "product")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "product_id")
    private Long id;


    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Long price;

    @Column(nullable = false)
    @Builder.Default
    private Long stock = 0L;

    @Column(nullable = true)
    private String imageUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Category category = Category.용품;

    private LocalDate registrationDate;

    private String registeredBy;

    
    // StoreAI 관련 필드들
    @Enumerated(EnumType.STRING)
    @Column(name = "product_source")
    @Builder.Default
    private ProductSource source = ProductSource.MONGTORY;
    
    @Column(name = "external_product_id")
    private String externalProductId;
    
    @Column(name = "external_product_url")
    private String externalProductUrl;
    
    @Column(name = "external_mall_name")
    private String externalMallName;


    @OneToMany(mappedBy = "product")
    @JsonIgnore
    @Builder.Default
    private List<Order> orders = new ArrayList<>();

    public void setCategory(String categoryStr) {
        if (categoryStr != null && !categoryStr.trim().isEmpty()) {
            try {
                // 공백 제거 후 enum 변환
                String trimmedCategory = categoryStr.trim();
                this.category = Category.valueOf(trimmedCategory);
            } catch (IllegalArgumentException e) {
                System.out.println("잘못된 카테고리 값: '" + categoryStr + "', 기본값 '용품'으로 설정");
                System.out.println("사용 가능한 카테고리: " + java.util.Arrays.toString(Category.values()));
                this.category = Category.용품;
            }
        } else {
            this.category = Category.용품;
        }
    }

    // JSON 역직렬화를 위한 추가 setter
    @JsonSetter("category")
    public void setCategoryFromJson(String categoryStr) {
        setCategory(categoryStr);
    }
}