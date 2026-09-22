import { schoolLogoSchema } from "../domain/evaluation-template-presentation";

export async function readSchoolLogo(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5_000_000) {
    throw new Error("5MB 이하의 PNG, JPEG 또는 WebP 이미지를 선택해 주세요.");
  }
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("이미지를 읽을 수 없습니다. 다른 이미지 파일을 선택해 주세요.");
  });
  try {
    const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 처리할 수 없습니다.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = schoolLogoSchema.safeParse(canvas.toDataURL("image/webp", 0.9));
    if (!result.success) throw new Error("이미지 용량이 큽니다. 더 작은 교표를 선택해 주세요.");
    return result.data;
  } finally {
    bitmap.close();
  }
}
