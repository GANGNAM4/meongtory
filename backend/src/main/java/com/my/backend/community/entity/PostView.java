package com.my.backend.community.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "post_views")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostView {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "post_id")
    private Long postId;

    @Column(name = "user_email")
    private String userEmail;

    @Column(name = "ip_address")
    private String ipAddress;

    @Column(name = "viewed_at")
    private LocalDateTime viewedAt;

    @PrePersist
    public void prePersist() {
        this.viewedAt = LocalDateTime.now();
    }
}
