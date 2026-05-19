import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common'
import { ScenesService } from './scenes.service'
import {
  CreateSceneDto,
  UpdateSceneDto,
  AddSceneModelDto,
  UpdateSceneModelDto,
  BatchUpdateSceneModelsDto,
} from './dto/scene.dto'

/**
 * 场景管理控制器
 * 提供场景和场景-模型关联的 CRUD 接口
 */
@Controller('scenes')
export class ScenesController {
  constructor(private readonly scenesService: ScenesService) {}

  /** 获取场景列表 */
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.scenesService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    })
  }

  /** 获取场景详情 */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.scenesService.findOne(id)
  }

  /** 获取场景完整数据（用于预览） */
  @Get(':id/data')
  async getSceneData(@Param('id', ParseUUIDPipe) id: string) {
    return this.scenesService.getSceneData(id)
  }

  /** 创建场景 */
  @Post()
  async create(@Body() dto: CreateSceneDto) {
    return this.scenesService.create(dto)
  }

  /** 更新场景 */
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSceneDto,
  ) {
    return this.scenesService.update(id, dto)
  }

  /** 删除场景 */
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.scenesService.remove(id)
    return { success: true }
  }

  /** 添加模型到场景 */
  @Post(':id/models')
  async addModel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddSceneModelDto,
  ) {
    return this.scenesService.addModel(id, dto)
  }

  /** 更新场景中的模型 */
  @Put(':id/models/:mid')
  async updateModel(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mid', ParseUUIDPipe) mid: string,
    @Body() dto: UpdateSceneModelDto,
  ) {
    return this.scenesService.updateModel(id, mid, dto)
  }

  /** 从场景中移除模型 */
  @Delete(':id/models/:mid')
  async removeModel(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mid', ParseUUIDPipe) mid: string,
  ) {
    await this.scenesService.removeModel(id, mid)
    return { success: true }
  }

  /** 批量更新场景中的模型配置 */
  @Put(':id/models/batch')
  async batchUpdateModels(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BatchUpdateSceneModelsDto,
  ) {
    await this.scenesService.batchUpdateModels(id, dto.models)
    return { success: true }
  }
}
