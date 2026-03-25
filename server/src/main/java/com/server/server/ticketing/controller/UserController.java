package com.server.server.ticketing.controller;

import com.server.server.common.ApiResponse;
import com.server.server.ticketing.dto.response.UserProfileResponse;
import com.server.server.ticketing.dto.response.UserSummaryResponse;
import com.server.server.ticketing.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController("ticketingUserController")
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getCurrentUser() {
        return ResponseEntity.ok(ApiResponse.success(
                "Current user fetched successfully",
                userService.getCurrentUserProfile()
        ));
    }

    @GetMapping("/technicians")
    public ResponseEntity<ApiResponse<List<UserSummaryResponse>>> getTechnicians() {
        return ResponseEntity.ok(ApiResponse.success(
                "Technicians fetched successfully",
                userService.getTechnicians()
        ));
    }
}
