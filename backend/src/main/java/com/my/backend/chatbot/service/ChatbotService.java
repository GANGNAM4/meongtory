package com.my.backend.chatbot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.my.backend.chatbot.dto.ChatbotRequest;
import com.my.backend.chatbot.dto.ChatbotResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;


@Service
public class ChatbotService {

    private final RestTemplate restTemplate;

    public ChatbotService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public ChatbotResponse queryAI(ChatbotRequest request) {
        try {
            String aiServiceUrl = "http://ai:9000/chatbot";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(Arrays.asList(MediaType.APPLICATION_JSON, MediaType.APPLICATION_JSON_UTF8));
            headers.set("Accept-Charset", "UTF-8");
            
            // AI 서비스로 전송할 데이터 (토큰 제외)
            Map<String, Object> requestData = new HashMap<>();
            requestData.put("query", request.getQuery());
            
            // petId가 null이 아닐 때만 추가
            if (request.getPetId() != null) {
                requestData.put("petId", request.getPetId().intValue()); // Long을 int로 변환
            }
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestData, headers);

            System.out.println("Sending request to AI service: " + aiServiceUrl + " with query: " + request.getQuery() + ", petId: " + request.getPetId());
            System.out.println("Request data: " + requestData);

            ResponseEntity<String> rawResponse = restTemplate.exchange(
                    aiServiceUrl,
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            System.out.println("Raw AI service response: " + rawResponse.getBody());

            ObjectMapper mapper = new ObjectMapper();
            JsonNode jsonNode = mapper.readTree(rawResponse.getBody());
            String answer = jsonNode.get("answer").asText();

            ChatbotResponse response = new ChatbotResponse(answer);
            System.out.println("Parsed response from AI service: " + response.getAnswer());
            return response;
        } catch (Exception e) {
            System.err.println("Error in AI service request: " + e.getMessage());
            e.printStackTrace();
            return new ChatbotResponse("챗봇 요청 처리 중 오류 발생: " + e.getMessage());
        }
    }

    public ChatbotResponse queryInsuranceAI(ChatbotRequest request) {
        try {
            String aiServiceUrl = "http://ai:9000/chatbot/insurance";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(Arrays.asList(MediaType.APPLICATION_JSON, MediaType.APPLICATION_JSON_UTF8));
            headers.set("Accept-Charset", "UTF-8");
            
            // AI 서비스로 전송할 데이터 (토큰 제외)
            Map<String, Object> requestData = new HashMap<>();
            requestData.put("query", request.getQuery());
            if (request.getPetId() != null) {
                requestData.put("petId", request.getPetId().intValue()); // Long을 int로 변환
            }
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestData, headers);

            System.out.println("Sending insurance request to AI service: " + aiServiceUrl + " with query: " + request.getQuery() + ", petId: " + request.getPetId());
            System.out.println("Request data: " + requestData);

            ResponseEntity<String> rawResponse = restTemplate.exchange(
                    aiServiceUrl,
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            System.out.println("Raw insurance AI service response: " + rawResponse.getBody());

            ObjectMapper mapper = new ObjectMapper();
            JsonNode jsonNode = mapper.readTree(rawResponse.getBody());
            String answer = jsonNode.get("answer").asText();

            ChatbotResponse response = new ChatbotResponse(answer);
            System.out.println("Parsed insurance response from AI service: " + response.getAnswer());
            return response;
        } catch (Exception e) {
            System.err.println("Error in insurance AI service request: " + e.getMessage());
            e.printStackTrace();
            return new ChatbotResponse("보험 챗봇 요청 처리 중 오류 발생: " + e.getMessage());
        }
    }
}