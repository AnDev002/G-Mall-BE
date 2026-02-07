// BE-119/modules/product/constants/tag-rules.ts (hoặc file tương ứng ở Frontend để dùng chung)

export interface TagRule {
  code: string;       // Tag dùng để lưu DB và Search (VD: recipient:kids)
  group: 'recipient' | 'occasion' | 'corporate';
  label: string;      // Tên hiển thị (VD: Trẻ em)
  keywords: string[]; // Từ khóa để quét
}
export const AUTO_TAG_RULES: TagRule[] = [
  // ==================== 1. NGƯỜI NHẬN (RECIPIENT) ====================
  // --- Mẹ bầu ---
  { code: 'recipient:pregnant-plan', group: 'recipient', label: 'Chuẩn bị mang thai', keywords: ['chuẩn bị mang thai', 'trước khi sinh', 'bổ trứng'] },
  { code: 'recipient:pregnant-during', group: 'recipient', label: 'Mang thai', keywords: ['bà bầu', 'mang thai', 'thai kỳ', 'cho mẹ bầu'] },
  { code: 'recipient:pregnant-birth', group: 'recipient', label: 'Chuẩn bị sinh', keywords: ['đi sinh', 'sau sinh', 'vượt cạn'] },

  // --- Trẻ em ---
  { code: 'recipient:kids-newborn', group: 'recipient', label: 'Trẻ sơ sinh', keywords: ['sơ sinh', 'newborn', 'đầy tháng', '0-12 tháng'] },
  { code: 'recipient:kids-5m-2y', group: 'recipient', label: 'Trẻ em 5 tháng - 2 tuổi', keywords: ['ăn dặm', '1 tuổi', '2 tuổi', 'tập đi'] },
  { code: 'recipient:kids-female-2-3', group: 'recipient', label: 'Bé gái (2-3 tuổi)', keywords: ['bé gái', 'búp bê', '2-3 tuổi', '3 tuổi'] },
  { code: 'recipient:kids-male-2-3', group: 'recipient', label: 'Bé trai (2-3 tuổi)', keywords: ['bé trai', 'xe hơi', '2-3 tuổi'] },
  { code: 'recipient:kids-female-5-7', group: 'recipient', label: 'Bé gái (5-7 tuổi)', keywords: ['bé gái', 'công chúa', 'tiểu học', '5-7 tuổi'] },
  { code: 'recipient:kids-male-5-7', group: 'recipient', label: 'Bé trai (5-7 tuổi)', keywords: ['bé trai', 'siêu nhân', 'lắp ráp', '5-7 tuổi'] },
  { code: 'recipient:kids-female-8-10', group: 'recipient', label: 'Bé gái (8-10 tuổi)', keywords: ['bé gái', 'học sinh', '8-10 tuổi'] },
  { code: 'recipient:kids-female-11-13', group: 'recipient', label: 'Bé gái (11-13 tuổi)', keywords: ['tuổi teen', 'cấp 2', 'nữ sinh', '11-13 tuổi'] },
  { code: 'recipient:kids-male-11-13', group: 'recipient', label: 'Bé trai (11-13 tuổi)', keywords: ['nam sinh', 'thiếu niên', '11-13 tuổi'] },
  { code: 'recipient:teen-female-14', group: 'recipient', label: 'Nữ (14+ tuổi)', keywords: ['nữ sinh cấp 3', 'bạn gái', '14 tuổi'] },
  { code: 'recipient:teen-male-14', group: 'recipient', label: 'Nam (14+ tuổi)', keywords: ['nam sinh cấp 3', 'bạn trai', '14 tuổi'] },

  // --- Người lớn ---
  { code: 'recipient:adult-student', group: 'recipient', label: 'Sinh viên', keywords: ['sinh viên', 'đại học', 'nhập học'] },
  { code: 'recipient:adult-female', group: 'recipient', label: 'Dành cho Nữ', keywords: ['phụ nữ', 'quà tặng nàng', 'bạn gái', 'vợ'] },
  { code: 'recipient:adult-male', group: 'recipient', label: 'Dành cho Nam', keywords: ['đàn ông', 'quà tặng chàng', 'bạn trai', 'chồng'] },
  { code: 'recipient:adult-mom', group: 'recipient', label: 'Quà biếu Mẹ', keywords: ['tặng mẹ', 'mẹ yêu', 'trung niên nữ'] },
  { code: 'recipient:adult-dad', group: 'recipient', label: 'Quà biếu Cha', keywords: ['tặng bố', 'tặng cha', 'trung niên nam'] },

  // --- Người già ---
  { code: 'recipient:elder-grandpa', group: 'recipient', label: 'Dành cho Ông', keywords: ['tặng ông', 'người cao tuổi nam'] },
  { code: 'recipient:elder-grandma', group: 'recipient', label: 'Dành cho Bà', keywords: ['tặng bà', 'người cao tuổi nữ'] },

  // ==================== 2. NHÂN DỊP - NGÀY LỄ (OCCASION) ====================
  // --- Ngày lễ cố định ---
  { code: 'occasion:holiday-newyear', group: 'occasion', label: 'Năm mới / Tết', keywords: ['năm mới', 'tết', 'xuân', 'lịch', 'lì xì'] },
  { code: 'occasion:holiday-valentine', group: 'occasion', label: '14/2 Valentine', keywords: ['valentine', 'tình nhân', '14/2', 'chocolate'] },
  { code: 'occasion:holiday-8-3', group: 'occasion', label: '8/3 Quốc tế Phụ nữ', keywords: ['8/3', 'quốc tế phụ nữ'] },
  { code: 'occasion:holiday-happy', group: 'occasion', label: '20/3 Quốc tế Hạnh phúc', keywords: ['20/3', 'hạnh phúc'] },
  { code: 'occasion:holiday-labor', group: 'occasion', label: '1/5 Quốc tế Lao động', keywords: ['1/5', 'lao động'] },
  { code: 'occasion:holiday-family-intl', group: 'occasion', label: '15/5 Quốc tế Gia đình', keywords: ['15/5', 'quốc tế gia đình'] },
  { code: 'occasion:holiday-children', group: 'occasion', label: '1/6 Quốc tế Thiếu nhi', keywords: ['1/6', 'thiếu nhi'] },
  { code: 'occasion:holiday-student-vn', group: 'occasion', label: '09/01 HS-SV Việt Nam', keywords: ['09/01', 'học sinh sinh viên'] },
  { code: 'occasion:holiday-mother', group: 'occasion', label: 'Ngày của Mẹ', keywords: ['ngày của mẹ', 'mother'] },
  { code: 'occasion:holiday-father', group: 'occasion', label: 'Ngày của Cha', keywords: ['ngày của cha', 'father'] },
  { code: 'occasion:holiday-youth', group: 'occasion', label: '12/08 QT Thanh Thiếu Niên', keywords: ['12/08', 'thanh thiếu niên'] },
  { code: 'occasion:holiday-teacher', group: 'occasion', label: '20/11 Nhà giáo Việt Nam', keywords: ['20/11', 'nhà giáo', 'thầy cô'] },
  { code: 'occasion:holiday-vu-lan', group: 'occasion', label: 'Lễ Vu Lan', keywords: ['vu lan', 'báo hiếu'] },
  { code: 'occasion:holiday-mid-autumn', group: 'occasion', label: 'Tết Trung Thu', keywords: ['trung thu', 'lồng đèn', 'bánh trung thu'] },
  { code: 'occasion:holiday-xmas', group: 'occasion', label: '25/12 Giáng sinh', keywords: ['giáng sinh', 'noel', 'xmas'] },
  // ... (Bạn có thể thêm các ngày lễ khác từ list vào đây tương tự)

  // --- Nhân dịp sự kiện ---
  { code: 'occasion:event-baby-born', group: 'occasion', label: 'Bé chào đời', keywords: ['chào đời', 'đầy tháng'] },
  { code: 'occasion:event-birthday', group: 'occasion', label: 'Sinh nhật', keywords: ['sinh nhật', 'birthday', 'tuổi mới'] },
  { code: 'occasion:event-graduation', group: 'occasion', label: 'Tốt nghiệp', keywords: ['tốt nghiệp', 'cử nhân', 'ra trường'] },
  { code: 'occasion:event-opening', group: 'occasion', label: 'Khai trương / Khánh thành', keywords: ['khai trương', 'khánh thành', 'thần tài'] },
  { code: 'occasion:event-wedding', group: 'occasion', label: 'Đính hôn / Cưới', keywords: ['đính hôn', 'đám cưới', 'tân hôn', 'kỷ niệm ngày cưới'] },
  { code: 'occasion:event-housewarming', group: 'occasion', label: 'Tân gia', keywords: ['tân gia', 'nhà mới'] },
  { code: 'occasion:event-condolence', group: 'occasion', label: 'Chia buồn', keywords: ['chia buồn', 'tang lễ', 'kính viếng'] },

  // ==================== 3. QUÀ TẶNG DOANH NGHIỆP (CORPORATE) ====================
  { code: 'corporate:honor-cup', group: 'corporate', label: 'Cúp vinh danh', keywords: ['cúp', 'pha lê', 'vinh danh'] },
  { code: 'corporate:honor-medal', group: 'corporate', label: 'Huy chương / Kỷ niệm chương', keywords: ['huy chương', 'kỷ niệm chương', 'bảng vàng'] },
  { code: 'corporate:gift-ad', group: 'corporate', label: 'Quà tặng quảng cáo', keywords: ['quà tặng doanh nghiệp', 'in logo'] },
  { code: 'corporate:item-helmet', group: 'corporate', label: 'Mũ bảo hiểm', keywords: ['mũ bảo hiểm'] },
  { code: 'corporate:item-umbrella', group: 'corporate', label: 'Ô dù / Áo mưa', keywords: ['ô dù', 'áo mưa'] },
];