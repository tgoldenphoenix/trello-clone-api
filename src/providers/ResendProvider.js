import { Resend } from 'resend'
import { env } from '~/config/environment'

// tuyệt đối không push key lên Github
const RESEND_API_KEY = env.RESEND_API_KEY

// Nếu không có domain riêng thì phải dùng email của resend
// Muốn dùng personal email thì phải validate domain
const ADMIN_SENDER_EMAIL = env.ADMIN_SENDER_EMAIL

const resendInstance = new Resend(RESEND_API_KEY)

const sendEmail = async ({ to, subject, html }) => {
  try {
    const data = await resendInstance.emails.send({
      from: ADMIN_SENDER_EMAIL,
      to, // nếu chưa valid domain thì chỉ gởi được email mà bạn đăng ký tài khoảng resend
      subject,
      html
    })

    return data
  } catch (error) {
    console.log('🐦‍🔥 ResendProvider ~ sendEmail ~ error:', error)
    throw error
  }
}

export const ResendProvider = {
  sendEmail
}
