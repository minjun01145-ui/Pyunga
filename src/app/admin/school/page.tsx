import { redirect } from "next/navigation";

export default function LegacySchoolAdminPage() {
  redirect("/admin/evaluation/users");
}
