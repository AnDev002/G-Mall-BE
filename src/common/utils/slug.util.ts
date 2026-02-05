// BE-115/common/utils/slug.util.ts
import slugify from 'slugify';

export function generateSlug(text: string): string {
  if (!text) return '';
  
  // 1. Convert Vietnamese characters to English equivalent
  const from = "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ";
  const to   = "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyydAAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYD";
  
  let newText = text;
  for (let i = 0, l = from.length; i < l; i++) {
    newText = newText.replace(new RegExp(from[i], "g"), to[i]);
  }

  // 2. Use slugify to handle clean up
  return slugify(newText, {
    lower: true,      // Convert to lower case
    strict: true,     // Strip special characters except replacement
    locale: 'vi',     // Vietnamese locale support
    trim: true        // Trim leading/trailing replacement chars
  });
}