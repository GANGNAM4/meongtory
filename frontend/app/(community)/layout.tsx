"use client"

import React, { ReactNode } from "react"

interface CommunityLayoutProps {
  children: ReactNode
}

export default function CommunityLayout({ children }: CommunityLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">


        {children}
      </div>
    </div>
  )
}
