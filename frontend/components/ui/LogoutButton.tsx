"use client";

import type React from "react";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { getBackendUrl } from "@/lib/api";

interface LogoutButtonProps {
  onLogout: () => void;
}

export default function LogoutButton({ onLogout }: LogoutButtonProps) {
  const handleLogout = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        throw new Error("로그인 상태가 아닙니다.");
      }


      await axios.post(`${getBackendUrl()}/api/accounts/logout`, {}, 
      {
        headers: {
          "Content-Type": "application/json",
          "Access_Token": accessToken,
        },
      });

      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");

      onLogout();
    } catch (err: any) {
      console.error("로그아웃 실패:", err.response?.data?.message || err.message);
    }
  };

  return (
    <Button onClick={handleLogout} className="bg-red-500 text-white hover:bg-red-600">
      로그아웃
    </Button>
  );
}