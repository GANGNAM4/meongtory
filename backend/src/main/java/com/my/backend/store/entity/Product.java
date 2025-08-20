package com.my.backend.store.entity;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonManagedReference;

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
    private Category category;

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
        if (categoryStr != null) {
            try {
                this.category = Category.valueOf(categoryStr);
            } catch (IllegalArgumentException e) {
                this.category = Category.용품;
            }
        }
    }
}