package com.my.backend.insurance.controller;

import com.my.backend.global.dto.ResponseDto;
import com.my.backend.insurance.dto.InsuranceProductDto;
import com.my.backend.insurance.service.InsuranceService;
import com.my.backend.insurance.schedule.InsuranceCrawlerJob;
import com.my.backend.insurance.schedule.IntegratedInsuranceCrawler;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/insurance")
@RequiredArgsConstructor
public class InsuranceController {

    private final InsuranceService insuranceService;
    private final InsuranceCrawlerJob crawlerJob;
    private final IntegratedInsuranceCrawler integratedCrawler;

    @GetMapping
    public ResponseEntity<ResponseDto<List<InsuranceProductDto>>> list() {
        List<InsuranceProductDto> items = insuranceService.findAll();
        return ResponseEntity.ok(ResponseDto.success(items));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResponseDto<InsuranceProductDto>> get(@PathVariable Long id) {
        InsuranceProductDto dto = insuranceService.findById(id);
        return ResponseEntity.ok(ResponseDto.success(dto));
    }

    @GetMapping("/{id}/details")
    public ResponseEntity<ResponseDto<InsuranceProductDto>> getDetails(@PathVariable Long id) {
        InsuranceProductDto dto = insuranceService.findById(id);
        if (dto == null) {
            return ResponseEntity.notFound().build();
        }
        
        // 상세 정보 크롤링
        InsuranceProductDto detailedDto = crawlerJob.crawlProductDetails(dto);
        return ResponseEntity.ok(ResponseDto.success(detailedDto));
    }

    @PostMapping
    public ResponseEntity<ResponseDto<InsuranceProductDto>> create(@RequestBody InsuranceProductDto dto) {
        InsuranceProductDto saved = insuranceService.upsert(dto);
        return ResponseEntity.created(URI.create("/api/insurance/" + saved.getId()))
                .body(ResponseDto.success(saved));
    }

    /**
     * 수동 크롤링 (기본 데이터 + 로고 업데이트, ADMIN 전용)
     */
    @PostMapping("/manual-crawl")
    public ResponseEntity<ResponseDto<String>> manualCrawl() {
        // ADMIN 권한 체크
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || 
            !authentication.getAuthorities().stream().anyMatch(auth -> auth.getAuthority().equals("ROLE_ADMIN"))) {
            return ResponseEntity.status(403).body(ResponseDto.fail("FORBIDDEN", "ADMIN 권한이 필요합니다."));
        }
        
        // 새로운 통합 크롤링 시스템 사용
        integratedCrawler.runMainPageCrawling();
        
        return ResponseEntity.ok(ResponseDto.success("개선된 크롤링 시스템으로 수동 크롤링 완료"));
    }

    /**
     * 상세 정보 크롤링 (개선된 버전)
     */
    @GetMapping("/{id}/detailed-crawl")
    public ResponseEntity<ResponseDto<InsuranceProductDto>> getDetailedCrawl(@PathVariable Long id) {
        InsuranceProductDto basicProduct = insuranceService.findById(id);
        if (basicProduct == null) {
            return ResponseEntity.notFound().build();
        }
        
        // 개선된 상세 크롤링 시스템 사용
        InsuranceProductDto detailedProduct = integratedCrawler.crawlForDetailPage(basicProduct.getCompany());
        return ResponseEntity.ok(ResponseDto.success(detailedProduct));
    }

    /**
     * 크롤링 상태 확인
     */
    @GetMapping("/crawling-status")
    public ResponseEntity<ResponseDto<IntegratedInsuranceCrawler.CrawlingStatus>> getCrawlingStatus() {
        IntegratedInsuranceCrawler.CrawlingStatus status = integratedCrawler.getCrawlingStatus();
        return ResponseEntity.ok(ResponseDto.success(status));
    }

    /**
     * 크롤링 테스트 (개발용)
     */
    @PostMapping("/test-crawl")
    public ResponseEntity<ResponseDto<String>> testCrawl() {
        try {
            // 삼성화재 펫보험 페이지 테스트
            String testUrl = "https://direct.samsungfire.com/m/fp/pet.html";
            
            // 간단한 연결 테스트
            try {
                // HTTP 연결 테스트
                java.net.URL url = new java.net.URL(testUrl);
                java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
                
                int responseCode = connection.getResponseCode();
                boolean isAccessible = responseCode == 200;
                
                return ResponseEntity.ok(ResponseDto.success(
                    String.format("크롤링 테스트 성공 - URL: %s, 응답코드: %d, 접근가능: %s", testUrl, responseCode, isAccessible)
                ));
                
            } catch (Exception e) {
                return ResponseEntity.ok(ResponseDto.success("크롤링 테스트 실패: " + e.getMessage()));
            }
            
        } catch (Exception e) {
            return ResponseEntity.ok(ResponseDto.success("크롤링 테스트 오류: " + e.getMessage()));
        }
    }
}

