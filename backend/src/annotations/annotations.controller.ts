import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common'
import { AnnotationsService } from './annotations.service'
import { CreateAnnotationDto, UpdateAnnotationDto } from './dto/annotation.dto'

/**
 * 批注管理控制器
 * 提供场景批注的 CRUD 接口
 */
@Controller('scenes/:sceneId/annotations')
export class AnnotationsController {
  constructor(private readonly annotationsService: AnnotationsService) {}

  /** 获取场景的所有批注 */
  @Get()
  async findAll(@Param('sceneId', ParseUUIDPipe) sceneId: string) {
    return this.annotationsService.findAll(sceneId)
  }

  /** 获取单条批注详情 */
  @Get(':id')
  async findOne(
    @Param('sceneId', ParseUUIDPipe) sceneId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.annotationsService.findOne(id)
  }

  /** 创建批注 */
  @Post()
  async create(
    @Param('sceneId', ParseUUIDPipe) sceneId: string,
    @Body() dto: CreateAnnotationDto,
  ) {
    return this.annotationsService.create(sceneId, dto)
  }

  /** 更新批注 */
  @Patch(':id')
  async update(
    @Param('sceneId', ParseUUIDPipe) sceneId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnnotationDto,
  ) {
    return this.annotationsService.update(id, dto)
  }

  /** 删除批注 */
  @Delete(':id')
  async remove(
    @Param('sceneId', ParseUUIDPipe) sceneId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.annotationsService.remove(id)
    return { success: true }
  }
}
