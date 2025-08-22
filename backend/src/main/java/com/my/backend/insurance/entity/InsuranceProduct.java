package com.my.backend.insurance.entity;

import com.my.backend.account.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "insurance_products")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InsuranceProduct extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String company;

    @Column(nullable = false)
    private String productName;

    @Column(length = 1000)
    private String description;

    @Column(length = 2000)
    private String features; // JSON 배열 문자열 또는 콤마 구분 문자열

    private String logoUrl;

    private String redirectUrl; // 자세히 보기 시 이동할 공식 보험사 URL
}

