package com.my.backend.breed.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.my.backend.breed.dto.BreedPredictionResponseDto;

@Service
public class BreedService {
    
    private final RestTemplate restTemplate;
    
    @Value("${ai.service.url}")
    private String aiServiceUrl;
    
    public BreedService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }
    
    public BreedPredictionResponseDto predictBreed(MultipartFile image) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", new ByteArrayResource(image.getBytes()) {
            @Override
            public String getFilename() {
                return image.getOriginalFilename();
            }
        });
        
        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
        
        ResponseEntity<BreedPredictionResponseDto> response = restTemplate.postForEntity(
            aiServiceUrl + "/api/ai/predict",
            requestEntity,
            BreedPredictionResponseDto.class
        );
        
        return response.getBody();
    }
}