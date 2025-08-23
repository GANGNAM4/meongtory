package com.my.backend.insurance.controller;

import com.my.backend.global.dto.ResponseDto;
import com.my.backend.insurance.dto.InsuranceProductDto;
import com.my.backend.insurance.service.InsuranceService;
import com.my.backend.insurance.schedule.InsuranceCrawlerJob;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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

    // 수동 트리거용 (관리자 보호 필요시 ROLE 검사 추가 가능)
    @PostMapping("/crawl-now")
    public ResponseEntity<ResponseDto<String>> crawlNow() {
        // 기존 데이터 정리 후 수집
        insuranceService.deleteAll();
        crawlerJob.runOnce();
        return ResponseEntity.ok(ResponseDto.success("crawled"));
    }
}

