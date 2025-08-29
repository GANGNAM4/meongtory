package com.my.backend.search.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PetBasedSearchDto {
    private Long myPetId;
    private String name;
    private String breed;
    private String type;
    private Integer age;
    private Double weight;
}