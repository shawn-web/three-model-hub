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
import { GeoMapsService } from './geo-maps.service'
import {
  CreateGeoMapDto,
  UpdateGeoMapDto,
  AddGeoMapModelDto,
  UpdateGeoMapModelDto,
  BatchUpdateGeoMapModelsDto,
  SaveGeoMapConfigDto,
} from './dto/geo-map.dto'

/**
 * 地理地图管理控制器
 * 提供地图和地图-模型关联的 CRUD 接口
 */
@Controller('geo-maps')
export class GeoMapsController {
  constructor(private readonly geoMapsService: GeoMapsService) {}

  /** 获取地图列表 */
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.geoMapsService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    })
  }

  /** 获取地图详情 */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.geoMapsService.findOne(id)
  }

  /** 获取地图完整数据（用于前端渲染） */
  @Get(':id/data')
  async getMapData(@Param('id', ParseUUIDPipe) id: string) {
    return this.geoMapsService.getMapData(id)
  }

  /** 获取 iframe 嵌入配置（frame-ancestors 白名单 + allowedOrigins），供 nginx 和父页面使用 */
  @Get(':id/iframe-config')
  async getIframeConfig(@Param('id', ParseUUIDPipe) id: string) {
    return this.geoMapsService.getIframeConfig(id)
  }

  /** 创建地图 */
  @Post()
  async create(@Body() dto: CreateGeoMapDto) {
    return this.geoMapsService.create(dto)
  }

  /** 更新地图 */
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGeoMapDto,
  ) {
    return this.geoMapsService.update(id, dto)
  }

  /** 删除地图 */
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.geoMapsService.remove(id)
    return { success: true }
  }

  /** 添加模型到地图 */
  @Post(':id/models')
  async addModel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddGeoMapModelDto,
  ) {
    return this.geoMapsService.addModel(id, dto)
  }

  /** 统一保存 Geo 配置（原子操作：同时保存模型坐标 + 底图配置） */
  @Put(':id/geo')
  async saveGeoConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveGeoMapConfigDto,
  ) {
    return this.geoMapsService.saveGeoConfig(id, dto)
  }

  /** 批量更新地图中的模型配置（必须放在 :mid 路由之前，避免 :mid 匹配到 'batch'） */
  @Put(':id/models/batch')
  async batchUpdateModels(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BatchUpdateGeoMapModelsDto,
  ) {
    await this.geoMapsService.batchUpdateModels(id, dto.models)
    return { success: true }
  }

  /** 更新地图中的模型 */
  @Put(':id/models/:mid')
  async updateModel(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mid', ParseUUIDPipe) mid: string,
    @Body() dto: UpdateGeoMapModelDto,
  ) {
    return this.geoMapsService.updateModel(id, mid, dto)
  }

  /** 从地图中移除模型 */
  @Delete(':id/models/:mid')
  async removeModel(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mid', ParseUUIDPipe) mid: string,
  ) {
    await this.geoMapsService.removeModel(id, mid)
    return { success: true }
  }
}
