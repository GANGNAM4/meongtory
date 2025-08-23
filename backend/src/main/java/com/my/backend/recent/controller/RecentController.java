package com.my.backend.recent.controller;

import com.my.backend.global.dto.ResponseDto;
import com.my.backend.recent.dto.RecentProductDto;
import com.my.backend.recent.service.RecentProductService;
import com.my.backend.global.security.user.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recent")
@RequiredArgsConstructor
public class RecentController {

    private final RecentProductService recentProductService;

    @GetMapping
    public ResponseEntity<ResponseDto<List<RecentProductDto>>> getRecentProducts(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam String productType) {
        
        if (userDetails == null) {
            return ResponseEntity.ok(ResponseDto.success(List.of()));
        }
        
        List<RecentProductDto> recentProducts = recentProductService.getRecentProducts(
                userDetails.getAccount().getId(), productType);
        return ResponseEntity.ok(ResponseDto.success(recentProducts));
    }

    @PostMapping("/{productId}")
    public ResponseEntity<ResponseDto<Void>> addToRecent(
            @PathVariable Long productId,
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam String productType) {
        
        System.out.println("=== 최근 본 상품 추가 요청 ===");
        System.out.println("productId: " + productId + " (타입: " + (productId != null ? productId.getClass().getSimpleName() : "null") + ")");
        System.out.println("productType: " + productType);
        System.out.println("userDetails: " + (userDetails != null ? "존재" : "null"));
        
        if (userDetails == null) {
            System.out.println("사용자 정보가 없음");
            return ResponseEntity.ok(ResponseDto.success(null));
        }
        
        System.out.println("사용자 ID: " + userDetails.getAccount().getId());
        
        try {
            recentProductService.addToRecentProducts(
                    userDetails.getAccount().getId(), productId, productType);
            System.out.println("최근 본 상품 추가 성공");
            return ResponseEntity.ok(ResponseDto.success(null));
        } catch (Exception e) {
            System.out.println("최근 본 상품 추가 실패: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping
    public ResponseEntity<ResponseDto<Void>> clearRecentProducts(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam String productType) {
        
        if (userDetails == null) {
            return ResponseEntity.ok(ResponseDto.success(null));
        }
        
        recentProductService.clearRecentProducts(
                userDetails.getAccount().getId(), productType);
        return ResponseEntity.ok(ResponseDto.success(null));
    }
} 