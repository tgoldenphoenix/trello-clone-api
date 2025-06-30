import { userModel } from '~/models/userModel'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'
import bcryptjs from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { pickUser } from '~/utils/formatters'
import { WEBSITE_DOMAIN } from '~/utils/constants'
import { ResendProvider } from '~/providers/ResendProvider'
import { env } from '~/config/environment'
import { JwtProvider } from '~/providers/JwtProvider'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'

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
      // mặc định để giống username khi user đăng ký mới, về sau làm tính năng update cho user
      displayName: nameFromEmail,
      // Mặc định bên userModel khi không khai báo sẽ là false, để true ở đây trong trường hợp bạn không muốn gửi mail xác nhận tài khoản hoặc gặp lỗi trong quá trình tạo tài khoản Brevo. Và nhớ comment dòng code số 50 sendEmail phía dưới lại.
      // isActive: true,
      // a random-generated string used only once to verify user email
      verifyToken: uuidv4() // => '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
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
    // eslint-disable-next-line no-unused-vars
    const sentEmailResponse = await ResendProvider.sendEmail({
      // for now, can only send to anhaophamx email
      // delete account from mongoDB compass each time created
      to: getNewUser.email,
      subject: customSubject,
      html: htmlContent
    })
    // eslint-disable-next-line no-console
    // console.log('🐦‍🔥 userService ~ createNew ~ sentEmailResponse:', sentEmailResponse)

    // return trả về dữ liệu cho controller
    return pickUser(getNewUser)
  } catch (error) {throw error}
}

const verifyAccount = async (reqBody) => {
  try {
    // Query user trong Database
    const existUser = await userModel.findOneByEmail(reqBody.email)

    // Các bước kiểm tra cần thiết
    if (!existUser) throw new ApiError(StatusCodes.NOT_FOUND, 'Account not found!')
    if (existUser.isActive) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your account is already active!')
    if (reqBody.token !== existUser.verifyToken) {
      throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Token is invalid!')
    }

    // Nếu như mọi thứ ok thì chúng ta bắt đầu update lại thông tin của thằng user để verify account
    const updateData = {
      isActive: true,
      verifyToken: null
    }
    // Thực hiện update thông tin user
    const updatedUser = await userModel.update(existUser._id, updateData)

    return pickUser(updatedUser)
  } catch (error) { throw error }
}

const login = async (reqBody) => {
  try {
    // Query user trong Database
    const existUser = await userModel.findOneByEmail(reqBody.email)

    // Các bước kiểm tra cần thiết
    if (!existUser) throw new ApiError(StatusCodes.NOT_FOUND, 'Account not found!')
    if (!existUser.isActive) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your account is not active!')
    if (!bcryptjs.compareSync(reqBody.password, existUser.password)) {
      throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your Email or Password is incorrect!')
    }

    /** Nếu mọi thứ ok thì bắt đầu tạo Tokens đăng nhập để trả về cho phía FE */
    // Tạo thông tin để đính kèm trong JWT Token: bao gồm _id và email của user
    const userInfo = { _id: existUser._id, email: existUser.email }

    // Tạo ra 2 loại token, accessToken và refreshToken để trả về cho phía FE
    const accessToken = await JwtProvider.generateToken(
      userInfo,
      env.ACCESS_TOKEN_SECRET_SIGNATURE,
      // 5 // 5 giây for testing
      env.ACCESS_TOKEN_LIFE // 1 hour
    )

    const refreshToken = await JwtProvider.generateToken(
      userInfo,
      env.REFRESH_TOKEN_SECRET_SIGNATURE,
      // 15 // 15 giây
      env.REFRESH_TOKEN_LIFE // 14 days
    )

    // Trả về thông tin của user kèm theo 2 cái token vừa tạo ra
    return { accessToken, refreshToken, ...pickUser(existUser) }
  } catch (error) { throw error }
}

const refreshToken = async (clientRefreshToken) => {
  try {
    // Bước 01: Thực hiện giải mã refreshToken xem nó có hợp lệ hay là không
    const refreshTokenDecoded = await JwtProvider.verifyToken(
      clientRefreshToken,
      env.REFRESH_TOKEN_SECRET_SIGNATURE
    )
    // console.log('🐦‍🔥 ~ refreshToken ~ refreshTokenDecoded:', refreshTokenDecoded)

    // Đoạn này vì chúng ta chỉ lưu những thông tin unique và cố định của user trong token rồi, vì vậy có thể lấy luôn từ decoded ra, tiết kiệm query vào DB để lấy data mới.
    const userInfo = { _id: refreshTokenDecoded._id, email: refreshTokenDecoded.email }

    // Bước 02: Tạo ra cái accessToken mới
    const accessToken = await JwtProvider.generateToken(
      userInfo,
      env.ACCESS_TOKEN_SECRET_SIGNATURE,
      // 5 // 5 giây để test accessToken hết hạn
      env.ACCESS_TOKEN_LIFE // 1 tiếng
    )

    return { accessToken }
  } catch (error) { throw error }
}

const update = async (userId, reqBody, userAvatarFile) => {
  try {
    // Query User và kiểm tra cho chắc chắn
    const existUser = await userModel.findOneById(userId)
    if (!existUser) throw new ApiError(StatusCodes.NOT_FOUND, 'Account not found!')
    if (!existUser.isActive) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your account is not active!')

    // Khởi tạo kết quả updated User ban đầu là empty
    let updatedUser = {}

    // Trường hợp change password
    if (reqBody.current_password && reqBody.new_password) {
      // Kiểm tra xem cái current_password có đúng hay không
      if (!bcryptjs.compareSync(reqBody.current_password, existUser.password)) {
        throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your Current Password is incorrect!')
      }
      // Nếu như current_password là đúng thì chúng ta sẽ hash một cái mật khẩu mới và update lại vào DB:
      updatedUser = await userModel.update(existUser._id, {
        password: bcryptjs.hashSync(reqBody.new_password, 8)
      })
    } else if (userAvatarFile) {
      // Trường hợp upload file lên Cloud Storage, cụ thể là Cloudinary
      const uploadResult = await CloudinaryProvider.streamUpload(userAvatarFile.buffer, 'users')
      // console.log('🐦‍🔥 ~ update ~ uploadResult:', uploadResult)

      // Lưu lại url (secure_url) của cái file ảnh vào trong Database
      updatedUser = await userModel.update(existUser._id, {
        avatar: uploadResult.secure_url
      })
    } else {
      // Trường hợp update các thông tin chung, ví dụ như displayName
      updatedUser = await userModel.update(existUser._id, reqBody)
    }

    // Không có return là request sẽ bị hang infinitely
    return pickUser(updatedUser)
  } catch (error) { throw error }
}

export const userService = {
  createNew,
  verifyAccount,
  login,
  refreshToken,
  update
}