package com.my.backend.pet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MyPetSearchDto {
    private Long myPetId;
    private String name;
    private String breed;
    private String type;
    private String imageUrl;
}