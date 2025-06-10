import { userModel } from '~/models/userModel'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'
import bcryptjs from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { pickUser } from '~/utils/formatters'
import { WEBSITE_DOMAIN } from '~/utils/constants'
import { ResendProvider } from '~/providers/ResendProvider'

const createNew = async (reqBody) => {
  try {
    // Kiểm tra xem email đã tồn tại trong hệ thống của chúng ta hay chưa
    const existUser = await userModel.findOneByEmail(reqBody.email)
    if (existUser) {
      throw new ApiError(StatusCodes.CONFLICT, 'Email already exists!')
    }

    // Tạo data để lưu vào Database
    // nameFromEmail: nếu email là anhaopham@gmail.com thì sẽ lấy được "anhaopham"
    const nameFromEmail = reqBody.email.split('@')[0]
    const newUser = {
      email: reqBody.email,
      password: bcryptjs.hashSync(reqBody.password, 8), // Tham số thứ hai là độ phức tạp, giá trị càng cao thì băm càng lâu
      username: nameFromEmail,
      displayName: nameFromEmail, // mặc định để giống username khi user đăng ký mới, về sau làm tính năng update cho user
      // isActive: true, // Mặc định bên userModel khi không khai báo sẽ là false, để true ở đây trong trường hợp bạn không muốn gửi mail xác nhận tài khoản hoặc gặp lỗi trong quá trình tạo tài khoản Brevo. Và nhớ comment dòng code số 50 sendEmail phía dưới lại.
      verifyToken: uuidv4()
    }

    // Thực hiện lưu thông tin user vào Database
    const createdUser = await userModel.createNew(newUser)
    const getNewUser = await userModel.findOneById(createdUser.insertedId)

    // gởi email cho người dùng xác thực tài khoản
    const verificationLink = `${WEBSITE_DOMAIN}/account/verification?email=${getNewUser.email}&token=${getNewUser.verifyToken}`

    // subject (title) of the mail
    const customSubject = 'MERN Stack Trello: Please verify your email before using our services!'

    const htmlContent = `
      <h3>Here is your verification link:</h3>
      <h3>${verificationLink}</h3>
      <h3>Sincerely,<br/> - An Hao - </h3>
    `
    // Gọi tới cái Provider gửi mail
    const sentEmailResponse = await ResendProvider.sendEmail({
      // for now, can only send to anhaophamx email
      // delete account from mongoDB compass each time created
      to: getNewUser.email,
      subject: customSubject,
      html: htmlContent
    })
    // eslint-disable-next-line no-console
    console.log('🐦‍🔥 userService ~ createNew ~ sentEmailResponse:', sentEmailResponse)

    // return trả về dữ liệu cho controller
    return pickUser(getNewUser)
  } catch (error) {throw error}
}

export const userService = {
  createNew
}