package com.my.backend.store.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BulkAllOrderResponseDto {
    private boolean success;
    private String message;
    private List<OrderResponseDto> orders;
    private int totalItems;
}
