/**
 * Updated on August 17 2023
 */
import { StatusCodes } from 'http-status-codes'
import { boardService } from '~/services/boardService'

const createNew = async (req, res, next) => {
  try {
    // console.log('req.body: ', req.body)
    // console.log('req.query: ', req.query)
    // console.log('req.params: ', req.params)
    // console.log('req.files: ', req.files)
    // console.log('req.cookies: ', req.cookies)
    // console.log('req.jwtDecoded: ', req.jwtDecoded)

    // Điều hướng dữ liệu sang tầng Service
    const createdBoard = await boardService.createNew(req.body)

    // Có kết quả thì trả về phía Client
    res.status(StatusCodes.CREATED).json(createdBoard)
  } catch (error) { next(error) }
}

const getDetails = async (req, res, next) => {
  try {
    const boardId = req.params.id
    // nâng cao sẽ có thêm userId nữa để chỉ lấy board thuộc về user đó thôi
    const board = await boardService.getDetails(boardId)
    res.status(StatusCodes.OK).json(board)
  } catch (error) { next(error) }
}

const update = async (req, res, next) => {
  try {
    const boardId = req.params.id
    const updatedBoard = await boardService.update(boardId, req.body)

    res.status(StatusCodes.OK).json(updatedBoard)
  } catch (error) { next(error) }
}

const moveCardToDifferentColumn = async (req, res, next) => {
  try {
    const result = await boardService.moveCardToDifferentColumn(req.body)

    res.status(StatusCodes.OK).json(result)
  } catch (error) { next(error) }
}

const getBoards = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    // page và itemsPerPage được truyền vào trong query url từ phía FE nên BE sẽ lấy thông qua req.query
    const { page, itemsPerPage, q } = req.query
    const queryFilters = q
    // console.log(queryFilters)

    const results = await boardService.getBoards(userId, page, itemsPerPage, queryFilters)

    res.status(StatusCodes.OK).json(results)
  } catch (error) { next(error) }
}

export const boardController = {
  createNew,
  getDetails,
  update,
  moveCardToDifferentColumn,
  getBoards
}
