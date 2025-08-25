package com.my.backend.insurance.controller;

import com.my.backend.global.dto.ResponseDto;
import com.my.backend.insurance.dto.InsuranceProductDto;
import com.my.backend.insurance.service.InsuranceService;
import com.my.backend.insurance.schedule.IntegratedInsuranceCrawler;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;

import java.util.List;

@RestController
@RequestMapping("/api/insurance")
@RequiredArgsConstructor
public class InsuranceController {

    private final InsuranceService insuranceService;
    private final IntegratedInsuranceCrawler integratedInsuranceCrawler;

    @GetMapping
    public ResponseEntity<ResponseDto<List<InsuranceProductDto>>> list() {
        List<InsuranceProductDto> items = insuranceService.findAll();
        return ResponseEntity.ok(ResponseDto.success(items));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResponseDto<InsuranceProductDto>> getInsuranceById(@PathVariable Long id) {
        try {
            InsuranceProductDto insurance = insuranceService.findById(id);
            return ResponseEntity.ok(ResponseDto.success(insurance));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ResponseDto.fail("ERROR", "보험 상품 조회 실패: " + e.getMessage()));
        }
    }

    @PostMapping("/manual-crawl")
    public ResponseEntity<ResponseDto<String>> manualCrawl() {
        try {
            integratedInsuranceCrawler.runMainPageCrawling();
            return ResponseEntity.ok(ResponseDto.success("수동 크롤링이 완료되었습니다."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ResponseDto.fail("ERROR", "수동 크롤링 실패: " + e.getMessage()));
        }
    }
}

