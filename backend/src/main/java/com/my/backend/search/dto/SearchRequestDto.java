package com.my.backend.search.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SearchRequestDto {
    private String query;
    private Long petId;
    private String searchType; // "community", "store", "insurance", "diary"
}