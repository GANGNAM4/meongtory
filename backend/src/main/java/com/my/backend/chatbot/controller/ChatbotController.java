package com.my.backend.chatbot.controller;

import com.my.backend.chatbot.dto.ChatbotRequest;
import com.my.backend.chatbot.dto.ChatbotResponse;
import com.my.backend.chatbot.service.ChatbotService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chatbot")
public class ChatbotController {
    private final ChatbotService chatbotService;

    public ChatbotController(ChatbotService chatbotService) {
        this.chatbotService = chatbotService;
    }

    @PostMapping("/query")
    public ChatbotResponse query(@RequestBody ChatbotRequest request) {
        return chatbotService.queryAI(request);
    }

    @PostMapping("/insurance")
    public ChatbotResponse insuranceQuery(@RequestBody ChatbotRequest request) {
        return chatbotService.queryInsuranceAI(request);
    }
}