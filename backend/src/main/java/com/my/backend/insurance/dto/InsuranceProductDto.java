package com.my.backend.insurance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InsuranceProductDto {
    private Long id;
    private String company;
    private String productName;
    private String description;
    private List<String> features;
    private String logoUrl;
    private String redirectUrl;
}

