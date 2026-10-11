import {
  BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { REDIS_CLIENT } from 'src/database/redis/redis.constants';
import { ProductWriteService } from './product-write.service';
import { ProductCacheService } from './product-cache.service';
import { R2Service } from '../../storage/r2.service'; // <-- SỬA đường dẫn cho đúng
import { fetchImageSafe, friendlyErr, ImageMime, MAX_IMAGE_BYTES, mapLimit, sniffImage } from './product-import.utils';

// ───────────────────────── CẤU HÌNH CỘT ─────────────────────────
const SHEET_PRODUCTS = 'Sản phẩm';
const SHEET_MODELS = 'Thêm model';
const SHEET_GUIDE = 'Hướng dẫn';
const SHEET_CATS = 'Danh mục';

interface ColDef { key: string; header: string; width: number; link?: boolean; image?: boolean; note?: string }

// THỨ TỰ = thứ tự trong file mẫu (đọc theo vị trí cột).
const PRODUCT_COLS: ColDef[] = [
  { key: 'group', header: 'Mã nhóm (tuỳ chọn)', width: 14, note: 'Chỉ cần khi 2 sản phẩm khác nhau nhưng trùng tên. Bình thường để trống: các dòng cùng TÊN sẽ tự gộp thành model của 1 sản phẩm.' },
  { key: 'name', header: 'Tên sản phẩm *', width: 36, note: 'Các dòng cùng tên = cùng 1 sản phẩm (mỗi dòng là 1 model). Bỏ trống tên thì dòng đó thuộc sản phẩm của dòng ngay phía trên.' },
  { key: 'category', header: 'Danh mục * (tên, đường dẫn hoặc ID)', width: 34, note: 'Xem sheet "Danh mục". Nên dán "Đường dẫn đầy đủ" để tránh trùng tên.' },
  { key: 'description', header: 'Mô tả', width: 40 },
  { key: 'brand', header: 'Thương hiệu', width: 16 },
  { key: 'origin', header: 'Xuất xứ', width: 14 },
  { key: 'weight', header: 'Cân nặng (g)', width: 12 },
  { key: 'length', header: 'Dài (cm)', width: 10 },
  { key: 'width', header: 'Rộng (cm)', width: 10 },
  { key: 'height', header: 'Cao (cm)', width: 10 },
  { key: 'images', header: 'Ảnh sản phẩm * (link / tên file ZIP / dán ảnh)', width: 50, link: true, image: true, note: 'Tối đa 9 ảnh. Cách nhau bằng dấu phẩy hoặc xuống dòng. Có thể là link, tên file trong ZIP đính kèm, hoặc dán ảnh trực tiếp vào ô (đặt ảnh vừa trong ô).' },
  { key: 'videos', header: 'Video (link, tối đa 5)', width: 40, link: true, note: 'Link YouTube/TikTok/mp4... Cách nhau bằng dấu phẩy hoặc xuống dòng.' },
  { key: 'tier1Name', header: 'Tên nhóm phân loại 1', width: 16, note: 'VD: Màu sắc. Để trống nếu sản phẩm không có phân loại (hoặc để trống để tự đặt tên "Phân loại").' },
  { key: 'tier1Value', header: 'Model / Giá trị phân loại 1', width: 18 },
  { key: 'tier2Name', header: 'Tên nhóm phân loại 2', width: 16 },
  { key: 'tier2Value', header: 'Giá trị phân loại 2', width: 16 },
  { key: 'price', header: 'Giá bán (VNĐ) *', width: 16 },
  { key: 'stock', header: 'Tồn kho *', width: 12 },
  { key: 'sku', header: 'SKU', width: 16 },
  { key: 'variantImage', header: 'Ảnh model (link / tên file ZIP / dán ảnh)', width: 40, link: true, image: true },
];

const MODEL_COLS: ColDef[] = [
  { key: 'product', header: 'Sản phẩm có sẵn * (ID hoặc tên chính xác)', width: 40, note: 'Sản phẩm phải đã có trong shop của bạn và đã có phân loại.' },
  { key: 'v1', header: 'Model / Giá trị phân loại 1 *', width: 22, note: 'Giá trị chưa có sẽ được thêm mới vào nhóm phân loại 1 của sản phẩm.' },
  { key: 'v2', header: 'Giá trị phân loại 2', width: 20 },
  { key: 'v3', header: 'Giá trị phân loại 3', width: 20 },
  { key: 'v4', header: 'Giá trị phân loại 4', width: 20 },
  { key: 'v5', header: 'Giá trị phân loại 5', width: 20 },
  { key: 'price', header: 'Giá bán (VNĐ) *', width: 16 },
  { key: 'stock', header: 'Tồn kho *', width: 12 },
  { key: 'sku', header: 'SKU', width: 16 },
  { key: 'variantImage', header: 'Ảnh model (link / tên file ZIP / dán ảnh)', width: 40, link: true, image: true },
];

// ───────────────────────── TYPES ─────────────────────────
type ImgSrc =
  | { kind: 'url'; url: string }
  | { kind: 'zip'; name: string }
  | { kind: 'buf'; buffer: Buffer; label: string };

export interface ImportIssue { sheet: string; row: number; product?: string; message: string }
export interface ImportOptions { draft: boolean; onExisting: 'skip' | 'update' }

interface RawRow { rowNo: number; t: Record<string, string>; price: number; stock: number; emb: Record<string, Buffer[]> }
type ZipIndex = Map<string, JSZip.JSZipObject>;

interface ProductPlan {
  rowNo: number; name: string; dto: any;
  imgSrcs: ImgSrc[]; tier1Imgs: (ImgSrc | null)[]; varImgs: (ImgSrc | null)[];
  simpleSku?: string; skus: number;
}
interface ModelRow { rowNo: number; v: string[]; price: number; stock: number; sku: string; img: ImgSrc | null }
interface ModelPlan { productId: string; name: string; rows: ModelRow[]; add: number; update: number; skip: number }
interface Changes {
  errors: { row: number; message: string }[];
  warnings: { row: number; message: string }[];
  newValues: { tierIdx: number; optionId: string; value: string; position: number; row: number; img: ImgSrc | null }[];
  creates: { row: number; indices: number[]; price: number; stock: number; sku: string; img: ImgSrc | null }[];
  updates: { row: number; variantId: string; price: number; stock: number; sku: string; img: ImgSrc | null }[];
  skipped: number;
}
interface Plan {
  shopId: string; zipIndex: ZipIndex | null; opts: ImportOptions;
  errors: ImportIssue[]; warnings: ImportIssue[];
  products: ProductPlan[]; models: ModelPlan[];
  productRows: number; modelRows: number; productGroups: number;
}
export interface JobState {
  id: string; userId: string; status: 'running' | 'done' | 'failed';
  total: number; processed: number; created: number; modelsAdded: number; modelsUpdated: number;
  currentName?: string; errors: ImportIssue[]; warnings: ImportIssue[];
  startedAt: number; updatedAt: number; finishedAt?: number; fatal?: string;
}
interface Runtime { cache: Map<string, Promise<string>>; uploaded: { key: string; url: string }[]; zipIndex: ZipIndex | null }

const norm = (s: string) => (s ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
const splitRefs = (s: string) => (s || '').split(/[\n\r,;]+/).map((x) => x.trim()).filter(Boolean);
const parseTierIndex = (raw: unknown): number[] => {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === 'string' && raw.length > 0) return raw.split(',').map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n));
  return [];
};
const srcKey = (s: ImgSrc) => (s.kind === 'url' ? `u:${s.url}` : s.kind === 'zip' ? `z:${s.name.toLowerCase()}` : '');

@Injectable()
export class ProductImportService {
  private readonly logger = new Logger(ProductImportService.name);
  private static readonly MAX_ROWS = 3000;
  private static readonly MAX_GROUPS = 300;
  private static readonly MAX_IMAGES = 9;
  private static readonly MAX_VIDEOS = 5;
  private static readonly JOB_TTL = 3600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly productWrite: ProductWriteService,
    private readonly productCache: ProductCacheService,
    private readonly r2: R2Service,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ═════════════════════════ 1. FILE MẪU ═════════════════════════
  async buildTemplate(): Promise<Buffer> {
    const cats = await this.categoryPaths();
    const catName = cats[0]?.path ?? 'Tên danh mục';
    const IMG = 'https://placehold.co/600x600/png';
    const VIDEO = 'https://www.w3schools.com/html/mov_bbb.mp4';

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(SHEET_PRODUCTS, { views: [{ state: 'frozen', ySplit: 1 }] });
    this.setupSheet(ws, PRODUCT_COLS, 'FFF97316');
    ws.getColumn('group').numFmt = '@';
    ws.getColumn('sku').numFmt = '@';

    ws.addRows([
      // SP 1: 2 nhóm phân loại, 4 model. Các dòng sau chỉ cần lặp TÊN.
      { name: 'Áo thun cotton basic', category: catName, description: 'Áo thun 100% cotton, form rộng', brand: 'Local Brand', origin: 'Việt Nam', weight: 200, length: 30, width: 25, height: 3, images: `${IMG}\n${IMG}?2`, videos: VIDEO, tier1Name: 'Màu sắc', tier1Value: 'Đen', tier2Name: 'Size', tier2Value: 'S', price: 150000, stock: 20, sku: 'AO01-DEN-S', variantImage: IMG },
      { name: 'Áo thun cotton basic', tier1Value: 'Đen', tier2Value: 'M', price: 150000, stock: 15, sku: 'AO01-DEN-M' },
      { name: 'Áo thun cotton basic', tier1Value: 'Trắng', tier2Value: 'S', price: 155000, stock: 10, sku: 'AO01-TRANG-S', variantImage: `${IMG}?3` },
      { name: 'Áo thun cotton basic', tier1Value: 'Trắng', tier2Value: 'M', price: 155000, stock: 8, sku: 'AO01-TRANG-M' },
      // SP 2: không phân loại
      { name: 'Cốc sứ trắng 350ml', category: catName, description: 'Cốc sứ cao cấp', origin: 'Việt Nam', weight: 400, images: `${IMG}?4`, price: 89000, stock: 50, sku: 'CS01' },
      // SP 3: trùng tên + không ghi tên nhóm => tự đặt nhóm "Phân loại"
      { name: 'Balo du lịch 20L', category: catName, description: 'Balo chống nước', weight: 600, images: `${IMG}?5`, tier1Value: 'Xanh', price: 320000, stock: 12 },
      { name: 'Balo du lịch 20L', tier1Value: 'Đen', price: 320000, stock: 9 },
    ]);

    const ws2 = wb.addWorksheet(SHEET_MODELS, { views: [{ state: 'frozen', ySplit: 1 }] });
    this.setupSheet(ws2, MODEL_COLS, 'FF2563EB');
    ws2.getColumn('sku').numFmt = '@';

    const guide = wb.addWorksheet(SHEET_GUIDE);
    guide.getColumn(1).width = 120;
    [
      'HƯỚNG DẪN NHẬP SẢN PHẨM HÀNG LOẠT',
      '',
      'A. SHEET "Sản phẩm" — tạo sản phẩm mới',
      '1. Mỗi DÒNG là một model (SKU). Các dòng CÙNG TÊN sản phẩm tự gộp thành 1 sản phẩm có nhiều model.',
      '2. Thông tin chung (danh mục, mô tả, ảnh, video, tên nhóm phân loại...) chỉ cần điền ở dòng đầu; các dòng sau chỉ cần Tên + Model + Giá + Tồn kho (+ SKU, ảnh model).',
      '3. Sản phẩm không có phân loại: chỉ 1 dòng, để trống các cột phân loại.',
      '4. Nhiều dòng cùng tên mà không ghi "Tên nhóm phân loại 1": hệ thống tự đặt tên nhóm là "Phân loại".',
      '5. Tối đa 2 nhóm phân loại ở sheet này (muốn nhiều hơn hãy dùng form thêm sản phẩm).',
      '6. Ảnh: link http(s), HOẶC tên file nằm trong file ZIP ảnh đính kèm, HOẶC dán ảnh trực tiếp vào ô (đặt ảnh vừa trong ô). Tối đa 9 ảnh/sản phẩm, mỗi ảnh ≤ 5MB, định dạng PNG/JPG/WEBP/GIF.',
      '7. Video: dán link (tối đa 5). Hệ thống lưu link, không tải video lên.',
      '8. Danh mục: tên, đường dẫn đầy đủ (VD: Thời trang > Áo > Áo phông) hoặc ID trong sheet "Danh mục".',
      '9. Giá và tồn kho là số nguyên. Cột có dấu * là bắt buộc. Cân nặng để trống = 200g.',
      '10. Tên trùng với sản phẩm đã có trong shop sẽ bị bỏ qua (muốn thêm model cho sản phẩm đó, dùng sheet "Thêm model").',
      '',
      'B. SHEET "Thêm model" — thêm model vào sản phẩm ĐÃ CÓ (không cần gộp)',
      '1. Cột 1: ID hoặc tên chính xác của sản phẩm trong shop. Sản phẩm phải đã có phân loại.',
      '2. Điền giá trị cho đủ số nhóm phân loại của sản phẩm đó. Giá trị chưa có sẽ được thêm mới; model cũ giữ nguyên ID nên không ảnh hưởng đơn hàng / Flash Sale.',
      '3. Model đã tồn tại: tuỳ chọn "Bỏ qua" hoặc "Cập nhật giá & tồn kho" khi nhập (chọn trên màn hình nhập).',
      '4. Sản phẩm đang giảm giá: model mới được thêm với giá gốc, hãy vào "Cài đặt giảm giá" để áp dụng lại.',
      '',
      'C. Quy trình: Tải mẫu → điền → "Kiểm tra file" (không ghi dữ liệu) → sửa lỗi nếu có → "Nhập". Sản phẩm mới ở trạng thái "Chờ duyệt" (hoặc "Nháp" nếu bạn chọn).',
      'D. Xoá các dòng ví dụ trước khi nhập sản phẩm thật.',
    ].forEach((line, i) => {
      const row = guide.addRow([line]);
      row.alignment = { wrapText: true };
      if (i === 0) row.font = { bold: true, size: 14 };
      else if (/^[ABCD]\. /.test(line)) row.font = { bold: true };
    });

    const catSheet = wb.addWorksheet(SHEET_CATS);
    catSheet.columns = [{ header: 'ID', key: 'id', width: 40 }, { header: 'Đường dẫn đầy đủ', key: 'path', width: 70 }];
    catSheet.addRows(cats);
    catSheet.getRow(1).font = { bold: true };

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private setupSheet(ws: ExcelJS.Worksheet, cols: ColDef[], color: string) {
    ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width }));
    const head = ws.getRow(1);
    head.height = 40;
    head.eachCell((cell, n) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      const note = cols[n - 1]?.note;
      if (note) (cell as any).note = note;
    });
  }

  private async categoryPaths(): Promise<{ id: string; path: string; name: string; parentId: string | null }[]> {
    const all = await this.prisma.category.findMany({ select: { id: true, name: true, parentId: true } });
    const byId = new Map(all.map((c) => [c.id, c]));
    const pathOf = (id: string): string => {
      const parts: string[] = [];
      let cur = byId.get(id);
      for (let d = 0; cur && d < 10; d++) { parts.unshift(cur.name.trim()); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
      return parts.join(' > ');
    };
    return all.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId, path: pathOf(c.id) })).sort((a, b) => a.path.localeCompare(b.path, 'vi'));
  }

  // ═════════════════════════ 2. KIỂM TRA (dry-run, đồng bộ) ═════════════════════════
  async validate(userId: string, xlsx: Buffer, zip: Buffer | null, opts: ImportOptions) {
    const plan = await this.plan(userId, xlsx, zip, opts);
    const newModels = plan.models.reduce((s, m) => s + m.add, 0);
    return {
      dryRun: true,
      summary: {
        productRows: plan.productRows,
        productGroups: plan.productGroups,
        validNewProducts: plan.products.length,
        validModelTargets: plan.models.length,
        modelRows: plan.modelRows,
        modelsToAdd: newModels,
        modelsToUpdate: plan.models.reduce((s, m) => s + m.update, 0),
        modelsSkipped: plan.models.reduce((s, m) => s + m.skip, 0),
      },
      errors: plan.errors,
      warnings: plan.warnings,
      preview: [
        ...plan.products.slice(0, 60).map((p) => ({ type: 'new', name: p.name, models: p.skus, images: p.imgSrcs.length, videos: (p.dto.videos || []).length })),
        ...plan.models.slice(0, 60).map((m) => ({ type: 'models', name: m.name, add: m.add, update: m.update, skip: m.skip })),
      ],
    };
  }

  // ═════════════════════════ 3. NHẬP THẬT (chạy nền) ═════════════════════════
  async startImport(userId: string, xlsx: Buffer, zip: Buffer | null, opts: ImportOptions) {
    const plan = await this.plan(userId, xlsx, zip, opts);
    const total = plan.products.length + plan.models.length;
    if (total === 0) {
      throw new BadRequestException('Không có dòng hợp lệ nào để nhập. Hãy bấm "Kiểm tra file" để xem lỗi.');
    }

    const lockKey = `import:active:${plan.shopId}`;
    const jobId = randomUUID();
    const locked = await this.redis.set(lockKey, jobId, 'EX', ProductImportService.JOB_TTL, 'NX');
    if (!locked) throw new ConflictException('Shop đang có một lần nhập chưa hoàn tất. Vui lòng chờ xong rồi thử lại.');

    const now = Date.now();
    const job: JobState = {
      id: jobId, userId, status: 'running', total, processed: 0, created: 0, modelsAdded: 0, modelsUpdated: 0,
      errors: [...plan.errors], warnings: [...plan.warnings], startedAt: now, updatedAt: now,
    };
    await this.saveJob(job);

    // Fire-and-forget: lỗi đã được bắt trong execute()
    void this.execute(job, userId, plan).finally(() => this.redis.del(lockKey).catch(() => undefined));
    return { jobId, total };
  }

  async getJob(userId: string, jobId: string): Promise<JobState> {
    const raw = await this.redis.get(`import:job:${jobId}`);
    if (!raw) throw new NotFoundException('Không tìm thấy tiến trình nhập (có thể đã hết hạn)');
    const job: JobState = JSON.parse(raw);
    if (job.userId !== userId) throw new NotFoundException('Không tìm thấy tiến trình nhập');
    if (job.status === 'running' && Date.now() - job.updatedAt > 120_000) {
      return { ...job, status: 'failed', fatal: 'Tiến trình bị gián đoạn (máy chủ khởi động lại?). Các sản phẩm đã tạo vẫn được giữ.' };
    }
    return job;
  }

  private async saveJob(job: JobState) {
    job.updatedAt = Date.now();
    if (job.errors.length > 500) job.errors = job.errors.slice(0, 500);
    if (job.warnings.length > 500) job.warnings = job.warnings.slice(0, 500);
    await this.redis.set(`import:job:${job.id}`, JSON.stringify(job), 'EX', ProductImportService.JOB_TTL);
  }

  private async execute(job: JobState, userId: string, plan: Plan) {
    const rt: Runtime = { cache: new Map(), uploaded: [], zipIndex: plan.zipIndex };
    const warnAt = (sheet: string, row: number, product: string, message: string) => job.warnings.push({ sheet, row, product, message });
    try {
      // ── A. Tạo sản phẩm mới (tuần tự: create() sinh slug theo Date.now()) ──
      for (const p of plan.products) {
        job.currentName = p.name;
        rt.uploaded = [];
        try {
          const dto = p.dto;
          const urls = await mapLimit(p.imgSrcs, 4, async (src, i) => {
            try { return await this.resolveImage(src, rt); }
            catch (e) { warnAt(SHEET_PRODUCTS, p.rowNo, p.name, `Ảnh sản phẩm #${i + 1}: ${friendlyErr(e)}`); return null; }
          });
          dto.images = urls.filter(Boolean) as string[];
          if (dto.images.length === 0) throw new Error('Không tải được ảnh nào cho sản phẩm này');

          if (dto.tiers?.length) {
            const t1 = await mapLimit(p.tier1Imgs, 4, (s) => this.tryResolve(s, rt, (m) => warnAt(SHEET_PRODUCTS, p.rowNo, p.name, `Ảnh model: ${m}`)));
            dto.tiers[0].images = t1.map((u) => u || '');
            const vi = await mapLimit(p.varImgs, 4, (s) => this.tryResolve(s, rt, (m) => warnAt(SHEET_PRODUCTS, p.rowNo, p.name, `Ảnh model: ${m}`)));
            vi.forEach((u, i) => { if (u && dto.variations?.[i]) dto.variations[i].imageUrl = u; });
          }

          const created: any = await this.productWrite.create(userId, dto);
          // create() không nhận sku cho SP đơn (Product không có cột sku) -> ghi vào variant mặc định
          if (p.simpleSku && created?.id) {
            await this.prisma.productVariant.updateMany({ where: { productId: created.id }, data: { sku: p.simpleSku } });
          }
          job.created++;
        } catch (e: any) {
          // Dọn ảnh vừa tải lên cho sản phẩm lỗi (không đụng ảnh của sản phẩm khác)
          for (const u of rt.uploaded) { rt.cache.delete(u.key); await this.r2.deleteFile(u.url); }
          const m = e?.response?.message ?? e?.message ?? 'Lỗi không xác định';
          job.errors.push({ sheet: SHEET_PRODUCTS, row: p.rowNo, product: p.name, message: Array.isArray(m) ? m.join('; ') : String(m) });
        }
        job.processed++;
        await this.saveJob(job);
      }

      // ── B. Thêm model vào sản phẩm có sẵn ──
      for (const mp of plan.models) {
        job.currentName = mp.name;
        rt.uploaded = [];
        try {
          const r = await this.applyModels(mp, plan.shopId, plan.opts, rt, (row, m) => warnAt(SHEET_MODELS, row, mp.name, m));
          job.modelsAdded += r.added;
          job.modelsUpdated += r.updated;
        } catch (e: any) {
          for (const u of rt.uploaded) { rt.cache.delete(u.key); await this.r2.deleteFile(u.url); }
          job.errors.push({ sheet: SHEET_MODELS, row: mp.rows[0]?.rowNo ?? 0, product: mp.name, message: e?.message ?? 'Lỗi không xác định' });
        }
        job.processed++;
        await this.saveJob(job);
      }
      job.status = 'done';
    } catch (e: any) {
      this.logger.error(`[import] job=${job.id} fatal: ${e?.message}`);
      job.status = 'failed';
      job.fatal = e?.message ?? 'Lỗi không xác định';
    } finally {
      job.currentName = undefined;
      job.finishedAt = Date.now();
      await this.saveJob(job).catch(() => undefined);
      this.logger.log(`[import] job=${job.id} created=${job.created} models+${job.modelsAdded} ~${job.modelsUpdated} errors=${job.errors.length}`);
    }
  }

  // ═════════════════════════ 4. ẢNH ═════════════════════════
  private async tryResolve(src: ImgSrc | null, rt: Runtime, onWarn: (m: string) => void): Promise<string | null> {
    if (!src) return null;
    try { return await this.resolveImage(src, rt); } catch (e) { onWarn(friendlyErr(e)); return null; }
  }

  /** Đưa ảnh lên R2. Cùng 1 ảnh xuất hiện nhiều lần trong file chỉ tải/upload 1 lần. */
  private async resolveImage(src: ImgSrc, rt: Runtime): Promise<string> {
    const r2Domain = (process.env.R2_PUBLIC_DOMAIN || '').trim();
    if (src.kind === 'url' && r2Domain && src.url.startsWith(r2Domain)) return src.url; // đã nằm trên R2 của bạn

    const key = srcKey(src);
    if (key) { const hit = rt.cache.get(key); if (hit) return hit; }

    const job = (async () => {
      let buffer: Buffer; let mime: ImageMime | null;
      if (src.kind === 'url') {
        ({ buffer, mime } = await fetchImageSafe(src.url));
      } else if (src.kind === 'zip') {
        const entry = rt.zipIndex?.get(src.name.toLowerCase());
        if (!entry) throw new Error(`Không thấy file "${src.name}" trong ZIP`);
        const declared = (entry as any)._data?.uncompressedSize;
        if (typeof declared === 'number' && declared > MAX_IMAGE_BYTES) throw new Error(`File "${src.name}" lớn hơn 5MB`);
        buffer = await entry.async('nodebuffer');
        if (buffer.length > MAX_IMAGE_BYTES) throw new Error(`File "${src.name}" lớn hơn 5MB`);
        mime = sniffImage(buffer);
        if (!mime) throw new Error(`File "${src.name}" không phải ảnh PNG/JPG/WEBP/GIF`);
      } else {
        buffer = src.buffer;
        if (buffer.length > MAX_IMAGE_BYTES) throw new Error(`${src.label}: ảnh dán lớn hơn 5MB`);
        mime = sniffImage(buffer);
        if (!mime) throw new Error(`${src.label}: ảnh dán không đúng định dạng PNG/JPG/WEBP/GIF`);
      }
      const { url } = await this.r2.uploadDirect(buffer, 'import', mime, 'products');
      rt.uploaded.push({ key: key || `buf:${url}`, url });
      return url;
    })();

    if (key) rt.cache.set(key, job);
    try { return await job; } catch (e) { if (key) rt.cache.delete(key); throw e; }
  }

  // ═════════════════════════ 5. LẬP KẾ HOẠCH (đọc + kiểm tra toàn bộ file) ═════════════════════════
  private async plan(userId: string, xlsx: Buffer, zip: Buffer | null, opts: ImportOptions): Promise<Plan> {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
    if (!shop) throw new ForbiddenException('Bạn chưa đăng ký Cửa hàng (Shop).');
    if (shop.status === 'BANNED' || shop.status === 'PENDING') {
      throw new ForbiddenException(`Shop của bạn đang ở trạng thái: ${shop.status}. Không thể đăng bán.`);
    }

    const { products: pRows, models: mRows } = await this.parseWorkbook(xlsx);
    if (pRows.length === 0 && mRows.length === 0) throw new BadRequestException('File không có dòng dữ liệu nào');
    const zipIndex = zip ? await this.indexZip(zip) : null;

    const errors: ImportIssue[] = [];
    const warnings: ImportIssue[] = [];

    // Danh mục: khớp ID, tên, hoặc đường dẫn "A > B > C"
    const cats = await this.categoryPaths();
    const catById = new Set(cats.map((c) => c.id));
    const catByPath = new Map<string, string[]>();
    const catByName = new Map<string, string[]>();
    for (const c of cats) {
      const p = norm(c.path.replace(/\s*>\s*/g, ' > '));
      catByPath.set(p, [...(catByPath.get(p) ?? []), c.id]);
      const n = norm(c.name);
      catByName.set(n, [...(catByName.get(n) ?? []), c.id]);
    }
    const resolveCategory = (v: string): { id?: string; err?: string } => {
      const t = v.trim();
      if (catById.has(t)) return { id: t };
      const key = norm(t.replace(/\s*>\s*/g, ' > '));
      const ids = (key.includes('>') ? catByPath.get(key) : undefined) ?? catByName.get(key) ?? catByPath.get(key);
      if (!ids) return { err: `Không tìm thấy danh mục "${t}" (xem sheet "Danh mục")` };
      if (ids.length > 1) return { err: `Danh mục "${t}" bị trùng tên, hãy dùng đường dẫn đầy đủ hoặc ID` };
      return { id: ids[0] };
    };

    const shopProducts = await this.prisma.product.findMany({ where: { shopId: shop.id }, select: { id: true, name: true } });
    const usedNames = new Set(shopProducts.map((p) => norm(p.name)));

    // ── Sheet 1: gộp dòng thành sản phẩm ──
    const groups = new Map<string, RawRow[]>();
    let lastKey: string | null = null;
    for (const r of pRows) {
      let key: string;
      if (r.t.group) key = 'g:' + norm(r.t.group);
      else if (r.t.name) key = 'n:' + norm(r.t.name);
      else if (lastKey) key = lastKey; // bỏ trống tên => thuộc sản phẩm dòng trên
      else { errors.push({ sheet: SHEET_PRODUCTS, row: r.rowNo, message: 'Thiếu tên sản phẩm' }); continue; }
      lastKey = key;
      const g = groups.get(key);
      if (g) g.push(r); else groups.set(key, [r]);
    }
    if (groups.size > ProductImportService.MAX_GROUPS) {
      throw new BadRequestException(`Tối đa ${ProductImportService.MAX_GROUPS} sản phẩm mỗi lần nhập`);
    }

    const products: ProductPlan[] = [];
    for (const g of groups.values()) {
      const res = this.buildProduct(g, { resolveCategory, zipIndex, opts });
      warnings.push(...res.warnings);
      if (res.errors.length || !res.plan) { errors.push(...res.errors); continue; }
      const nk = norm(res.plan.name);
      if (usedNames.has(nk)) {
        errors.push({
          sheet: SHEET_PRODUCTS, row: res.plan.rowNo, product: res.plan.name,
          message: 'Đã có sản phẩm cùng tên trong shop (hoặc trùng với sản phẩm khác trong file). Muốn thêm model cho sản phẩm đó, hãy dùng sheet "Thêm model".',
        });
        continue;
      }
      usedNames.add(nk);
      products.push(res.plan);
    }

    // ── Sheet 2: thêm model vào sản phẩm có sẵn ──
    const byId = new Map(shopProducts.map((p) => [p.id, p]));
    const byName = new Map<string, string[]>();
    for (const p of shopProducts) byName.set(norm(p.name), [...(byName.get(norm(p.name)) ?? []), p.id]);

    const targets = new Map<string, ModelRow[]>();
    for (const r of mRows) {
      const ref = r.t.product;
      const rowErr = (message: string) => errors.push({ sheet: SHEET_MODELS, row: r.rowNo, product: ref || undefined, message });
      if (!ref) { rowErr('Thiếu sản phẩm có sẵn'); continue; }
      let pid: string | undefined;
      if (byId.has(ref.trim())) pid = ref.trim();
      else {
        const ids = byName.get(norm(ref));
        if (!ids) { rowErr('Không tìm thấy sản phẩm này trong shop của bạn'); continue; }
        if (ids.length > 1) { rowErr('Có nhiều sản phẩm trùng tên, hãy nhập ID sản phẩm'); continue; }
        pid = ids[0];
      }
      let img: ImgSrc | null = null;
      const tok = splitRefs(r.t.variantImage)[0];
      if (tok) {
        const p = this.parseRef(tok, zipIndex);
        if (typeof p === 'string') { rowErr(p); continue; }
        img = p;
      } else if (r.emb.variantImage?.[0]) img = { kind: 'buf', buffer: r.emb.variantImage[0], label: `Dòng ${r.rowNo}` };

      const mr: ModelRow = {
        rowNo: r.rowNo, v: [r.t.v1, r.t.v2, r.t.v3, r.t.v4, r.t.v5], price: r.price, stock: r.stock, sku: r.t.sku || '', img,
      };
      const arr = targets.get(pid); if (arr) arr.push(mr); else targets.set(pid, [mr]);
    }
    if (targets.size > ProductImportService.MAX_GROUPS) {
      throw new BadRequestException(`Tối đa ${ProductImportService.MAX_GROUPS} sản phẩm mỗi lần nhập`);
    }

    const models: ModelPlan[] = [];
    for (const [pid, rows] of targets) {
      const detail = await this.loadProductForModels(pid, shop.id);
      const name = detail?.name ?? pid;
      if (!detail) { errors.push({ sheet: SHEET_MODELS, row: rows[0].rowNo, product: name, message: 'Sản phẩm không còn tồn tại' }); continue; }
      const ch = this.computeChanges(detail, rows, opts);
      for (const e of ch.errors) errors.push({ sheet: SHEET_MODELS, row: e.row, product: name, message: e.message });
      for (const w of ch.warnings) warnings.push({ sheet: SHEET_MODELS, row: w.row, product: name, message: w.message });
      if (ch.creates.length || ch.updates.length) {
        models.push({ productId: pid, name, rows, add: ch.creates.length, update: ch.updates.length, skip: ch.skipped });
      }
    }

    errors.sort((a, b) => (a.sheet === b.sheet ? a.row - b.row : a.sheet.localeCompare(b.sheet)));
    return { shopId: shop.id, zipIndex, opts, errors, warnings, products, models, productRows: pRows.length, modelRows: mRows.length, productGroups: groups.size };
  }

  // ───────────── Dựng 1 sản phẩm từ nhóm dòng (sheet 1) ─────────────
  private buildProduct(
    rows: RawRow[],
    c: { resolveCategory: (v: string) => { id?: string; err?: string }; zipIndex: ZipIndex | null; opts: ImportOptions },
  ): { errors: ImportIssue[]; warnings: ImportIssue[]; plan?: ProductPlan } {
    const errors: ImportIssue[] = [];
    const warnings: ImportIssue[] = [];
    const first = rows[0];
    const pick = (k: string) => rows.find((r) => r.t[k])?.t[k] ?? '';
    const name = pick('name');
    const label = name || pick('group') || `dòng ${first.rowNo}`;
    const err = (row: number, message: string) => errors.push({ sheet: SHEET_PRODUCTS, row, product: label, message });
    const warn = (row: number, message: string) => warnings.push({ sheet: SHEET_PRODUCTS, row, product: label, message });

    if (!name) err(first.rowNo, 'Thiếu tên sản phẩm');
    else if (name.length > 255) err(first.rowNo, 'Tên sản phẩm tối đa 255 ký tự');
    if (new Set(rows.map((r) => r.t.name).filter(Boolean).map(norm)).size > 1) {
      warn(first.rowNo, 'Các dòng cùng Mã nhóm ghi tên khác nhau, dùng tên đầu tiên');
    }

    // Danh mục
    let categoryId: string | undefined;
    const catText = pick('category');
    if (!catText) err(first.rowNo, 'Thiếu danh mục');
    else {
      if (new Set(rows.map((r) => r.t.category).filter(Boolean).map(norm)).size > 1) warn(first.rowNo, `Các dòng ghi danh mục khác nhau, dùng "${catText}"`);
      const r = c.resolveCategory(catText);
      if (r.err) err(first.rowNo, r.err); else categoryId = r.id;
    }

    // Ảnh sản phẩm (gom từ mọi dòng của nhóm, bỏ trùng)
    const imgSrcs: ImgSrc[] = [];
    const seenImg = new Set<string>();
    for (const r of rows) {
      for (const tok of splitRefs(r.t.images)) {
        const s = this.parseRef(tok, c.zipIndex);
        if (typeof s === 'string') { err(r.rowNo, s); continue; }
        const k = srcKey(s);
        if (seenImg.has(k)) continue;
        seenImg.add(k); imgSrcs.push(s);
      }
      for (const b of r.emb.images ?? []) imgSrcs.push({ kind: 'buf', buffer: b, label: `Dòng ${r.rowNo}` });
    }
    if (imgSrcs.length === 0) err(first.rowNo, 'Cần ít nhất 1 ảnh sản phẩm (link, tên file ZIP hoặc ảnh dán vào ô)');
    else if (imgSrcs.length > ProductImportService.MAX_IMAGES) err(first.rowNo, `Tối đa ${ProductImportService.MAX_IMAGES} ảnh sản phẩm (đang có ${imgSrcs.length})`);

    // Video (chỉ link)
    const videos: string[] = [];
    for (const r of rows) {
      for (const tok of splitRefs(r.t.videos)) {
        if (!/^https?:\/\/\S+$/i.test(tok)) { err(r.rowNo, `Link video không hợp lệ: "${tok.slice(0, 60)}" (phải bắt đầu bằng http:// hoặc https://)`); continue; }
        if (!videos.includes(tok)) videos.push(tok);
      }
    }
    if (videos.length > ProductImportService.MAX_VIDEOS) err(first.rowNo, `Tối đa ${ProductImportService.MAX_VIDEOS} video`);

    // Số đo
    const optNum = (label2: string, s: string): number | undefined => {
      if (!s) return undefined;
      const n = Number(s.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) { err(first.rowNo, `${label2} không hợp lệ`); return undefined; }
      return n;
    };
    const weight = optNum('Cân nặng', pick('weight'));
    const length = optNum('Chiều dài', pick('length'));
    const width = optNum('Chiều rộng', pick('width'));
    const height = optNum('Chiều cao', pick('height'));

    // Nhóm phân loại
    const names1 = [...new Set(rows.map((r) => r.t.tier1Name).filter(Boolean))];
    const names2 = [...new Set(rows.map((r) => r.t.tier2Name).filter(Boolean))];
    if (names1.length > 1) err(first.rowNo, `Tên nhóm phân loại 1 không thống nhất giữa các dòng: ${names1.join(' / ')}`);
    if (names2.length > 1) err(first.rowNo, `Tên nhóm phân loại 2 không thống nhất giữa các dòng: ${names2.join(' / ')}`);
    let t1 = names1[0] ?? '';
    const t2 = names2[0] ?? '';
    if (t2 && !t1 && rows.every((r) => !r.t.tier1Value)) err(first.rowNo, 'Phải có phân loại 1 trước khi dùng phân loại 2');
    if (!t1 && (rows.length > 1 || rows.some((r) => r.t.tier1Value))) t1 = 'Phân loại'; // tự đặt tên nhóm
    const tierCount = t1 ? (t2 ? 2 : 1) : 0;

    // Từng model
    const values1: string[] = [];
    const values2: string[] = [];
    const tier1Imgs: (ImgSrc | null)[] = [];
    const seen = new Set<string>();
    const vars: { price: number; stock: number; sku: string; idx: number[]; img: ImgSrc | null }[] = [];

    for (const r of rows) {
      if (!Number.isInteger(r.price) || r.price <= 0 || r.price > 1_000_000_000) err(r.rowNo, 'Giá bán phải là số nguyên > 0');
      if (!Number.isInteger(r.stock) || r.stock < 0) err(r.rowNo, 'Tồn kho phải là số nguyên ≥ 0');

      let img: ImgSrc | null = null;
      const tok = splitRefs(r.t.variantImage)[0];
      if (tok) { const p = this.parseRef(tok, c.zipIndex); if (typeof p === 'string') err(r.rowNo, p); else img = p; }
      else if (r.emb.variantImage?.[0]) img = { kind: 'buf', buffer: r.emb.variantImage[0], label: `Dòng ${r.rowNo}` };

      const idx: number[] = [];
      if (tierCount >= 1) {
        const v1 = r.t.tier1Value;
        if (!v1) { err(r.rowNo, 'Thiếu Model / Giá trị phân loại 1 (cần để phân biệt các dòng cùng sản phẩm)'); continue; }
        let i1 = values1.findIndex((x) => norm(x) === norm(v1));
        if (i1 < 0) { values1.push(v1); tier1Imgs.push(null); i1 = values1.length - 1; }
        if (img && !tier1Imgs[i1]) tier1Imgs[i1] = img;
        idx.push(i1);
        if (tierCount === 2) {
          const v2 = r.t.tier2Value;
          if (!v2) { err(r.rowNo, 'Thiếu Giá trị phân loại 2'); continue; }
          let i2 = values2.findIndex((x) => norm(x) === norm(v2));
          if (i2 < 0) { values2.push(v2); i2 = values2.length - 1; }
          idx.push(i2);
        }
      }
      const key = idx.join(',');
      if (seen.has(key)) err(r.rowNo, 'Trùng tổ hợp model với một dòng khác của cùng sản phẩm');
      seen.add(key);
      vars.push({ price: r.price, stock: r.stock, sku: r.t.sku || '', idx, img });
    }

    if (errors.length) return { errors, warnings };

    const dto: any = {
      name,
      categoryId,
      description: pick('description') || name, // DTO bắt buộc description
      images: [] as string[],
      videos,
      brand: pick('brand') || 'No Brand',
      origin: pick('origin') || 'Vietnam',
      weight: weight ?? 200, length: length ?? 0, width: width ?? 0, height: height ?? 0,
      attributes: JSON.stringify({ condition: 'new', conditionPercent: 100 }),
      systemTags: [],
      tiers: tierCount === 0 ? [] : [
        { name: t1, options: values1, images: values1.map(() => '') },
        ...(tierCount === 2 ? [{ name: t2, options: values2, images: [] as string[] }] : []),
      ],
      price: tierCount ? Math.min(...vars.map((v) => v.price)) : vars[0].price,
      ...(tierCount
        ? { variations: vars.map((v) => ({ price: v.price, stock: v.stock, sku: v.sku, tierIndex: v.idx })) }
        : { stock: vars[0].stock }),
      // KHÔNG đặt `sku` vào dto: create() spread `...rest` thẳng vào prisma.product.create (Product không có cột sku)
      ...(c.opts.draft ? { status: 'DRAFT' } : {}),
    };
    return {
      errors, warnings,
      plan: {
        rowNo: first.rowNo, name, dto, imgSrcs, tier1Imgs,
        varImgs: vars.map((v) => v.img),
        simpleSku: tierCount ? undefined : vars[0].sku || undefined,
        skus: vars.length,
      },
    };
  }

  // ───────────── Thêm model vào SP có sẵn (sheet 2) ─────────────
  private async loadProductForModels(productId: string, shopId: string): Promise<any | null> {
    return this.prisma.product.findFirst({
      where: { id: productId, shopId },
      include: {
        options: { include: { values: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
        variants: true,
      },
    });
  }

  /** Hàm thuần: dùng chung cho kiểm tra và nhập thật để hai bên luôn cho cùng kết quả. */
  private computeChanges(product: any, rows: ModelRow[], opts: ImportOptions): Changes {
    const out: Changes = { errors: [], warnings: [], newValues: [], creates: [], updates: [], skipped: 0 };
    const tiers: { id: string; values: string[] }[] = product.options.map((o: any) => ({ id: o.id, values: o.values.map((v: any) => String(v.value)) }));
    const tierCount = tiers.length;
    if (tierCount === 0) {
      for (const r of rows) out.errors.push({ row: r.rowNo, message: 'Sản phẩm này chưa có phân loại nên không thể thêm model. Hãy sửa sản phẩm bằng form, hoặc xoá và tạo lại bằng sheet "Sản phẩm".' });
      return out;
    }
    const working = tiers.map((t) => [...t.values]);
    const vmap = new Map<string, any>();
    for (const v of product.variants) vmap.set(parseTierIndex(v.tierIndex).join(','), v);
    const seenKeys = new Set<string>();
    let warnedDiscount = false;

    for (const r of rows) {
      if (!Number.isInteger(r.price) || r.price <= 0 || r.price > 1_000_000_000) { out.errors.push({ row: r.rowNo, message: 'Giá bán phải là số nguyên > 0' }); continue; }
      if (!Number.isInteger(r.stock) || r.stock < 0) { out.errors.push({ row: r.rowNo, message: 'Tồn kho phải là số nguyên ≥ 0' }); continue; }
      if (r.v.slice(tierCount).some(Boolean)) { out.errors.push({ row: r.rowNo, message: `Sản phẩm chỉ có ${tierCount} nhóm phân loại, dòng này điền nhiều giá trị hơn` }); continue; }
      const missing = r.v.slice(0, tierCount).findIndex((x) => !x);
      if (missing >= 0) { out.errors.push({ row: r.rowNo, message: `Thiếu giá trị phân loại ${missing + 1} (sản phẩm có ${tierCount} nhóm phân loại)` }); continue; }

      // Tính chỉ số TRƯỚC, chỉ ghi vào `working` khi dòng hợp lệ
      const indices: number[] = [];
      const pending: { tierIdx: number; value: string; position: number }[] = [];
      for (let i = 0; i < tierCount; i++) {
        const found = working[i].findIndex((x) => norm(x) === norm(r.v[i]));
        if (found >= 0) indices.push(found);
        else { indices.push(working[i].length); pending.push({ tierIdx: i, value: r.v[i], position: working[i].length }); }
      }
      const key = indices.join(',');
      if (seenKeys.has(key)) { out.errors.push({ row: r.rowNo, message: 'Trùng tổ hợp model với một dòng khác trong sheet' }); continue; }
      seenKeys.add(key);

      for (const p of pending) {
        working[p.tierIdx].push(p.value);
        out.newValues.push({ ...p, optionId: tiers[p.tierIdx].id, row: r.rowNo, img: p.tierIdx === 0 ? r.img : null });
      }

      const old = vmap.get(key);
      if (old) {
        if (opts.onExisting === 'update') {
          out.updates.push({ row: r.rowNo, variantId: old.id, price: r.price, stock: r.stock, sku: r.sku, img: r.img });
          if (product.isDiscountActive && !warnedDiscount) { warnedDiscount = true; out.warnings.push({ row: r.rowNo, message: 'Sản phẩm đang giảm giá: chỉ cập nhật tồn kho/SKU, KHÔNG đổi giá (hãy chỉnh qua "Cài đặt giảm giá")' }); }
        } else {
          out.skipped++;
          out.warnings.push({ row: r.rowNo, message: 'Model đã tồn tại - bỏ qua' });
        }
      } else {
        out.creates.push({ row: r.rowNo, indices, price: r.price, stock: r.stock, sku: r.sku, img: r.img });
        if (product.isDiscountActive && !warnedDiscount) { warnedDiscount = true; out.warnings.push({ row: r.rowNo, message: 'Sản phẩm đang giảm giá: model mới thêm với giá gốc, hãy vào "Cài đặt giảm giá" để áp dụng lại' }); }
      }
    }
    return out;
  }

  private async applyModels(mp: ModelPlan, shopId: string, opts: ImportOptions, rt: Runtime, warn: (row: number, m: string) => void) {
    const detail = await this.loadProductForModels(mp.productId, shopId);
    if (!detail) throw new Error('Sản phẩm không còn tồn tại');
    const ch = this.computeChanges(detail, mp.rows, opts);

    const rowImg = new Map<number, string>();
    const withImg = [...ch.creates, ...ch.updates, ...ch.newValues].filter((x) => x.img);
    const seenRow = new Set<number>();
    await mapLimit(withImg.filter((x) => !seenRow.has(x.row) && seenRow.add(x.row)), 4, async (x) => {
      const u = await this.tryResolve(x.img, rt, (m) => warn(x.row, `Ảnh model: ${m}`));
      if (u) rowImg.set(x.row, u);
    });

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const nv of ch.newValues) {
        await tx.productOptionValue.create({ data: { optionId: nv.optionId, value: nv.value, position: nv.position, image: nv.tierIdx === 0 ? rowImg.get(nv.row) ?? null : null } });
      }
      for (const c of ch.creates) {
        await tx.productVariant.create({
          data: { productId: mp.productId, price: new Prisma.Decimal(c.price), stock: c.stock, sku: c.sku, image: rowImg.get(c.row) ?? null, tierIndex: c.indices.join(',') },
        });
      }
      for (const u of ch.updates) {
        const data: any = { stock: u.stock };
        if (!detail.isDiscountActive) data.price = new Prisma.Decimal(u.price);
        if (u.sku) data.sku = u.sku;
        const img = rowImg.get(u.row); if (img) data.image = img;
        await tx.productVariant.update({ where: { id: u.variantId }, data });
      }
      const agg = await tx.productVariant.aggregate({ where: { productId: mp.productId }, _sum: { stock: true } });
      await tx.product.update({ where: { id: mp.productId }, data: { stock: agg._sum.stock ?? 0 } });
    }, { timeout: 30000, maxWait: 10000 });

    await this.productCache.invalidateProduct(detail.id, detail.slug).catch(() => undefined);
    return { added: ch.creates.length, updated: ch.updates.length };
  }

  // ═════════════════════════ 6. ĐỌC EXCEL / ZIP ═════════════════════════
  private parseRef(tok: string, zipIndex: ZipIndex | null): ImgSrc | string {
    if (/^https?:\/\/\S+$/i.test(tok)) return { kind: 'url', url: tok };
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(tok)) return `Link "${tok.slice(0, 60)}" phải bắt đầu bằng http:// hoặc https://`;
    const base = (tok.split(/[\\/]/).pop() || '').trim();
    if (!zipIndex) return `"${tok.slice(0, 60)}" không phải link. Nếu là tên file ảnh, hãy đính kèm file ZIP ảnh`;
    if (!zipIndex.has(base.toLowerCase())) return `Không thấy file "${base}" trong ZIP ảnh`;
    return { kind: 'zip', name: base };
  }

  private async indexZip(buf: Buffer): Promise<ZipIndex> {
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) throw new BadRequestException('File ảnh phải là .zip');
    let z: JSZip;
    try { z = await JSZip.loadAsync(buf); } catch { throw new BadRequestException('Không đọc được file ZIP ảnh'); }
    const map: ZipIndex = new Map();
    z.forEach((path, entry) => {
      const base = path.split('/').pop() || '';
      if (entry.dir || path.includes('__MACOSX') || base.startsWith('.')) return;
      map.set(base.toLowerCase(), entry);
    });
    if (map.size > 2000) throw new BadRequestException('ZIP tối đa 2000 file');
    return map;
  }

  private async parseWorkbook(buffer: Buffer): Promise<{ products: RawRow[]; models: RawRow[] }> {
    if (!buffer || buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      throw new BadRequestException('File phải là định dạng .xlsx (không hỗ trợ .xls / .csv)');
    }
    const wb = new ExcelJS.Workbook();
    try { await wb.xlsx.load(buffer as any); } catch { throw new BadRequestException('Không đọc được file Excel, vui lòng dùng file mẫu'); }

    const ws1 = wb.getWorksheet(SHEET_PRODUCTS) ?? wb.worksheets[0];
    if (!ws1 || !this.headerOk(ws1, PRODUCT_COLS, [1, 2, 17, 18])) {
      throw new BadRequestException('File không đúng mẫu (mẫu đã được nâng cấp), vui lòng tải lại file mẫu mới');
    }
    const products = this.readRows(ws1, PRODUCT_COLS, this.collectEmbedded(wb, ws1));

    let models: RawRow[] = [];
    const ws2 = wb.getWorksheet(SHEET_MODELS);
    if (ws2) {
      if (!this.headerOk(ws2, MODEL_COLS, [1, 2, 7, 8])) throw new BadRequestException(`Sheet "${SHEET_MODELS}" sai mẫu, vui lòng tải lại file mẫu mới`);
      models = this.readRows(ws2, MODEL_COLS, this.collectEmbedded(wb, ws2));
    }
    if (products.length + models.length > ProductImportService.MAX_ROWS) {
      throw new BadRequestException(`Tối đa ${ProductImportService.MAX_ROWS} dòng mỗi lần nhập`);
    }
    return { products, models };
  }

  private headerOk(ws: ExcelJS.Worksheet, cols: ColDef[], idxs: number[]): boolean {
    return idxs.every((n) => norm(this.cellText(ws.getRow(1).getCell(n).value, false)).slice(0, 6) === norm(cols[n - 1].header).slice(0, 6));
  }

  /** Ảnh dán nổi trên sheet: map "hàng:cột" (1-based) -> danh sách buffer. */
  private collectEmbedded(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet): Map<string, Buffer[]> {
    const map = new Map<string, Buffer[]>();
    let imgs: any[] = [];
    try { imgs = (ws as any).getImages?.() ?? []; } catch { imgs = []; }
    for (const im of imgs) {
      try {
        const media: any = wb.getImage(Number(im.imageId));
        const tl = im.range?.tl;
        if (!media?.buffer || !tl) continue;
        const col = Math.floor(tl.nativeCol ?? tl.col) + 1;
        const row = Math.floor(tl.nativeRow ?? tl.row) + 1;
        const key = `${row}:${col}`;
        const arr = map.get(key); const b = Buffer.from(media.buffer);
        if (arr) arr.push(b); else map.set(key, [b]);
      } catch { /* bỏ qua ảnh hỏng */ }
    }
    return map;
  }

  private readRows(ws: ExcelJS.Worksheet, cols: ColDef[], embedded: Map<string, Buffer[]>): RawRow[] {
    const rows: RawRow[] = [];
    const priceCol = cols.findIndex((c) => c.key === 'price') + 1;
    const stockCol = cols.findIndex((c) => c.key === 'stock') + 1;
    ws.eachRow({ includeEmpty: false }, (row, rowNo) => {
      if (rowNo === 1) return;
      const t: Record<string, string> = {};
      let empty = true;
      cols.forEach((c, i) => {
        const v = this.cellText(row.getCell(i + 1).value, !!c.link);
        t[c.key] = v;
        if (v) empty = false;
      });
      if (empty) return;
      const emb: Record<string, Buffer[]> = {};
      cols.forEach((c, i) => { if (c.image) { const b = embedded.get(`${rowNo}:${i + 1}`); if (b) emb[c.key] = b; } });
      rows.push({ rowNo, t, price: this.toInt(row.getCell(priceCol).value), stock: this.toInt(row.getCell(stockCol).value), emb });
    });
    return rows;
  }

  private cellText(v: ExcelJS.CellValue, preferLink: boolean): string {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'object') {
      const o: any = v;
      if (preferLink && typeof o.hyperlink === 'string') return o.hyperlink.trim();
      if (Array.isArray(o.richText)) return o.richText.map((x: any) => x.text).join('').trim();
      if ('result' in o) return String(o.result ?? '').trim();
      if ('text' in o) {
        if (o.text && typeof o.text === 'object' && Array.isArray(o.text.richText)) return o.text.richText.map((x: any) => x.text).join('').trim();
        return String(o.text ?? '').trim();
      }
      if (typeof o.hyperlink === 'string') return o.hyperlink.trim();
      return '';
    }
    return String(v).trim();
  }

  /** Số nguyên: nhận ô số hoặc chuỗi "1.500.000đ". Rỗng/sai -> NaN. */
  private toInt(v: ExcelJS.CellValue): number {
    if (typeof v === 'number') return v;
    const digits = this.cellText(v, false).replace(/[^\d]/g, '');
    return digits ? Number(digits) : NaN;
  }
}