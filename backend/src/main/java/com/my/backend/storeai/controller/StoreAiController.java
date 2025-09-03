package com.my.backend.storeai.controller;

import com.my.backend.global.dto.ResponseDto;
import com.my.backend.global.security.user.UserDetailsImpl;
import com.my.backend.storeai.dto.ProductRecommendationRequestDto;
import com.my.backend.storeai.dto.ProductRecommendationResponseDto;
import com.my.backend.storeai.enums.RecommendationType;
import com.my.backend.storeai.service.StoreAiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/storeai")
@RequiredArgsConstructor
@Slf4j
public class StoreAiController {
    
    private final StoreAiService storeAiService;
    
    // 1. 상품 상세페이지용 추천
    @PostMapping("/recommend/products/{productId}")
    public ResponseEntity<ResponseDto<List<ProductRecommendationResponseDto>>> 
        getProductRecommendations(@PathVariable Long productId,
                                @RequestBody ProductRecommendationRequestDto requestDto,
                                @AuthenticationPrincipal UserDetailsImpl userDetails) {
        try {
            Long accountId = userDetails.getId();
            List<ProductRecommendationResponseDto> recommendations = 
                storeAiService.getProductRecommendations(
                    productId, accountId, requestDto.getMyPetId(), requestDto.getRecommendationType());
            
            return ResponseEntity.ok(ResponseDto.success(recommendations));
        } catch (Exception e) {
            log.error("상품 추천 요청 실패: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(ResponseDto.fail("ERROR", e.getMessage()));
        }
    }
    
    // 2. 사용자 펫 기반 전체 추천
    @GetMapping("/recommend/my-pets")
    public ResponseEntity<ResponseDto<Map<String, List<ProductRecommendationResponseDto>>>> 
        getMyPetsRecommendations(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        try {
            Long accountId = userDetails.getId();
            Map<String, List<ProductRecommendationResponseDto>> recommendations = 
                storeAiService.getMyPetsRecommendations(accountId);
            
            return ResponseEntity.ok(ResponseDto.success(recommendations));
        } catch (Exception e) {
            log.error("펫 기반 추천 요청 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(ResponseDto.fail("ERROR", e.getMessage()));
        }
    }
    
    // 3. 추천 타입별 상품 조회
    @GetMapping("/recommend/type/{recommendationType}")
    public ResponseEntity<ResponseDto<List<ProductRecommendationResponseDto>>> 
        getRecommendationsByType(@PathVariable RecommendationType recommendationType,
                               @AuthenticationPrincipal UserDetailsImpl userDetails) {
        try {
            Long accountId = userDetails.getId();
            List<ProductRecommendationResponseDto> recommendations = 
                storeAiService.getRecommendationsByType(accountId, recommendationType);
            
            return ResponseEntity.ok(ResponseDto.success(recommendations));
        } catch (Exception e) {
            log.error("타입별 추천 요청 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(ResponseDto.fail("ERROR", e.getMessage()));
        }
    }
    
    // 4. 특정 펫 기반 추천
    @GetMapping("/recommend/pet/{myPetId}")
    public ResponseEntity<ResponseDto<List<ProductRecommendationResponseDto>>> 
        getPetSpecificRecommendations(@PathVariable Long myPetId,
                                    @RequestParam RecommendationType type,
                                    @AuthenticationPrincipal UserDetailsImpl userDetails) {
        try {
            Long accountId = userDetails.getId();
            List<ProductRecommendationResponseDto> recommendations = 
                storeAiService.getProductRecommendations(null, accountId, myPetId, type);
            
            return ResponseEntity.ok(ResponseDto.success(recommendations));
        } catch (Exception e) {
            log.error("펫별 추천 요청 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(ResponseDto.fail("ERROR", e.getMessage()));
        }
    }
}
