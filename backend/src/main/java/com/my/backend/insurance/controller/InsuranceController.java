package com.my.backend.insurance.controller;

import com.my.backend.global.dto.ResponseDto;
import com.my.backend.insurance.dto.InsuranceProductDto;
import com.my.backend.insurance.service.InsuranceService;
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

    @PostMapping
    public ResponseEntity<ResponseDto<InsuranceProductDto>> create(@RequestBody InsuranceProductDto dto) {
        InsuranceProductDto saved = insuranceService.create(dto);
        return ResponseEntity.created(URI.create("/api/insurance/" + saved.getId()))
                .body(ResponseDto.success(saved));
    }
}

