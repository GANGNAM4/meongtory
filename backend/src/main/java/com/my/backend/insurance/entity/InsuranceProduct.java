package com.my.backend.insurance.entity;

import com.my.backend.account.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "insurance_products",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_company_product", columnNames = {"company", "product_name"})
        })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InsuranceProduct extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String company;

    @Column(name = "product_name", nullable = false, length = 500)
    private String productName;

    @Column(length = 1000)
    private String description;

    @Column(length = 2000)
    private String features; // JSON 배열 문자열 또는 콤마 구분 문자열

    @Column(name = "coverage_details", length = 3000)
    private String coverageDetails; // 보장내역 상세 정보 (JSON 배열 문자열 또는 콤마 구분 문자열)

    @Column(length = 10000)
    private String logoUrl;

    @Column(name = "logo_version")
    @Builder.Default
    private Integer logoVersion = 1;

    @Column(name = "logo_updated_at")
    private java.time.LocalDateTime logoUpdatedAt;

    @Column(length = 1000)
    private String redirectUrl; // 자세히 보기 시 이동할 공식 보험사 URL
}

