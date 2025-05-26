// Những domain được phép truy cập tới tài nguyên của Server
export const WHITELIST_DOMAINS = [
  // 'http://localhost:5173' // Không cần localhost nữa vì ở file config/cors đã luôn luôn cho phép môi trường dev (env.BUILD_MODE === 'dev')

  // Lưu ý: Đây là domain ví dụ sau khi Deploy Production (xem v75 và v76 để hiểu)
  'https://trello-web-mu.vercel.app', // example domain, no trailing `/`
  'https://trello-web-sage-psi.vercel.app' // anhao's render domain
]

export const BOARD_TYPES = {
  PUBLIC: 'public',
  PRIVATE: 'private'
}
