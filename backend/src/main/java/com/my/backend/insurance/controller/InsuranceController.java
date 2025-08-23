package com.my.backend.insurance.controller;

import com.my.backend.global.dto.ResponseDto;
import com.my.backend.insurance.dto.InsuranceProductDto;
import com.my.backend.insurance.service.InsuranceService;
import com.my.backend.insurance.schedule.InsuranceCrawlerJob;
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
        
        // 기존 데이터 업데이트 + 새 데이터 추가
        crawlerJob.runOnce();
        
        // 로고 업데이트
        insuranceService.updateAllLogos();
        
        return ResponseEntity.ok(ResponseDto.success("수동 크롤링 완료 (기본 데이터 + 로고 업데이트)"));
    }
}

