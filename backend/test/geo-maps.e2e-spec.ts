import request from 'supertest'
import { Test, TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { Model } from '../src/models/entities/model.entity'
import { ModelVersion } from '../src/models/entities/model-version.entity'
import { Scene } from '../src/scenes/entities/scene.entity'
import { SceneModel } from '../src/scenes/entities/scene-model.entity'
import { SceneImage } from '../src/scenes/entities/scene-image.entity'
import { GeoMap } from '../src/geo-maps/entities/geo-map.entity'
import { GeoMapModel } from '../src/geo-maps/entities/geo-map-model.entity'
import { ScenesModule } from '../src/scenes/scenes.module'
import { ModelsModule } from '../src/models/models.module'
import { GeoMapsModule } from '../src/geo-maps/geo-maps.module'

/**
 * Geo Maps 与场景 /geo 端点 e2e 测试
 * 使用真实 MySQL（参考 api.e2e-spec.ts 模式）
 *
 * 注意：依赖 MySQL 处于运行状态；CI 需先启动数据库服务。
 */
describe('Geo Maps & Scenes /geo API 端到端测试', () => {
  let app: INestApplication
  let dataSource: DataSource
  let testMapId: string
  let testModelId: string
  let testSceneId: string
  let testMapModelId: string
  const createdSceneIds: string[] = []
  const createdMapIds: string[] = []
  const createdModelIds: string[] = []

  // 唯一前缀避免与现有 api.e2e-spec.ts 数据冲突
  const TAG = 'geo-e2e-test'

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
        TypeOrmModule.forRoot({
          type: 'mysql',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '3306', 10),
          username: process.env.DB_USERNAME || 'root',
          password: process.env.DB_PASSWORD || 'root',
          database: process.env.DB_DATABASE || 'three_model_hub_test',
          entities: [
            Model,
            ModelVersion,
            Scene,
            SceneModel,
            SceneImage,
            GeoMap,
            GeoMapModel,
          ],
          synchronize: true,
          dropSchema: true,
          charset: 'utf8mb4',
          logging: false,
        }),
        ModelsModule,
        ScenesModule,
        GeoMapsModule,
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    // 启用全局 ValidationPipe（与 main.ts 一致）以触发 DTO 校验 → 400
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
    dataSource = moduleFixture.get(DataSource)

    // 直接通过 TypeORM 仓库创建依赖数据（避免 HTTP 调用链副作用）
    const modelRepo = dataSource.getRepository(Model)
    const model = modelRepo.create({
      name: `${TAG}-model`,
      description: 'Geo e2e 测试模型',
      file_url: 'https://cdn.example.com/test.glb',
    })
    const savedModel = await modelRepo.save(model)
    testModelId = savedModel.id
    createdModelIds.push(testModelId)

    const sceneRepo = dataSource.getRepository(Scene)
    const scene = sceneRepo.create({ name: `${TAG}-scene` })
    const savedScene = await sceneRepo.save(scene)
    testSceneId = savedScene.id
    createdSceneIds.push(testSceneId)
  })

  afterAll(async () => {
    // 清理测试数据
    for (const id of createdMapIds) {
      await request(app.getHttpServer())
        .delete(`/api/geo-maps/${id}`)
        .catch(() => {})
    }
    for (const id of createdSceneIds) {
      await request(app.getHttpServer())
        .delete(`/api/scenes/${id}`)
        .catch(() => {})
    }
    for (const id of createdModelIds) {
      await request(app.getHttpServer())
        .delete(`/api/models/${id}`)
        .catch(() => {})
    }
    await app.close()
  })

  // ─── Geo Maps CRUD ────────────────────────────────────
  describe('Geo Maps API', () => {
    it('POST /api/geo-maps 应创建地图', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/geo-maps')
        .send({
          name: `${TAG}-map`,
          description: 'Geo e2e 测试地图',
          config: { geo: { imageryProvider: 'tianditu' } },
        })
        .expect(201)

      testMapId = res.body.id
      createdMapIds.push(testMapId)
      expect(testMapId).toBeDefined()
      expect(res.body.name).toBe(`${TAG}-map`)
    })

    it('GET /api/geo-maps 应返回地图列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/geo-maps')
        .expect(200)

      expect(res.body).toHaveProperty('items')
      expect(res.body).toHaveProperty('total')
      expect(Array.isArray(res.body.items)).toBe(true)
      const found = res.body.items.find((m: any) => m.id === testMapId)
      expect(found).toBeDefined()
    })

    it('GET /api/geo-maps/:id 应返回详情', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/geo-maps/${testMapId}`)
        .expect(200)
      expect(res.body.id).toBe(testMapId)
    })

    it('GET /api/geo-maps/:id 不存在应返回 404', async () => {
      await request(app.getHttpServer())
        .get('/api/geo-maps/00000000-0000-0000-0000-000000000000')
        .expect(404)
    })

    it('PUT /api/geo-maps/:id 应更新地图', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/geo-maps/${testMapId}`)
        .send({ name: `${TAG}-map-updated` })
        .expect(200)
      expect(res.body.name).toBe(`${TAG}-map-updated`)
    })
  })

  // ─── 模型关联 ────────────────────────────────────────
  describe('Geo Map Models 关联', () => {
    it('POST /api/geo-maps/:id/models 应添加模型到地图', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/geo-maps/${testMapId}/models`)
        .send({
          model_id: testModelId,
          display_name: 'test-model',
          geo_position: { longitude: 116.4, latitude: 39.9, altitude: 50, heading: 0, pitch: 0, roll: 0, scale: 1 },
        })
        .expect(201)

      testMapModelId = res.body.id
      expect(testMapModelId).toBeDefined()
      expect(res.body.geo_position.longitude).toBe(116.4)
    })

    it('GET /api/geo-maps/:id/data 应返回带 JOIN 的完整数据', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/geo-maps/${testMapId}/data`)
        .expect(200)

      expect(res.body.id).toBe(testMapId)
      expect(Array.isArray(res.body.models)).toBe(true)
      expect(res.body.models.length).toBeGreaterThan(0)
      // JOIN 后应包含 file_url
      const m = res.body.models[0]
      expect(m.file_url).toBeDefined()
    })

    it('PUT /api/geo-maps/:id/models/:mid 应更新模型 geo_position', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/geo-maps/${testMapId}/models/${testMapModelId}`)
        .send({
          geo_position: { longitude: 121.4, latitude: 31.2, altitude: 100, heading: 0, pitch: 0, roll: 0, scale: 1 },
        })
        .expect(200)
      expect(res.body.geo_position.longitude).toBe(121.4)
    })

    it('PUT /api/geo-maps/:id/geo 应原子保存 models + config', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/geo-maps/${testMapId}/geo`)
        .send({
          models: [
            {
              id: testMapModelId,
              geo_position: { longitude: 50, latitude: 50, altitude: 0, heading: 0, pitch: 0, roll: 0, scale: 1 },
            },
          ],
          geoConfig: { imageryProvider: 'google', imageryType: 'terrain' },
        })
        .expect(200)

      const after = await request(app.getHttpServer())
        .get(`/api/geo-maps/${testMapId}/data`)
        .expect(200)

      // 验证 config 已合并
      expect(after.body.config.geo.imageryProvider).toBe('google')
      expect(after.body.config.geo.imageryType).toBe('terrain')
      // 验证 geo_position 真的落库了（commit ③ fix 后）
      const m = after.body.models.find((x: any) => x.id === testMapModelId)
      expect(m).toBeDefined()
      expect(m.geo_position.longitude).toBe(50)
      expect(m.geo_position.latitude).toBe(50)
    })

    it('PUT /api/geo-maps/:id/geo 缺 models 应返回 400', async () => {
      await request(app.getHttpServer())
        .put(`/api/geo-maps/${testMapId}/geo`)
        .send({ geoConfig: { foo: 'bar' } })
        .expect(400)
    })

    it('DELETE /api/geo-maps/:id/models/:mid 应从地图移除模型', async () => {
      await request(app.getHttpServer())
        .delete(`/api/geo-maps/${testMapId}/models/${testMapModelId}`)
        .expect(200)

      // 验证模型已移除
      const after = await request(app.getHttpServer())
        .get(`/api/geo-maps/${testMapId}/data`)
        .expect(200)
      const m = after.body.models.find((x: any) => x.id === testMapModelId)
      expect(m).toBeUndefined()
    })
  })

  // ─── Scenes /geo 端点 ────────────────────────────────────
  // 历史说明：ScenesService.batchUpdateModels 曾因 Object.values(Map) bug
  //  导致 geo_position 不落库（pending-issues.md pi-001）。
  // 本轮 polish commit 同步修了两边（geo-maps 早已在 commit ③ 静默修复），
  // 下方 PUT /geo 端到端测试可启用 geo_position 真断言。
  describe('Scenes /geo API', () => {
    let sceneModelId: string

    it('应先添加模型到 scene', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/scenes/${testSceneId}/models`)
        .send({ model_id: testModelId, display_name: 'geo-scene-model' })
        .expect(201)
      sceneModelId = res.body.id
    })

    it('PUT /api/scenes/:id/geo 应原子保存 models + config', async () => {
      await request(app.getHttpServer())
        .put(`/api/scenes/${testSceneId}/geo`)
        .send({
          models: [
            {
              id: sceneModelId,
              geo_position: { longitude: 100, latitude: 50, altitude: 10, heading: 0, pitch: 0, roll: 0, scale: 1 },
            },
          ],
          geoConfig: { imageryType: 'vector' },
        })
        .expect(200)

      // 拉回场景数据验证 geo_position 已落库
      const after = await request(app.getHttpServer())
        .get(`/api/scenes/${testSceneId}`)
        .expect(200)
      const m = after.body.scene_models.find((x: any) => x.id === sceneModelId)
      expect(m).toBeDefined()
      expect(m.geo_position.longitude).toBe(100)
    })

    it('PUT /api/scenes/:id/geo 缺 models 应返回 400', async () => {
      await request(app.getHttpServer())
        .put(`/api/scenes/${testSceneId}/geo`)
        .send({ geoConfig: { foo: 'bar' } })
        .expect(400)
    })

    it('PUT /api/scenes/:id/geo 不存在的 sceneId 应返回 404', async () => {
      await request(app.getHttpServer())
        .put('/api/scenes/00000000-0000-0000-0000-000000000000/geo')
        .send({ models: [{ id: 'm-1' }] })
        .expect(404)
    })
  })
})
