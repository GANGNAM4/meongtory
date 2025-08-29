package com.my.backend.search.controller;

import com.my.backend.global.dto.ResponseDto;
import com.my.backend.global.security.user.UserDetailsImpl;
import com.my.backend.search.dto.SearchRequestDto;
import com.my.backend.search.dto.SearchResponseDto;
import com.my.backend.search.service.GlobalSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/global-search")
@Slf4j
@CrossOrigin(origins = "*")
public class GlobalSearchController {

    private final GlobalSearchService globalSearchService;
    
    public GlobalSearchController(GlobalSearchService globalSearchService) {
        this.globalSearchService = globalSearchService;
    }

    @GetMapping
    public ResponseEntity<ResponseDto<SearchResponseDto>> search(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam String query,
            @RequestParam(required = false) Long petId,
            @RequestParam String searchType) {
        try {
            Long userId = userDetails.getId();
            SearchRequestDto request = new SearchRequestDto();
            request.setQuery(query);
            request.setPetId(petId);
            request.setSearchType(searchType);
            SearchResponseDto response = globalSearchService.performSearch(userId, request);
            return ResponseEntity.ok(ResponseDto.success(response));
        } catch (Exception e) {
            log.error("Search failed", e);
            return ResponseEntity.badRequest().body(ResponseDto.fail("ERROR", e.getMessage()));
        }
    }
}