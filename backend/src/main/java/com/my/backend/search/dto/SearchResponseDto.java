package com.my.backend.search.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchResponseDto {
    private List<Object> results;
    private List<Object> recommendations;
    private String petInfo; // 선택된 MyPet 정보
    private int totalCount;
}