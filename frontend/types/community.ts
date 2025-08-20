// 커뮤니티 관련 타입들

export interface CommunityPost {
  id: number
  title: string
  content: string
  author: string
  date: string
  category: string
  boardType: string
  views: number
  likes: number
  comments: number
  tags: string[]
  ownerEmail?: string  
}

export interface Comment {
  id: number
  postId: number
  author: string
  content: string
  date: string
  likes: number
}

// 커뮤니티 페이지 Props
export interface CommunityPageProps {
  posts: CommunityPost[]
  onViewPost: (post: CommunityPost) => void
  onClose: () => void
  isLoggedIn: boolean
  onNavigateToWrite: () => void
}

export interface CommunityDetailPageProps {
  post: CommunityPost
  comments: Comment[]
  onBack: () => void
  onAddComment: (comment: Omit<Comment, "id" | "date" | "likes">) => void
  isLoggedIn: boolean
}

export interface CommunityWritePageProps {
  onClose: () => void
  onPublish: (post: Omit<CommunityPost, "id" | "date" | "views" | "likes" | "comments">) => void
  isLoggedIn: boolean
} 