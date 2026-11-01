import { IsArray, IsOptional, IsObject, ValidateNested, ArrayMaxSize, ArrayMinSize } from "class-validator"
import { Type } from "class-transformer"
import { BatchSceneModelItemDto } from "./scene.dto"

/** Geo 统一保存 DTO */
export class SaveGeoConfigDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BatchSceneModelItemDto)
  models: BatchSceneModelItemDto[]

  @IsOptional()
  @IsObject()
  geoConfig?: Record<string, any>
}
