import 'multer'

declare global {
  namespace Express {
    interface Multer {
      File: {
        fieldname: string
        originalname: string
        encoding: string
        mimetype: string
        size: number
        buffer: Buffer
      }
    }
  }
}
