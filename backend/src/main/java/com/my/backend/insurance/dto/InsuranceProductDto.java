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
    private List<String> benefits;
    private List<String> requirements;
    private CoverageInfo coverage;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CoverageInfo {
        private String maxAmount;
        private String coverageRate;
        private String deductible;
    }
}

