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
import { ViewpointsService } from './viewpoints.service'
import { CreateViewpointDto, UpdateViewpointDto } from './dto/viewpoint.dto'

/**
 * 视点管理控制器
 * 提供场景视点的 CRUD 接口
 */
@Controller('scenes/:sceneId/viewpoints')
export class ViewpointsController {
  constructor(private readonly viewpointsService: ViewpointsService) {}

  /** 获取场景的所有视点 */
  @Get()
  async findAll(@Param('sceneId', ParseUUIDPipe) sceneId: string) {
    return this.viewpointsService.findAll(sceneId)
  }

  /** 获取单个视点详情 */
  @Get(':id')
  async findOne(
    @Param('sceneId', ParseUUIDPipe) sceneId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.viewpointsService.findOne(id)
  }

  /** 创建视点 */
  @Post()
  async create(
    @Param('sceneId', ParseUUIDPipe) sceneId: string,
    @Body() dto: CreateViewpointDto,
  ) {
    return this.viewpointsService.create(sceneId, dto)
  }

  /** 更新视点 */
  @Patch(':id')
  async update(
    @Param('sceneId', ParseUUIDPipe) sceneId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateViewpointDto,
  ) {
    return this.viewpointsService.update(id, dto)
  }

  /** 删除视点 */
  @Delete(':id')
  async remove(
    @Param('sceneId', ParseUUIDPipe) sceneId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.viewpointsService.remove(id)
    return { success: true }
  }
}
