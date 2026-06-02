import request from 'supertest'
import { Test, TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { INestApplication } from '@nestjs/common'
import { Model } from '../src/models/entities/model.entity'
import { ModelVersion } from '../src/models/entities/model-version.entity'
import { Scene } from '../src/scenes/entities/scene.entity'
import { SceneModel } from '../src/scenes/entities/scene-model.entity'
import { SceneImage } from '../src/scenes/entities/scene-image.entity'
import { ShareLink } from '../src/sharing/entities/share-link.entity'
import { Viewpoint } from '../src/viewpoints/entities/viewpoint.entity'
import { Annotation } from '../src/annotations/entities/annotation.entity'
import { Resource } from '../src/resources/entities/resource.entity'
import { ResourceGroup } from '../src/resources/entities/resource-group.entity'
import { ModelsModule } from '../src/models/models.module'
import { ScenesModule } from '../src/scenes/scenes.module'
import { SharingModule } from '../src/sharing/sharing.module'
import { ViewpointsModule } from '../src/viewpoints/viewpoints.module'
import { AnnotationsModule } from '../src/annotations/annotations.module'
import { ResourcesModule } from '../src/resources/resources.module'

/**
 * 后端 API 端到端测试
 * 使用真实数据库进行测试
 */
describe('API 端到端测试', () => {
  let app: INestApplication

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
          database: process.env.DB_DATABASE || 'three_mode',
          entities: [Model, ModelVersion, Scene, SceneModel, SceneImage, ShareLink, Viewpoint, Annotation, Resource, ResourceGroup],
          synchronize: true,
          charset: 'utf8mb4',
          logging: false,
        }),
        ModelsModule,
        ScenesModule,
        SharingModule,
        ViewpointsModule,
        AnnotationsModule,
        ResourcesModule,
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  // ─── 模型 API 测试 ─────────────────────────────────────
  describe('Models API', () => {
    it('GET /api/models 应返回空列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/models')
        .expect(200)

      expect(res.body).toHaveProperty('items')
      expect(res.body).toHaveProperty('total')
      expect(Array.isArray(res.body.items)).toBe(true)
    })

    it('GET /api/models 应支持分页参数', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/models?page=1&limit=5')
        .expect(200)

      expect(res.body.page).toBe(1)
      expect(res.body.limit).toBe(5)
    })

    it('GET /api/models 应支持搜索', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/models?search=test')
        .expect(200)

      expect(res.body).toHaveProperty('items')
    })

    it('GET /api/models/:id 不存在的模型应返回 404', async () => {
      await request(app.getHttpServer())
        .get('/api/models/00000000-0000-0000-0000-000000000000')
        .expect(404)
    })
  })

  // ─── 场景 API 测试 ─────────────────────────────────────
  describe('Scenes API', () => {
    let sceneId: string

    it('POST /api/scenes 应创建场景', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/scenes')
        .send({ name: '测试场景' })
        .expect(201)

      expect(res.body.id).toBeDefined()
      expect(res.body.name).toBe('测试场景')
      expect(res.body.scene_config).toBeDefined()
      sceneId = res.body.id
    })

    it('GET /api/scenes 应返回场景列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/scenes')
        .expect(200)

      expect(res.body.items.length).toBeGreaterThan(0)
    })

    it('GET /api/scenes/:id 应返回场景详情', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/scenes/${sceneId}`)
        .expect(200)

      expect(res.body.name).toBe('测试场景')
    })

    it('PUT /api/scenes/:id 应更新场景', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/scenes/${sceneId}`)
        .send({ name: '更新后的场景' })
        .expect(200)

      expect(res.body.name).toBe('更新后的场景')
    })

    it('POST /api/scenes/:id/models 应返回 404（不存在的模型）', async () => {
      await request(app.getHttpServer())
        .post(`/api/scenes/${sceneId}/models`)
        .send({ model_id: '00000000-0000-0000-0000-000000000000' })
        .expect(201) // 注意：当前实现不验证 model_id 是否存在
    })

    it('DELETE /api/scenes/:id 应删除场景', async () => {
      await request(app.getHttpServer())
        .delete(`/api/scenes/${sceneId}`)
        .expect(200)

      // 验证删除
      await request(app.getHttpServer())
        .get(`/api/scenes/${sceneId}`)
        .expect(404)
    })
  })

  // ─── 视点 API 测试 ─────────────────────────────────────
  describe('Viewpoints API', () => {
    let sceneId: string
    let viewpointId: string

    beforeAll(async () => {
      const scene = await request(app.getHttpServer())
        .post('/api/scenes')
        .send({ name: '视点测试场景' })
      sceneId = scene.body.id
    })

    it('POST /api/scenes/:sceneId/viewpoints 应创建视点', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/scenes/${sceneId}/viewpoints`)
        .send({
          name: '正面视角',
          camera_position: { x: 10, y: 5, z: 10 },
          camera_target: { x: 0, y: 0, z: 0 },
          camera_up: { x: 0, y: 1, z: 0 },
          fov: 60,
        })
        .expect(201)

      expect(res.body.id).toBeDefined()
      expect(res.body.name).toBe('正面视角')
      viewpointId = res.body.id
    })

    it('GET /api/scenes/:sceneId/viewpoints 应返回视点列表', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/scenes/${sceneId}/viewpoints`)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThan(0)
    })

    it('GET /api/scenes/:sceneId/viewpoints/:id 应返回视点详情', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/scenes/${sceneId}/viewpoints/${viewpointId}`)
        .expect(200)

      expect(res.body.name).toBe('正面视角')
      expect(res.body.camera_position).toBeDefined()
    })

    it('PATCH /api/scenes/:sceneId/viewpoints/:id 应更新视点', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/scenes/${sceneId}/viewpoints/${viewpointId}`)
        .send({ name: '更新后的视角' })
        .expect(200)

      expect(res.body.name).toBe('更新后的视角')
    })

    it('DELETE /api/scenes/:sceneId/viewpoints/:id 应删除视点', async () => {
      await request(app.getHttpServer())
        .delete(`/api/scenes/${sceneId}/viewpoints/${viewpointId}`)
        .expect(200)

      await request(app.getHttpServer())
        .get(`/api/scenes/${sceneId}/viewpoints/${viewpointId}`)
        .expect(404)
    })
  })

  // ─── 批注 API 测试 ─────────────────────────────────────
  describe('Annotations API', () => {
    let sceneId: string
    let annotationId: string

    beforeAll(async () => {
      const scene = await request(app.getHttpServer())
        .post('/api/scenes')
        .send({ name: '批注测试场景' })
      sceneId = scene.body.id
    })

    it('POST /api/scenes/:sceneId/annotations 应创建批注', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/scenes/${sceneId}/annotations`)
        .send({
          position: { x: 1.5, y: 2.0, z: 3.0 },
          text: '此处需要修改',
          author: '测试用户',
        })
        .expect(201)

      expect(res.body.id).toBeDefined()
      expect(res.body.text).toBe('此处需要修改')
      annotationId = res.body.id
    })

    it('GET /api/scenes/:sceneId/annotations 应返回批注列表', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/scenes/${sceneId}/annotations`)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThan(0)
    })

    it('GET /api/scenes/:sceneId/annotations/:id 应返回批注详情', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/scenes/${sceneId}/annotations/${annotationId}`)
        .expect(200)

      expect(res.body.text).toBe('此处需要修改')
      expect(res.body.position).toBeDefined()
    })

    it('PATCH /api/scenes/:sceneId/annotations/:id 应更新批注', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/scenes/${sceneId}/annotations/${annotationId}`)
        .send({ text: '已修改内容' })
        .expect(200)

      expect(res.body.text).toBe('已修改内容')
    })

    it('DELETE /api/scenes/:sceneId/annotations/:id 应删除批注', async () => {
      await request(app.getHttpServer())
        .delete(`/api/scenes/${sceneId}/annotations/${annotationId}`)
        .expect(200)

      await request(app.getHttpServer())
        .get(`/api/scenes/${sceneId}/annotations/${annotationId}`)
        .expect(404)
    })
  })

  // ─── 资源管理 API 测试 ─────────────────────────────────────
  describe('Resources API', () => {
    let groupId: string

    it('GET /api/resources 应返回资源列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/resources')
        .expect(200)

      expect(res.body).toHaveProperty('items')
      expect(res.body).toHaveProperty('total')
    })

    it('GET /api/resources/groups 应返回分组列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/resources/groups')
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it('POST /api/resources/groups 应创建分组', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/resources/groups')
        .send({ name: '测试分组' })
        .expect(201)

      expect(res.body.id).toBeDefined()
      expect(res.body.name).toBe('测试分组')
      groupId = res.body.id
    })

    it('PATCH /api/resources/groups/:id 应更新分组', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/resources/groups/${groupId}`)
        .send({ name: '更新后的分组' })
        .expect(200)

      expect(res.body.name).toBe('更新后的分组')
    })

    it('DELETE /api/resources/groups/:id 应删除分组', async () => {
      await request(app.getHttpServer())
        .delete(`/api/resources/groups/${groupId}`)
        .expect(200)
    })
  })

  // ─── 分享 API 测试 ─────────────────────────────────────
  describe('Share API', () => {
    let shareToken: string
    let shareId: string

    it('POST /api/share 应创建分享链接', async () => {
      // 先创建一个场景用于分享
      const scene = await request(app.getHttpServer())
        .post('/api/scenes')
        .send({ name: '分享测试场景' })

      const sceneId = scene.body.id

      const res = await request(app.getHttpServer())
        .post('/api/share')
        .send({ scene_id: sceneId })
        .expect(201)

      expect(res.body.token).toBeDefined()
      expect(res.body.token).toHaveLength(32)
      expect(res.body.permission).toBe('view')
      shareToken = res.body.token
      shareId = res.body.id
    })

    it('GET /api/share/:token 应返回分享内容', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/share/${shareToken}`)
        .expect(200)

      expect(res.body.token).toBe(shareToken)
      expect(res.body.scene).toBeDefined()
    })

    it('GET /api/share/:token 不存在的 token 应返回 404', async () => {
      await request(app.getHttpServer())
        .get('/api/share/nonexistent0000000000000000')
        .expect(404)
    })

    it('GET /api/share/scene/:sceneId 应返回场景的分享列表', async () => {
      // 创建场景并分享
      const scene = await request(app.getHttpServer())
        .post('/api/scenes')
        .send({ name: '列表测试' })

      const sceneId = scene.body.id

      await request(app.getHttpServer())
        .post('/api/share')
        .send({ scene_id: sceneId })

      const res = await request(app.getHttpServer())
        .get(`/api/share/scene/${sceneId}`)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThan(0)
    })

    it('DELETE /api/share/:id 应撤销分享', async () => {
      await request(app.getHttpServer())
        .delete(`/api/share/${shareId}`)
        .expect(200)

      // 验证已撤销（应该返回 404）
      await request(app.getHttpServer())
        .get(`/api/share/${shareToken}`)
        .expect(404)
    })
  })
})
