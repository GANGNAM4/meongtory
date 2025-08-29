package com.my.backend.chatbot.dto;

import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class ChatbotRequest {
    private String query;
    private Long petId;
    private String authToken;
}